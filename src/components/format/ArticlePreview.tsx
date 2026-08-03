import React, { useMemo } from 'react';
import type { ArticleData, Template } from '../../types';
import { templates as templateData } from '../../data/templates';

interface ArticlePreviewProps {
  article: ArticleData;
  currentPage: number;
  onPageChange: (page: number) => void;
}

/** Viewport budget for the two side-by-side cards (px) */
const VIEWPORT_W = 720;
const VIEWPORT_H = 470;

/**
 * Dual-page card preview for the format page.
 * Page 1: Cover + title + swipe hint
 * Page 2: Body content
 *
 * Cards render at their true pixel size and are then uniformly scaled
 * (transform: scale) so any selected size fits the fixed preview viewport.
 */
export const ArticlePreview: React.FC<ArticlePreviewProps> = ({
  article,
  currentPage,
  onPageChange,
}) => {
  const totalPages = 2;

  // Find selected template (fall back to the first so preview never breaks)
  const tpl: Template =
    templateData.find((t) => t.id === article.selectedTemplate) || templateData[0];

  const { width, height } = article.selectedSize;

  /** Uniform scale so both cards fit the viewport without distortion */
  const scale = useMemo(() => {
    const byWidth = VIEWPORT_W / (width * 2 + 24);
    const byHeight = VIEWPORT_H / height;
    return Math.min(1, byWidth, byHeight);
  }, [width, height]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPageChange(Number(e.target.value) >= 1 ? 2 : 1);
  };

  /** Cover swatch color driven by the cover color choice */
  const coverBg =
    article.coverColor === 'black'
      ? '#1A1A1A'
      : article.coverColor === 'beige'
        ? '#F5EDE0'
        : '#FFFFFF';

  /** Decorative accent rendered under/next to the heading */
  const renderDecoration = () => {
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
                style={{ width: 5, height: 5, backgroundColor: tpl.accentColor, opacity: 1 - i * 0.28 }}
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

  /** Card chrome shared by both pages */
  const cardStyle = (active: boolean): React.CSSProperties => ({
    width,
    height,
    backgroundColor: tpl.bgColor,
    borderRadius: tpl.cardRadius,
    fontFamily: tpl.fontFamily,
    color: tpl.textColor,
    padding: tpl.padding,
    letterSpacing: `${tpl.letterSpacing}em`,
    // Sidebar/corner decorations live on the card edge
    borderLeft:
      tpl.decorativeStyle === 'sidebar' ? `4px solid ${tpl.accentColor}` : undefined,
    borderTop:
      tpl.decorativeStyle === 'corner' ? `3px solid ${tpl.accentColor}` : undefined,
    boxShadow: active
      ? '0 10px 34px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'
      : '0 4px 16px rgba(0,0,0,0.07)',
    opacity: active ? 1 : 0.55,
    transition: 'opacity 260ms ease-out, box-shadow 260ms ease-out',
    overflow: 'hidden',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  });

  return (
    <div className="editor-cards-container flex-1 flex flex-col items-center justify-center p-6">
      {/* Scaled stage */}
      <div
        className="flex items-center justify-center"
        style={{ width: VIEWPORT_W, height: VIEWPORT_H }}
      >
        <div
          className="flex gap-6 items-start"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
          {/* Card 1 — Cover */}
          <div style={cardStyle(currentPage === 1)}>
            {/* Cover image area */}
            <div
              className="w-full shrink-0 overflow-hidden flex items-center justify-center"
              style={{
                height: Math.round(height * 0.42),
                borderRadius: Math.max(4, tpl.cardRadius - 4),
                backgroundColor: article.coverImage ? 'transparent' : coverBg,
                border: article.coverImage ? 'none' : `1px solid ${tpl.accentColor}22`,
                marginBottom: 20,
              }}
            >
              {article.coverImage ? (
                <img
                  src={article.coverImage}
                  alt="封面"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs" style={{ color: tpl.mutedColor }}>
                  封面图
                </span>
              )}
            </div>

            {/* Title */}
            <div style={{ textAlign: tpl.headingAlign }}>
              <h2
                style={{
                  fontSize: Math.round(tpl.baseFontSize * 1.7),
                  fontWeight: tpl.headingFontWeight,
                  lineHeight: 1.28,
                  color: tpl.textColor,
                  wordBreak: 'break-word',
                }}
              >
                {article.title || '未命名长文'}
              </h2>
              <span
                className="inline-flex"
                style={{ justifyContent: tpl.headingAlign === 'center' ? 'center' : 'flex-start' }}
              >
                {renderDecoration()}
              </span>
            </div>

            {/* Swipe hint */}
            <p
              className="mt-auto"
              style={{ fontSize: 12, color: tpl.mutedColor, textAlign: tpl.headingAlign }}
            >
              ← 左滑阅读 →
            </p>
          </div>

          {/* Card 2 — Body */}
          <div style={cardStyle(currentPage === 2)}>
            <div
              className="preview-body flex-1 overflow-hidden"
              style={{
                fontSize: tpl.baseFontSize,
                lineHeight: tpl.lineHeight,
                color: tpl.textColor,
              }}
            >
              {article.contentHtml ? (
                <div dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
              ) : (
                <p style={{ color: tpl.mutedColor }}>正文内容将显示在这里…</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slider + page indicator */}
      <div className="w-full max-w-[700px] mt-5 px-4">
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999] whitespace-nowrap">拖动滑块快速定位</span>
          <input
            type="range"
            min="0"
            max="1"
            value={currentPage - 1}
            onChange={handleSliderChange}
            className="flex-1 xhs-range"
            aria-label="预览页码"
          />
          <div className="flex items-center gap-1.5 text-xs text-[#999] tabular-nums">
            <span className={currentPage === 1 ? 'font-semibold text-[#333]' : ''}>1</span>
            <span>/</span>
            <span className={currentPage === 2 ? 'font-semibold text-[#333]' : ''}>2</span>
            <span className="ml-1">共{totalPages}张</span>
          </div>
        </div>

        {/* Size + scale readout */}
        <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-[#BBB] tabular-nums">
          <span>
            {width} × {height} px
          </span>
          {scale < 1 && <span>· 预览缩放 {Math.round(scale * 100)}%</span>}
        </div>
      </div>
    </div>
  );
};
