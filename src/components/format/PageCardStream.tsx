import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ArticleData } from '../../types';
import { templates } from '../../data/templates';
import { useArticlePages } from '../../hooks/useArticlePages';
import { ArticlePage } from './ArticlePage';
import { CardEditorToolbar } from './CardEditorToolbar';
import {
  applyCardFlowEdits,
  createFlowId,
  insertImageAfterBlock,
  moveBlockNear,
} from '../../utils/mergeBack';
import type { CardFlowEdit } from '../../utils/mergeBack';
import { blockText } from '../../utils/htmlDoc';
import { normalizeCardEditHtml } from '../../utils/typography';
import {
  downloadAllAsZip,
  downloadPng,
  safeFileName,
} from '../../utils/imageExport';
import type { ExportProgress } from '../../utils/imageExport';
import { articleFontText } from '../../utils/fontCss';
import { Button } from '../shared/Button';

interface PageCardStreamProps {
  article: ArticleData;
  /** Merge card edits back into the store (content JSON + HTML). */
  onContentChange: (content: string, html: string) => void;
  /** Update the article title from the editable cover. */
  onTitleChange: (title: string) => void;
  /** Success toast callback (wired from App). */
  onToast?: (message: string) => void;
  onManualPageBreaksChange: (breaks: string[]) => void;
}

type BusyState = 'idle' | 'single' | 'all';

/** Card spacing inside the horizontal strip (visual px at scale=1). */
const GAP = 28;
const PAD = 34;
/** Wrapper vertical padding (top 26px + bottom 30px from global.css). */
const WRAP_V_PAD = 26 + 30;
const EDIT_DEBOUNCE_MS = 500;

interface CaretBookmark {
  /** Stable source block id, without a pagination part suffix. */
  id: string;
  /** Character offset inside the complete source block. */
  offset: number;
}

interface PendingCaretRestore {
  bookmark: CaretBookmark;
  expectedJson: string;
  sawPaginationStart: boolean;
  previousPages: ReturnType<typeof useArticlePages>['pages'];
}

/** Collect existing and newly-created card blocks in visual DOM order. */
function collectCardFlowEntries(root: HTMLElement): CardFlowEdit[] {
  const entries: CardFlowEdit[] = [];
  const seen = new Set<string>();
  let previousId: string | undefined;

  const add = (element: HTMLElement): void => {
    const rawId = element.dataset.blockId;
    if (rawId && !seen.has(rawId)) {
      seen.add(rawId);
      entries.push({
        id: rawId,
        html: normalizeCardEditHtml(element),
        outerHtml: element.outerHTML,
      });
      previousId = rawId;
      return;
    }

    const newId = element.dataset.flowNewId || createFlowId();
    element.dataset.flowNewId = newId;
    entries.push({
      html: normalizeCardEditHtml(element),
      outerHtml: element.outerHTML,
      newId,
      afterId: previousId,
    });
    previousId = newId;
  };

  Array.from(root.children).forEach((child) => {
    const element = child as HTMLElement;
    if (element.matches('ul,ol')) {
      Array.from(element.children)
        .filter((item) => item.tagName.toLowerCase() === 'li')
        .forEach((item) => add(item as HTMLElement));
      return;
    }
    if (element.dataset.blockId) {
      add(element);
      return;
    }
    const tagged = Array.from(
      element.querySelectorAll<HTMLElement>('[data-block-id]')
    );
    if (tagged.length) tagged.forEach(add);
    else add(element);
  });

  let nextExistingId: string | undefined;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.id) nextExistingId = entry.id;
    else if (!entry.afterId) entry.beforeId = nextExistingId;
  }
  return entries;
}

/** Character offset from the beginning of a rendered block to the caret. */
function caretOffsetWithin(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection?.anchorNode || !element.contains(selection.anchorNode)) {
    return element.innerText.length;
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  } catch {
    return element.innerText.length;
  }
}

