import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ArticleData, Template } from '../../types';
import type {
  PageBlock,
  PageResult,
  RichTextNode,
  TextMark,
} from '../../utils/pagination';

interface ArticlePageProps {
  page: PageResult;
  article: ArticleData;
  template: Template;
  /** 1-based page number shown in the top-left badge (1/N, 2/N…). */
  pageNumber?: number;
  /** Total pages, for the badge denominator. */
  totalPages?: number;
  /** Card is the active click-to-edit card. */
  active?: boolean;
  /**
   * Captured innerHTML of the card content area while it is being edited.
   * When provided, the content area renders as a live contentEditable.
   */
  editableHtml?: string;
  /** Fired (debounced upstream) when the user types in the active card. */
  onContentInput?: (html: string) => void;
  /** Fired when the cover title is edited. */
  onTitleInput?: (text: string) => void;
  /** Called when an image resize gesture ends (commit to store). */
  onImageResizeCommit?: () => void;
  /** Mouse-down handler used by the parent to activate the card. */
  onCardMouseDown?: (e: React.MouseEvent, index: number) => void;
}

/**
 * Renders a single fixed-size card (page) at its real pixel size.
 *
 * - Cover page (isCover): auto cover (template bg + title + decoration) or
 *   the uploaded cover image (full-bleed with title overlay).
 * - Content page: the paginated blocks rendered with the template theme.
 *
 * The outer element is exactly `width × height` px so html-to-image can
 * capture it pixel-perfectly. Every block element carries `data-block-id`
 * so the click-to-edit merge-back can map DOM edits back to the source doc.
 */
