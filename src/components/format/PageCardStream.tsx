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
import { applyBlockEdits } from '../../utils/mergeBack';
import type { BlockEdit } from '../../utils/mergeBack';
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
}

type BusyState = 'idle' | 'single' | 'all';

/** Card spacing inside the horizontal strip (visual px at scale=1). */
const GAP = 28;
const PAD = 34;
/** Wrapper vertical padding (top 26px + bottom 30px from global.css). */
const WRAP_V_PAD = 26 + 30;
const EDIT_DEBOUNCE_MS = 500;

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
}) => {
  const { pages, ready } = useArticlePages(article);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editTimerRef = useRef<number | null>(null);

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [scrollIndex, setScrollIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeHtml, setActiveHtml] = useState('');
  const [activeTitleHtml, setActiveTitleHtml] = useState('');
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

  /* ── click-to-edit: commit / activate / deactivate ──────────────── */

  const commitEdits = useCallback(
    (targetIndex: number) => {
      const cardEl = cardRefs.current[targetIndex];
      if (!cardEl) return;
      const contentEl = cardEl.querySelector(
        '.xhs-card-content'
      ) as HTMLElement | null;
      if (!contentEl) return;
      const edits: BlockEdit[] = [];
      contentEl.querySelectorAll('[data-block-id]').forEach((el) => {
        edits.push({
          id: el.getAttribute('data-block-id') || '',
          html: el.innerHTML,
        });
      });
      if (!edits.length) return;
      const result = applyBlockEdits(article.content, pages, edits);
      if (result) {
        onContentChange(result.json, result.html);
      }
    },
    [article.content, pages, onContentChange]
  );

  const flushPendingEdit = useCallback(() => {
    if (editTimerRef.current !== null) {
      window.clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
      if (activeIndexRef.current !== null) {
        commitEdits(activeIndexRef.current);
      }
    }
  }, [commitEdits]);

  const scheduleCommit = useCallback(() => {
    if (editTimerRef.current !== null) window.clearTimeout(editTimerRef.current);
    editTimerRef.current = window.setTimeout(() => {
      editTimerRef.current = null;
      if (activeIndexRef.current !== null) {
        commitEdits(activeIndexRef.current);
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
      commitEdits(activeIndexRef.current);
    }
  }, [commitEdits]);

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
      <div className="sticky top-0 z-10 bg-[#FAFAFA]/95 backdrop-blur px-6 py-3 border-b border-[#EDEDED] shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#333]">预览卡片流</h3>
            <p className="text-[11px] text-[#999] mt-0.5 tabular-nums">
              {ready
                ? `共 ${pages.length} 张（封面 + ${Math.max(0, pages.length - 1)} 页正文）· ${cardW} × ${cardH}px`
                : '正在排版…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeIndex !== null && (
              <span className="card-edit-hint">编辑中 · 点击空白处退出</span>
            )}
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

        {/* Card edit toolbar (H1/H2/粗体/斜体/高亮/列表/引用/表情/图片) */}
        {activeIndex !== null && (
          <div className="mt-2 flex items-center justify-between gap-4 bg-white rounded-xhsCard border border-[#F0DDE1] px-3 py-1.5">
            <CardEditorToolbar
              target={activeTarget}
              onCommitted={() => {
                if (activeIndexRef.current !== null) {
                  commitEdits(activeIndexRef.current);
                }
              }}
            />
            <button
              type="button"
              className="text-[11px] text-[#999] hover:text-[#FF2442] cursor-pointer border-none bg-transparent transition-colors shrink-0"
              onClick={() => {
                flushPendingEdit();
                setActiveIndex(null);
                setActiveHtml('');
                setActiveTitleHtml('');
              }}
            >
              退出编辑
            </button>
          </div>
        )}
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