/** Capture a logical source position before cards are regenerated. */
function captureCaretBookmark(
  root: HTMLElement,
  pages: ReturnType<typeof useArticlePages>['pages']
): CaretBookmark | null {
  const selectionNode = window.getSelection()?.anchorNode;
  const selectionElement = selectionNode?.nodeType === Node.ELEMENT_NODE
    ? selectionNode as Element
    : selectionNode?.parentElement;
  const element = selectionElement?.closest(
    '[data-block-id], [data-flow-new-id]'
  ) as HTMLElement | null;
  if (!element || !root.contains(element)) return null;

  const newId = element.dataset.flowNewId;
  if (newId) return { id: newId, offset: caretOffsetWithin(element) };
  const partId = element.dataset.blockId;
  if (!partId) return null;
  const baseId = partId.replace(/-p\d+$/, '');
  let offset = caretOffsetWithin(element);
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.id === partId) return { id: baseId, offset };
      if (block.id.replace(/-p\d+$/, '') === baseId) {
        offset += blockText(block).length;
      }
    }
  }
  return { id: baseId, offset };
}

/** Find the regenerated page part that owns a logical source offset. */
function locateBookmark(
  pages: ReturnType<typeof useArticlePages>['pages'],
  bookmark: CaretBookmark
): { pageIndex: number; partId: string; localOffset: number } | null {
  let consumed = 0;
  let last: { pageIndex: number; partId: string; localOffset: number } | null = null;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    for (const block of pages[pageIndex].blocks) {
      if (block.id.replace(/-p\d+$/, '') !== bookmark.id) continue;
      const length = blockText(block).length;
      last = {
        pageIndex,
        partId: block.id,
        localOffset: Math.max(0, Math.min(length, bookmark.offset - consumed)),
      };
      if (bookmark.offset <= consumed + length) return last;
      consumed += length;
    }
  }
  return last;
}

/** Restore the caret inside a regenerated rich-text block. */
function placeCaret(element: HTMLElement, offset: number): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * Memoized ArticlePage: while the active card is being edited it must never
 * be re-rendered from fresh pagination data (that would reset the live
 * contentEditable DOM and lose the caret). We skip re-render only when the
 * card stays active and its captured editableHtml is unchanged.
 */
const ArticlePageMemo = React.memo(
  ArticlePage,
  (prev, next): boolean => {
    if (!prev.active || !next.active) return false;
    return (
      prev.editableHtml === next.editableHtml &&
      prev.page.pageIndex === next.page.pageIndex
    );
  }
);

/**
 * Stage 2 preview — horizontal dual-card stream (原版 loading-cards-wrapper).
 *
 * - Cards (cover + paginated content pages) are laid out horizontally inside
 *   a scrollable viewport; the whole strip is scaled so exactly two cards are
 *   visible side by side (like the measured original: 900×1500 cards, two at
 *   a time, swipe/scroll for more).
 * - Click a card's text area to enter edit mode (render-mode-disabled is
 *   removed, contentEditable activates, caret lands where you clicked).
 * - Edits are debounce-merged back into the store and re-paginated, so every
 *   other card updates in sync.
 * - Bottom controls: 「拖动滑块快速定位」 slider + dot indicators + 共 N 张.
 */