export const ArticlePage: React.FC<ArticlePageProps> = ({
  page,
  article,
  template: tpl,
  pageNumber = 1,
  totalPages = 1,
  active = false,
  editableHtml,
  onContentInput,
  onTitleInput,
  onImageResizeCommit,
  onCardMouseDown,
}) => {
  const { width, height } = article.selectedSize;
  const base = tpl.baseFontSize;
  const isEditable = active && editableHtml !== undefined && !page.isCover;

  // ── Image selection + resize inside the active card ────────────────
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedImg, setSelectedImg] = useState<{
    src: string;
    left: number;
    top: number;
    w: number;
    h: number;
  } | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  /** Card chrome shared by cover and content pages. */
  const cardStyle = (overrides: React.CSSProperties = {}): React.CSSProperties => ({
    width,
    height,
    backgroundColor: tpl.bgColor,
    borderRadius: tpl.cardRadius,
    fontFamily: tpl.fontFamily,
    color: tpl.textColor,
    letterSpacing: `${tpl.letterSpacing}em`,
    borderLeft:
      tpl.decorativeStyle === 'sidebar' ? `4px solid ${tpl.accentColor}` : undefined,
    borderTop:
      tpl.decorativeStyle === 'corner' ? `3px solid ${tpl.accentColor}` : undefined,
    overflow: 'hidden',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    ...overrides,
  });

  /** Root classes: template theme + CSS pattern + render-mode state. */
  const rootClassName = [
    'card-outer-container',
    tpl.themeClass,
    `pattern-${tpl.backgroundPattern}`,
    active ? 'active' : 'render-mode-disabled',
  ].join(' ');

  /** Decorative accent rendered under/next to the heading. */
  const renderDecoration = (): React.ReactNode => {
    switch (tpl.decorativeStyle) {
      case 'underline':
        return (
          <span
            className="block mt-3 rounded-full"
            style={{ width: 48, height: 3, backgroundColor: tpl.accentColor }}
          />
        );
      case 'dotted':
        return (
          <span className="flex gap-1.5 mt-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  backgroundColor: tpl.accentColor,
                  opacity: 1 - i * 0.28,
                }}
              />
            ))}
          </span>
        );
      case 'gradient':
        return (
          <span
            className="block mt-3 rounded-full"
            style={{
              width: 72,
              height: 4,
              background: `linear-gradient(90deg, ${tpl.accentColor}, transparent)`,
            }}
          />
        );
      case 'block':
        return (
          <span
            className="block mt-3"
            style={{ width: 28, height: 8, backgroundColor: tpl.accentColor }}
          />
        );
      default:
        return null;
    }
  };

  /** Cover title decoration (CSS-drawn, distinct per template). */
  const renderTitleDecoration = (): React.ReactNode => {
    switch (tpl.titleDecoration) {
      case 'quote':
        return (
          <span
            className="block select-none"
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: 88,
              lineHeight: 0.7,
              color: tpl.accentColor,
              opacity: 0.85,
              marginBottom: 6,
            }}
          >
            “
          </span>
        );
      case 'color-block':
        return (
          <span
            className="block select-none rounded-md"
            style={{
              width: 46,
              height: 10,
              backgroundColor: tpl.accentColor,
              marginBottom: 10,
              boxShadow: '10px 14px 0 -4px #3E5C76',
            }}
          />
        );
      case 'paper':
        return (
          <span
            className="block select-none"
            style={{
              display: 'inline-block',
              fontSize: 12,
              color: '#8A6F4F',
              backgroundColor: 'rgba(242,227,200,0.9)',
              border: '1px solid rgba(176,137,104,0.5)',
              borderRadius: 4,
              padding: '4px 12px',
              marginBottom: 10,
              transform: 'rotate(-0.6deg)',
              boxShadow: '1px 2px 0 rgba(0,0,0,0.06)',
            }}
          >
            ✎ 手帐札记
          </span>
        );
      case 'line':
        return (
          <span
            className="block select-none"
            style={{
              height: 3,
              width: 64,
              background: `linear-gradient(90deg, ${tpl.accentColor}, transparent)`,
              marginBottom: 12,
              borderRadius: 2,
            }}
          />
        );
      case 'corner':
        return (
          <span
            className="block select-none"
            style={{ color: tpl.accentColor, fontSize: 30, lineHeight: 1, marginBottom: 4 }}
          >
            ⌜
          </span>
        );
      case 'frame':
        return (
          <span
            className="inline-block select-none rounded-lg"
            style={{
              padding: '4px 10px',
              border: `2px solid ${tpl.accentColor}`,
              marginBottom: 10,
              fontSize: 11,
              color: tpl.accentColor,
              letterSpacing: '0.2em',
            }}
          >
            FRAME
          </span>
        );
      case 'underline-block':
        return (
          <span
            className="block select-none"
            style={{
              height: 4,
              width: 56,
              backgroundColor: tpl.accentColor,
              borderRadius: 2,
              marginBottom: 10,
              boxShadow: '0 6px 0 -2px rgba(255,36,66,0.25)',
            }}
          />
        );
      case 'circle':
        return (
          <span
            className="inline-block select-none rounded-full"
            style={{
              width: 26,
              height: 26,
              border: `4px solid ${tpl.accentColor}`,
              opacity: 0.85,
              marginBottom: 8,
            }}
          />
        );
      case 'bracket':
        return (
          <span
            className="select-none"
            style={{ color: tpl.accentColor, fontSize: 26, lineHeight: 1, marginRight: 6 }}
          >
            《
          </span>
        );
      case 'masthead':
        return (
          <span
            className="block select-none"
            style={{
              fontSize: 10,
              letterSpacing: '0.34em',
              color: tpl.accentColor,
              borderTop: `2px solid ${tpl.accentColor}`,
              borderBottom: `2px solid ${tpl.accentColor}`,
              padding: '3px 0',
              marginBottom: 10,
              display: 'inline-block',
              fontWeight: 700,
            }}
          >
            MAGAZINE
          </span>
        );
      case 'number-block':
        return (
          <span
            className="inline-flex select-none items-center justify-center rounded-md"
            style={{
              width: 30,
              height: 30,
              backgroundColor: tpl.accentColor,
              color: '#fff',
              fontWeight: 800,
              fontSize: 16,
              marginRight: 8,
              verticalAlign: 'middle',
            }}
          >
            01
          </span>
        );
      case 'leaf':
        return (
          <span className="select-none" style={{ color: tpl.accentColor, fontSize: 22, marginRight: 6 }}>
            ❀
          </span>
        );
      case 'tag':
        return (
          <span
            className="inline-block select-none"
            style={{
              fontSize: 11,
              color: '#5A4E40',
              backgroundColor: tpl.coverBgColor,
              border: '1px solid rgba(138,128,116,0.4)',
              padding: '3px 10px',
              borderRadius: '2px 10px 10px 2px',
              marginBottom: 10,
            }}
          >
            # 札记
          </span>
        );
      case 'mosaic':
        return (
          <span className="inline-flex select-none gap-1" style={{ marginBottom: 10 }}>
            <span style={{ width: 12, height: 12, backgroundColor: '#FF6B6B', borderRadius: 3 }} />
            <span style={{ width: 12, height: 12, backgroundColor: '#4ECDC4', borderRadius: 3 }} />
            <span style={{ width: 12, height: 12, backgroundColor: '#FFE66D', borderRadius: 3 }} />
          </span>
        );
      case 'block':
        return (
          <span
            className="block select-none"
            style={{
              width: 34,
              height: 8,
              backgroundColor: tpl.accentColor,
              marginBottom: 10,
            }}
          />
        );
      case 'rings':
        return (
          <span
            className="inline-block select-none rounded-full"
            style={{
              width: 26,
              height: 26,
              border: `3px solid ${tpl.accentColor}`,
              boxShadow: '0 0 0 6px rgba(45,212,191,0.15), 0 0 0 12px rgba(45,212,191,0.08)',
              marginBottom: 8,
            }}
          />
        );
      default:
        return null;
    }
  };

  // ── image selection inside the active card ─────────────────────────
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!active) return;
      const img = (e.target as HTMLElement).closest('img') as HTMLImageElement | null;
      if (!img) return;
      const card = contentRef.current?.closest('.card-outer-container') as HTMLElement | null;
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      // Position relative to the unscaled card: account for the CSS scale.
      const scaleX = card.offsetWidth / Math.max(1, cardRect.width);
      const scaleY = card.offsetHeight / Math.max(1, cardRect.height);
      setSelectedImg({
        src: img.src,
        left: (imgRect.left - cardRect.left) * scaleX,
        top: (imgRect.top - cardRect.top) * scaleY,
        w: img.offsetWidth,
        h: img.offsetHeight,
      });
    },
    [active]
  );

  // Re-apply the selection outline after re-render (innerHTML resets DOM).
  useEffect(() => {
    if (!selectedImg || !contentRef.current) return;
    const imgs = contentRef.current.querySelectorAll('img');
    imgs.forEach((im) => im.classList.toggle('card-img-selected', im.src === selectedImg.src));
    return () => {
      imgs.forEach((im) => im.classList.remove('card-img-selected'));
    };
  }, [selectedImg]);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedImg) return;
      const img = contentRef.current?.querySelector(
        `img[src="${selectedImg.src}"]`
      ) as HTMLImageElement | null;
      if (!img) return;
      dragRef.current = { startX: e.clientX, startW: img.offsetWidth };
      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current || !contentRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const maxW = contentRef.current.offsetWidth;
        const newW = Math.max(60, Math.min(maxW, dragRef.current.startW + dx));
        img.style.width = `${Math.round(newW)}px`;
        img.style.height = 'auto';
      };
      const onUp = () => {
        dragRef.current = null;
        onImageResizeCommit?.();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [selectedImg, onImageResizeCommit]
  );

  // ── Cover page ──────────────────────────────────────────────────────
  if (page.isCover) {
    if (article.coverImage) {
      return (
        <div
          className={rootClassName}
          style={cardStyle({ padding: 0, backgroundColor: '#111' })}
          onMouseDown={(e) => onCardMouseDown?.(e, page.pageIndex)}
        >
          <img
            src={article.coverImage}
            alt="封面"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <span className="card-page-badge">
            {pageNumber}/{totalPages}
          </span>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: tpl.padding,
              paddingTop: 56,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.62) 100%)',
            }}
          >
            <h2
              className="xhs-cover-title-editable"
              contentEditable={active}
              suppressContentEditableWarning
              onInput={(e) => onTitleInput?.((e.target as HTMLElement).innerText)}
              style={{
                fontSize: Math.round(base * 1.7),
                fontWeight: tpl.headingFontWeight,
                lineHeight: 1.28,
                color: '#FFFFFF',
                wordBreak: 'break-word',
                margin: 0,
              }}
            >
              {article.title || '未命名长文'}
            </h2>
          </div>
        </div>
      );
    }

    // Auto cover: template background + title + decoration.
    const coverBg = tpl.coverBgColor;
    const titleEditable = active;
    return (
      <div
        className={rootClassName}
        style={cardStyle({ padding: tpl.padding })}
        onMouseDown={(e) => onCardMouseDown?.(e, page.pageIndex)}
      >
        <span className="card-page-badge">
          {pageNumber}/{totalPages}
        </span>
        <div className="xhs-card-inner" style={{ padding: 0 }}>
          <div
            className="w-full shrink-0 overflow-hidden flex items-center justify-center"
            style={{
              height: Math.round(height * 0.42),
              borderRadius: Math.max(4, tpl.cardRadius - 4),
              backgroundColor: coverBg,
              border: `1px solid ${tpl.accentColor}22`,
              marginBottom: 20,
            }}
          >
            <span className="text-xs" style={{ color: tpl.mutedColor }}>
              封面图
            </span>
          </div>

          <div style={{ textAlign: tpl.headingAlign }}>
            {renderTitleDecoration()}
            <h2
              className="xhs-cover-title-editable"
              contentEditable={titleEditable}
              suppressContentEditableWarning
              onInput={(e) => onTitleInput?.((e.target as HTMLElement).innerText)}
              style={{
                fontSize: Math.round(base * 1.7),
                fontWeight: tpl.headingFontWeight,
                lineHeight: 1.28,
                color: tpl.textColor,
                wordBreak: 'break-word',
                margin: 0,
              }}
            >
              {article.title || '未命名长文'}
            </h2>
            <span
              className="inline-flex"
              style={{
                justifyContent:
                  tpl.headingAlign === 'center' ? 'center' : 'flex-start',
              }}
            >
              {renderDecoration()}
            </span>
          </div>

          <p
            className="mt-auto"
            style={{
              fontSize: 12,
              color: tpl.mutedColor,
              textAlign: tpl.headingAlign,
            }}
          >
            ← 左滑阅读 →
          </p>
        </div>
      </div>
    );
  }

  // ── Content page ────────────────────────────────────────────────────
  return (
    <div
      className={rootClassName}
      style={cardStyle({ padding: tpl.padding })}
      onMouseDown={(e) => onCardMouseDown?.(e, page.pageIndex)}
    >
      <span className="card-page-badge">
        {pageNumber}/{totalPages}
      </span>
      <div className="xhs-card-inner" style={{ padding: 0 }}>
        {isEditable && editableHtml !== undefined ? (
          /* Live contentEditable mode (click-to-edit) — no React children,
             only dangerouslySetInnerHTML, so the caret is never clobbered. */
          <div
            ref={contentRef}
            className="xhs-card-content flex-1 overflow-hidden"
            style={{
              fontSize: base,
              lineHeight: tpl.lineHeight,
              color: tpl.textColor,
            }}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onContentInput?.((e.target as HTMLElement).innerHTML)}
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: editableHtml }}
          />
        ) : (
          /* Render-mode-disabled (read-only render, contenteditable 不生效) */
          <div
            ref={contentRef}
            className="xhs-card-content flex-1 overflow-hidden"
            style={{
              fontSize: base,
              lineHeight: tpl.lineHeight,
              color: tpl.textColor,
            }}
            onClick={handleContentClick}
          >
            {page.blocks.length === 0 ? (
              <p style={{ color: tpl.mutedColor, margin: 0 }}>正文内容将显示在这里…</p>
            ) : (
              renderBlocks(page.blocks, tpl)
            )}
          </div>
        )}
      </div>

      {/* Image resize handle (active card only) */}
      {active && selectedImg && (
        <div
          className="card-img-resize-handle"
          style={{
            left: selectedImg.left + selectedImg.w - 8,
            top: selectedImg.top + selectedImg.h - 8,
          }}
          onPointerDown={handleResizePointerDown}
        />
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────
 * Block renderers
 * ────────────────────────────────────────────────────────────────────── */

/** Convert a rich-text node list into styled spans (marks → styles). */
function renderRichTextNodes(
  nodes: RichTextNode[],
  tpl: Template,
  baseStyle: React.CSSProperties = {}
): React.ReactNode {
  return (
    <>
      {nodes.map((node, i) => {
        const style: React.CSSProperties = { ...baseStyle };
        const decorations: string[] = [];
        let href: string | undefined;
        let color: string | undefined;
        for (const mark of node.marks ?? []) {
          applyMark(mark, style, decorations, tpl);
          if (mark.type === 'link') {
            href = (mark.attrs?.href as string) || undefined;
          }
          if (mark.type === 'textStyle' && mark.attrs?.color) {
            color = mark.attrs.color as string;
          }
        }
        if (color) style.color = color;
        if (decorations.length) style.textDecorationLine = decorations.join(' ');

        const segments = node.text.split('\n');
        const content = segments.map((seg, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {seg}
          </React.Fragment>
        ));

        if (href) {
          return (
            <a
              key={i}
              href={href}
              style={{
                color: color || '#FF2442',
                textDecorationLine: decorations.join(' ') || 'underline',
              }}
            >
              {content}
            </a>
          );
        }
        return (
          <span key={i} style={style}>
            {content}
          </span>
        );
      })}
    </>
  );
}

/** Apply a single mark to a style object (template-aware bold). */
function applyMark(
  mark: TextMark,
  style: React.CSSProperties,
  decorations: string[],
  tpl: Template
): void {
  switch (mark.type) {
    case 'bold':
      applyBoldStyle(style, tpl);
      break;
    case 'italic':
      style.fontStyle = 'italic';
      break;
    case 'underline':
      decorations.push('underline');
      break;
    case 'strike':
      decorations.push('line-through');
      break;
    case 'highlight':
      style.backgroundColor = (mark.attrs?.color as string) ?? '#FEF3C7';
      style.borderRadius = 3;
      style.padding = '0 2px';
      break;
    case 'textStyle':
      if (mark.attrs?.fontSize) style.fontSize = mark.attrs.fontSize as string;
      break;
    default:
      break;
  }
}

/** Per-template bold emphasis (原版实测各模板加粗处理不同). */
function applyBoldStyle(style: React.CSSProperties, tpl: Template): void {
  switch (tpl.boldStyle) {
    case 'highlight':
      style.fontWeight = 600;
      style.backgroundColor = tpl.boldColor;
      style.borderRadius = 3;
      style.padding = '0 3px';
      break;
    case 'underline':
      style.fontWeight = 600;
      style.textDecorationLine = 'underline';
      style.textDecorationColor = tpl.boldColor;
      style.textDecorationThickness = 2;
      style.textUnderlineOffset = 3;
      break;
    case 'color':
      style.fontWeight = 700;
      style.color = tpl.boldColor;
      break;
    case 'scale':
      style.fontWeight = 800;
      style.fontSize = '1.12em';
      break;
    case 'serif':
      style.fontWeight = 700;
      style.fontFamily = "'Noto Serif SC', 'Songti SC', serif";
      break;
    case 'shadow':
      style.fontWeight = 600;
      style.textShadow = `1px 1px 0 ${tpl.boldColor}55`;
      break;
    case 'double':
      style.fontWeight = 600;
      style.textDecorationLine = 'underline';
      style.textDecorationStyle = 'double';
      style.textDecorationColor = tpl.boldColor;
      break;
    case 'marker':
      style.fontWeight = 500;
      style.backgroundColor = tpl.boldColor;
      style.padding = '0 4px';
      style.borderRadius = 6;
      style.boxDecorationBreak = 'clone';
      style.WebkitBoxDecorationBreak = 'clone';
      break;
    case 'combo':
      style.fontWeight = 800;
      style.color = tpl.boldColor;
      break;
    default:
      style.fontWeight = 700;
  }
}

/** Heading accent bar rendered under content headings. */
function HeadingAccent({ color }: { color: string }): React.ReactElement {
  return (
    <span
      className="block mt-2 rounded-full"
      style={{ width: 32, height: 3, backgroundColor: color }}
    />
  );
}

/** Render a page's blocks with template theming + data-block-id tags. */
function renderBlocks(blocks: PageBlock[], tpl: Template): React.ReactNode {
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.type === 'list') {
      // Group consecutive list items of the same kind into one <ul>/<ol>.
      const kind = block.listKind;
      const items: Extract<PageBlock, { type: 'list' }>[] = [];
      let cursor = i;
      let current = blocks[cursor];
      while (
        cursor < blocks.length &&
        current.type === 'list' &&
        current.listKind === kind
      ) {
        items.push(current);
        cursor += 1;
        current = blocks[cursor];
      }
      i = cursor;
      const Tag = kind === 'bullet' ? 'ul' : 'ol';
      out.push(
        <Tag
          key={`list-${i}-${kind}`}
          style={{
            paddingLeft: 22,
            margin: '8px 0',
            lineHeight: tpl.lineHeight,
          }}
        >
          {items.map((item) => (
            <li key={item.id} data-block-id={item.id} style={{ margin: '4px 0' }}>
              {renderRichTextNodes(item.nodes, tpl)}
            </li>
          ))}
        </Tag>
      );
      continue;
    }

    switch (block.type) {
      case 'text':
        out.push(
          <p key={block.id} data-block-id={block.id} style={{ margin: '8px 0' }}>
            {renderRichTextNodes(block.nodes, tpl)}
          </p>
        );
        break;
      case 'heading': {
        const scale = block.level === 1 ? 1.6 : 1.35;
        const fs = Math.round((block.fontSize ?? tpl.baseFontSize) * scale);
        const Tag = block.level === 1 ? 'h1' : 'h2';
        out.push(
          <div
            key={block.id}
            style={{ margin: block.level === 1 ? '16px 0 10px' : '12px 0 8px' }}
          >
            <Tag
              data-block-id={block.id}
              style={{
                fontSize: fs,
                fontWeight: tpl.headingFontWeight,
                lineHeight: 1.35,
                color: tpl.textColor,
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              {renderRichTextNodes(block.nodes, tpl)}
            </Tag>
            {tpl.decorativeStyle !== 'none' && (
              <HeadingAccent color={tpl.accentColor} />
            )}
          </div>
        );
        break;
      }
      case 'quote':
        out.push(
          <blockquote
            key={block.id}
            data-block-id={block.id}
            style={{
              borderLeft: `3px solid ${tpl.accentColor}`,
              paddingLeft: 14,
              margin: '12px 0',
              color: tpl.mutedColor,
              backgroundColor: `${tpl.accentColor}0F`,
              borderRadius: 4,
              paddingTop: 8,
              paddingBottom: 8,
            }}
          >
            {renderRichTextNodes(block.nodes, tpl)}
          </blockquote>
        );
        break;
      case 'image': {
        out.push(
          <div key={block.id} data-block-id={block.id} style={{ margin: '10px 0', textAlign: 'center' }}>
            <img
              src={block.src}
              alt={block.alt || ''}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: block.displayWidth ? `${block.displayWidth}px` : 'auto',
                height: block.displayHeight ? `${block.displayHeight}px` : 'auto',
                borderRadius: 8,
                objectFit: 'contain',
              }}
            />
          </div>
        );
        break;
      }
      case 'divider':
        out.push(
          <hr
            key={block.id}
            data-block-id={block.id}
            style={{
              border: 'none',
              borderTop: `1px solid ${tpl.mutedColor}44`,
              margin: '18px 0',
            }}
          />
        );
        break;
      default:
        break;
    }
    i += 1;
  }

  return out;
}

export default ArticlePage;