export const PageCardStream: React.FC<PageCardStreamProps> = ({
  article,
  onContentChange,
  onTitleChange,
  onToast,
  onManualPageBreaksChange,
}) => {
  const { pages, ready } = useArticlePages(article);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editTimerRef = useRef<number | null>(null);
  const pendingCaretRestoreRef = useRef<PendingCaretRestore | null>(null);

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [scrollIndex, setScrollIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeHtml, setActiveHtml] = useState('');
  const [activeTitleHtml, setActiveTitleHtml] = useState('');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>('idle');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeIndexRef = useRef<number | null>(null);
  activeIndexRef.current = activeIndex;

  const tpl =
    templates.find((t) => t.id === article.selectedTemplate) || templates[0];
  const { width: cardW, height: cardH } = article.selectedSize;
  const baseName = safeFileName(article.title || '未命名长文');

  // Trim stale refs when the page list regenerates.
  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, pages.length);
  }, [pages.length]);

  const setCardRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      cardRefs.current[index] = el;
    },
    []
  );

  /* ── scale: fit exactly two cards side by side AND fully inside the
     viewport vertically (P0-2) ────────────────────────────────────── */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const update = () => setViewport({ w: vp.clientWidth, h: vp.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (viewport.w <= 0 || viewport.h <= 0) return 0.5;
    const widthScale = (viewport.w - PAD * 2) / (cardW * 2 + GAP);
    const heightScale = (viewport.h - WRAP_V_PAD) / cardH;
    return Math.max(0.16, Math.min(1, Math.min(widthScale, heightScale)));
  }, [viewport, cardW, cardH]);

  const slotW = cardW * scale;
  const slotH = cardH * scale;
  const slotStep = slotW + GAP * scale;

  /* ── scrolling ──────────────────────────────────────────────────── */
  const handleScroll = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || slotStep <= 0) return;
    const idx = Math.round((vp.scrollLeft - PAD) / slotStep);
    setScrollIndex(Math.max(0, Math.min(pages.length - 1, idx)));
  }, [pages.length, slotStep]);

  const scrollToCard = useCallback(
    (index: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const i = Math.max(0, Math.min(pages.length - 1, index));
      vp.scrollTo({ left: PAD + i * slotStep, behavior: 'smooth' });
      setScrollIndex(i);
    },
    [pages.length, slotStep]
  );

  // A structured card transaction briefly returns the active page to render
  // mode, re-paginates the complete document, then reopens the page part that
  // now owns the saved logical caret position.
  useEffect(() => {
    const pending = pendingCaretRestoreRef.current;
    if (!pending || article.content !== pending.expectedJson) return;
    if (!ready) {
      pending.sawPaginationStart = true;
      return;
    }
    if (!pending.sawPaginationStart && pages === pending.previousPages) return;

    const location = locateBookmark(pages, pending.bookmark);
    pendingCaretRestoreRef.current = null;
    if (!location) return;
    const card = cardRefs.current[location.pageIndex];
    const content = card?.querySelector('.xhs-card-content') as HTMLElement | null;
    if (!content) return;

    setActiveHtml(content.innerHTML);
    setActiveTitleHtml('');
    setActiveIndex(location.pageIndex);
    setActiveBlockId(location.partId);
    scrollToCard(location.pageIndex);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const freshCard = cardRefs.current[location.pageIndex];
        const freshContent = freshCard?.querySelector(
          '.xhs-card-content'
        ) as HTMLElement | null;
        const part = freshContent
          ? Array.from(freshContent.querySelectorAll<HTMLElement>('[data-block-id]'))
              .find((element) => element.dataset.blockId === location.partId)
          : undefined;
        if (!freshContent || !part) return;
        freshContent.focus();
        placeCaret(part, location.localOffset);
      });
    });
  }, [article.content, pages, ready, scrollToCard]);

  /* ── click-to-edit: commit / activate / deactivate ──────────────── */

  const commitEdits = useCallback(
    (targetIndex: number, restoreCaret = false) => {
      const cardEl = cardRefs.current[targetIndex];
      if (!cardEl) return;
      const contentEl = cardEl.querySelector(
        '.xhs-card-content'
      ) as HTMLElement | null;
      if (!contentEl) return;
      const entries = collectCardFlowEntries(contentEl);
      if (!entries.length) return;
      const captured = restoreCaret
        ? captureCaretBookmark(contentEl, pages)
        : null;
      const bookmark = captured ?? (
        restoreCaret && activeBlockId
          ? { id: activeBlockId.replace(/-p\d+$/, ''), offset: 0 }
          : null
      );
      const result = applyCardFlowEdits(article.content, pages, entries);
      if (!result || result.json === article.content) return;
      if (bookmark) {
        pendingCaretRestoreRef.current = {
          bookmark,
          expectedJson: result.json,
          sawPaginationStart: false,
          previousPages: pages,
        };
      }
      onContentChange(result.json, result.html);
      if (restoreCaret && bookmark) {
        setActiveIndex(null);
        setActiveHtml('');
        setActiveBlockId(null);
      }
    },
    [activeBlockId, article.content, pages, onContentChange]
  );

  const flushPendingEdit = useCallback(() => {
    if (editTimerRef.current !== null) {
      window.clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
      if (activeIndexRef.current !== null) {
        commitEdits(activeIndexRef.current, false);
      }
    }
  }, [commitEdits]);

  const scheduleCommit = useCallback(() => {
    if (editTimerRef.current !== null) window.clearTimeout(editTimerRef.current);
    editTimerRef.current = window.setTimeout(() => {
      editTimerRef.current = null;
      if (activeIndexRef.current !== null) {
        commitEdits(activeIndexRef.current, true);
      }
    }, EDIT_DEBOUNCE_MS);
  }, [commitEdits]);

  // Cleanup pending timer on unmount.
  useEffect(() => {
    return () => {
      if (editTimerRef.current !== null) window.clearTimeout(editTimerRef.current);
    };
  }, []);

  // Deactivate when switching template or size.
  useEffect(() => {
    setActiveIndex(null);
    setActiveHtml('');
    setActiveTitleHtml('');
  }, [article.selectedTemplate, article.selectedSize]);

  // Click anywhere that is NOT a card (blank area / side panel / header) →
  // back to render-mode-disabled. We resolve the element at the click point
  // (rather than e.target) because activating a card synchronously re-renders
  // it, detaching the original target before this bubbled handler runs.
  useEffect(() => {
    if (activeIndex === null) return;
    const handler = (e: MouseEvent) => {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const onCard =
        !!hit && typeof hit.closest === 'function' && !!hit.closest('.card-outer-container');
      if (!onCard) {
        flushPendingEdit();
        setActiveIndex(null);
        setActiveHtml('');
        setActiveTitleHtml('');
        setActiveBlockId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeIndex, flushPendingEdit]);

  const activateCard = useCallback(
    (index: number, clientX: number, clientY: number) => {
      flushPendingEdit();
      const cardEl = cardRefs.current[index];
      if (!cardEl) return;
      const contentEl = cardEl.querySelector(
        '.xhs-card-content'
      ) as HTMLElement | null;
      const coverEl = cardEl.querySelector(
        '.xhs-cover-title-editable'
      ) as HTMLElement | null;
      if (contentEl) {
        setActiveHtml(contentEl.innerHTML);
        setActiveTitleHtml('');
      } else if (coverEl) {
        setActiveHtml('');
        setActiveTitleHtml(coverEl.innerHTML);
      } else {
        return;
      }
      setActiveIndex(index);

      // After React re-renders the card in editable mode, place the caret at
      // the exact click point (点哪改哪).
      requestAnimationFrame(() => {
        const freshCard = cardRefs.current[index];
        const el = freshCard?.querySelector(
          '.xhs-card-content, .xhs-cover-title-editable'
        ) as HTMLElement | null;
        if (!el) return;
        el.focus();
        if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(clientX, clientY);
          if (range) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }
      });
    },
    [flushPendingEdit]
  );

  const handleCardMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      if (activeIndex === index) return; // already editing → native caret
      const target = e.target as HTMLElement;
      const editableEl = target.closest(
        '.xhs-card-content, .xhs-cover-title-editable'
      );
      if (!editableEl) return;
      const block = target.closest('[data-block-id]') as HTMLElement | null;
      setActiveBlockId(block?.dataset.blockId ?? null);
      e.preventDefault();
      activateCard(index, e.clientX, e.clientY);
    },
    [activeIndex, activateCard]
  );

  const handleContentInput = useCallback(() => {
    scheduleCommit();
  }, [scheduleCommit]);

  const handleTitleInput = useCallback(
    (text: string) => {
      onTitleChange(text);
    },
    [onTitleChange]
  );

  const handleImageResizeCommit = useCallback(() => {
    // Commit immediately so the new width persists in the store.
    if (activeIndexRef.current !== null) {
      commitEdits(activeIndexRef.current, true);
    }
  }, [commitEdits]);

  useEffect(() => {
    if (activeIndex === null) return;
    const update = () => {
      const node = window.getSelection()?.anchorNode;
      const element = node?.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node?.parentElement;
      const block = element?.closest('[data-block-id]') as HTMLElement | null;
      const card = cardRefs.current[activeIndex];
      if (block && card?.contains(block)) setActiveBlockId(block.dataset.blockId ?? null);
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [activeIndex]);

  const activeBaseBlockId = activeBlockId?.replace(/-p\d+$/, '') ?? null;
  const toggleManualBreak = useCallback(() => {
    if (!activeBaseBlockId) return;
    const current = article.manualPageBreaks ?? [];
    const next = current.includes(activeBaseBlockId)
      ? current.filter((id) => id !== activeBaseBlockId)
      : [...current, activeBaseBlockId];
    onManualPageBreaksChange(next);
    onToast?.(current.includes(activeBaseBlockId) ? '已取消手动分页' : '已从当前段落开始新页');
  }, [activeBaseBlockId, article.manualPageBreaks, onManualPageBreaksChange, onToast]);

  const moveActiveBlock = useCallback((direction: 'previous' | 'next') => {
    if (!activeBaseBlockId) return;
    flushPendingEdit();
    const pageIndex = pages.findIndex((page) =>
      page.blocks.some((block) => block.id.replace(/-p\d+$/, '') === activeBaseBlockId)
    );
    const targetPage = pages[pageIndex + (direction === 'previous' ? -1 : 1)];
    if (!targetPage?.blocks.length) {
      onToast?.(direction === 'previous' ? '已经是第一张正文页' : '已经是最后一张正文页');
      return;
    }
    const target = direction === 'previous'
      ? targetPage.blocks[0]
      : targetPage.blocks[targetPage.blocks.length - 1];
    const result = moveBlockNear(
      article.content,
      activeBaseBlockId,
      target.id,
      direction === 'previous' ? 'before' : 'after'
    );
    if (!result) {
      onToast?.('当前段落属于列表或拆分页，暂时不能移动');
      return;
    }
    onContentChange(result.json, result.html);
    setActiveIndex(null);
    setActiveBlockId(null);
    onToast?.(direction === 'previous' ? '段落已移到上一页' : '段落已移到下一页');
  }, [activeBaseBlockId, article.content, pages, flushPendingEdit, onContentChange, onToast]);

  /** Resolve the source block nearest the caret, falling back to card end. */
  const activeAnchorBlockId = useCallback((): string | undefined => {
    const targetIndex = activeIndexRef.current;
    if (targetIndex === null) return undefined;
    const card = cardRefs.current[targetIndex];
    const selectionNode = window.getSelection()?.anchorNode;
    const selectionElement =
      selectionNode?.nodeType === Node.ELEMENT_NODE
        ? (selectionNode as Element)
        : selectionNode?.parentElement;
    const selectedBlock = selectionElement?.closest('[data-block-id]');
    if (selectedBlock && card?.contains(selectedBlock)) {
      return selectedBlock.getAttribute('data-block-id') || undefined;
    }
    const blocks = card?.querySelectorAll('[data-block-id]');
    return blocks?.item(blocks.length - 1)?.getAttribute('data-block-id') || undefined;
  }, []);

  /** Insert image after the current block and immediately re-paginate. */
  const handleInsertImage = useCallback(
    (src: string, afterBlockId?: string) => {
      if (editTimerRef.current !== null) {
        window.clearTimeout(editTimerRef.current);
        editTimerRef.current = null;
      }

      // Preserve any text edits made immediately before the paste/upload.
      let sourceJson = article.content;
      const targetIndex = activeIndexRef.current;
      if (targetIndex !== null) {
        const card = cardRefs.current[targetIndex];
        const content = card?.querySelector(
          '.xhs-card-content'
        ) as HTMLElement | null;
        if (content) {
          const entries = collectCardFlowEntries(content);
          sourceJson = applyCardFlowEdits(sourceJson, pages, entries)?.json ?? sourceJson;
        }
      }

      const result = insertImageAfterBlock(
        sourceJson,
        afterBlockId ?? activeAnchorBlockId(),
        src
      );
      if (!result) return;
      onContentChange(result.json, result.html);
      setActiveIndex(null);
      setActiveHtml('');
      setActiveTitleHtml('');
      onToast?.('图片已插入，页面已重新排版');
    },
    [article.content, pages, activeAnchorBlockId, onContentChange, onToast]
  );

  /* ── downloads (P0-1: shared font-inlined pipeline + progress) ──── */

  const exportText = useMemo(() => articleFontText(article), [article]);

  const handleDownloadOne = useCallback(
    async (index: number) => {
      const el = cardRefs.current[index];
      if (!el) return;
      try {
        setBusy('single');
        setProgress({ stage: 'fonts', current: 0, total: 1 });
        setError(null);
        const name = index === 0 ? `${baseName}-封面` : `${baseName}-第${index}页`;
        await downloadPng(el, name, {
          text: exportText,
          onProgress: (p) => setProgress(p),
        });
        onToast?.(`已下载 ${name}.png`);
      } catch (err) {
        setError(`下载第 ${index} 张失败：${(err as Error).message}`);
        onToast?.(`下载失败：${(err as Error).message}`);
      } finally {
        setBusy('idle');
        setProgress(null);
      }
    },
    [baseName, exportText, onToast]
  );

  const handleDownloadAll = useCallback(async () => {
    try {
      setBusy('all');
      setProgress({ stage: 'fonts', current: 0, total: pages.length });
      setError(null);
      const items = pages
        .map((page, index) => ({
          el: cardRefs.current[index],
          name: index === 0 ? `${baseName}-封面` : `${baseName}-第${index}页`,
        }))
        .filter((item): item is { el: HTMLDivElement; name: string } => !!item.el);
      if (!items.length) {
        setError('没有可导出的页面');
        return;
      }
      const result = await downloadAllAsZip(items, `${baseName}-长文图片`, {
        text: exportText,
        onProgress: (p) => setProgress(p),
      });
      onToast?.(`已生成 ${result.count} 张图片并打包下载`);
    } catch (err) {
      setError(`打包下载失败：${(err as Error).message}`);
      onToast?.(`打包下载失败：${(err as Error).message}`);
    } finally {
      setBusy('idle');
      setProgress(null);
    }
  }, [pages, baseName, exportText, onToast]);

  /** Label shown on the zip button while downloading. */
  const downloadLabel = useCallback((): string => {
    if (busy !== 'all') return '一键下载全部 (zip)';
    if (!progress) return '准备字体…';
    switch (progress.stage) {
      case 'fonts':
        return '准备字体…';
      case 'render':
        return `正在生成第 ${progress.current}/${progress.total} 张…`;
      case 'pack':
        return '打包中…';
      case 'done':
        return '完成';
      default:
        return '处理中…';
    }
  }, [busy, progress]);

  const activeTarget =
    activeIndex !== null
      ? (cardRefs.current[activeIndex]?.querySelector(
          '.xhs-card-content'
        ) as HTMLElement | null)
      : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-[#FAFAFA]/95 backdrop-blur px-6 py-3 border-b border-[#EDEDED] shrink-0">
        <div className="flex items-center justify-between gap-4 min-h-[38px]">
          {activeIndex === null ? (
            <div className="shrink-0">
              <h3 className="text-sm font-semibold text-[#333]">预览卡片流</h3>
              <p className="text-[11px] text-[#999] mt-0.5 tabular-nums">
                {ready
                  ? `共 ${pages.length} 张（封面 + ${Math.max(0, pages.length - 1)} 页正文）· ${cardW} × ${cardH}px`
                  : '正在排版…'}
              </p>
            </div>
          ) : (
            <div className="card-edit-toolbar-inline min-w-0 flex-1 flex items-center gap-2">
              <span className="card-edit-hint shrink-0">编辑中</span>
              <div className="min-w-0 overflow-x-auto">
                <CardEditorToolbar
                  target={activeTarget}
                  onInsertImage={(src) => handleInsertImage(src)}
                  onCommitted={() => {
                    if (activeIndexRef.current !== null) {
                      commitEdits(activeIndexRef.current);
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className="text-[11px] text-[#777] hover:text-[#FF2442] cursor-pointer border-none bg-transparent transition-colors shrink-0"
                onClick={() => {
                  flushPendingEdit();
                  setActiveIndex(null);
                  setActiveHtml('');
                  setActiveTitleHtml('');
                }}
              >
                完成
              </button>
              <span className="toolbar-divider" />
              <button type="button" className="pagination-action" disabled={!activeBaseBlockId} onClick={() => moveActiveBlock('previous')}>← 上一页</button>
              <button type="button" className={`pagination-action ${activeBaseBlockId && article.manualPageBreaks?.includes(activeBaseBlockId) ? 'active' : ''}`} disabled={!activeBaseBlockId} onClick={toggleManualBreak}>从这里分页</button>
              <button type="button" className="pagination-action" disabled={!activeBaseBlockId} onClick={() => moveActiveBlock('next')}>下一页 →</button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadAll}
              disabled={!ready || busy !== 'idle'}
            >
              {downloadLabel()}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 px-4 py-2 text-xs text-[#C0392B] bg-[#FDECEA] border border-[#F5C6CB] rounded-xhs">
          {error}
        </div>
      )}

      {/* Horizontal scroll viewport — two cards side by side */}
      <div
        ref={viewportRef}
        className="card-scroll-viewport"
        onScroll={handleScroll}
      >
        <div ref={wrapperRef} className="loading-cards-wrapper">
          {pages.map((page, index) => (
            <div
              key={`${index}-${page.blocks.length}-${page.isCover ? 'c' : 'b'}`}
              className="card-display-slot group relative"
              style={{ width: slotW, height: slotH, flexShrink: 0 }}
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  width: cardW,
                  height: cardH,
                }}
              >
                <div ref={setCardRef(index)}>
                  <ArticlePageMemo
                    page={page}
                    article={article}
                    template={tpl}
                    pageNumber={index + 1}
                    totalPages={pages.length}
                    active={activeIndex === index}
                    editableHtml={
                      index === activeIndex
                        ? page.isCover
                          ? activeTitleHtml
                          : activeHtml
                        : undefined
                    }
                    onContentInput={handleContentInput}
                    onTitleInput={handleTitleInput}
                    onImageResizeCommit={handleImageResizeCommit}
                    onPasteImage={handleInsertImage}
                    onCardMouseDown={handleCardMouseDown}
                  />
                </div>
              </div>

              {/* Per-card PNG download (hover) */}
              <button
                type="button"
                onClick={() => handleDownloadOne(index)}
                disabled={!ready || busy !== 'idle'}
                className="absolute top-2 right-2 z-40 px-2.5 py-1 text-[11px] rounded-xhs cursor-pointer border border-[#E8E8E8] bg-white/95 text-[#666] hover:border-[#FF2442] hover:text-[#FF2442] transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                title="下载此图"
              >
                {busy === 'single'
                  ? progress?.stage === 'fonts'
                    ? '准备字体…'
                    : '生成中…'
                  : '下载此图'}
              </button>

              {!!page.warnings?.length && (
                <div className="page-quality-chips" title={page.warnings.map((warning) => warning.message).join('；')}>
                  {page.warnings.slice(0, 2).map((warning) => (
                    <span key={warning.type}>⚠ {warning.message}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {!ready && (
            <div className="text-xs text-[#999] py-10 w-64 text-center">
              正在计算分页并解析图片尺寸…
            </div>
          )}

          {ready && pages.length === 1 && (
            <div className="text-xs text-[#999] py-6 w-80 text-center leading-relaxed">
              正文内容为空，当前仅生成封面。
              <br />
              回到编辑器输入内容后，将自动按固定高度分页生成多张图片。
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls: slider + dots + 共 N 张 */}
      <div className="shrink-0 bg-white border-t border-[#EDEDED] px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999] whitespace-nowrap">拖动滑块快速定位</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, pages.length - 1)}
            value={scrollIndex}
            onChange={(e) => scrollToCard(Number(e.target.value))}
            className="flex-1 xhs-range"
            aria-label="预览页码"
            disabled={!ready || pages.length < 2}
          />
          <div className="card-dots">
            {pages.map((page, i) => (
              <button
                key={`dot-${i}`}
                type="button"
                className={`card-dot ${i === scrollIndex ? 'active' : ''}`}
                onClick={() => scrollToCard(i)}
                aria-label={`第 ${i + 1} 张`}
              />
            ))}
          </div>
          <span className="text-xs text-[#999] tabular-nums whitespace-nowrap">
            共{pages.length}张
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-[#BBB] tabular-nums">
          <span>{cardW} × {cardH} px</span>
          {scale < 1 && <span>· 预览缩放 {Math.round(scale * 100)}%</span>}
          {activeIndex !== null && (
            <span className="text-[#FF2442]">
              · 点击卡片文字可直接编辑，改动实时同步其余卡片
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageCardStream;
