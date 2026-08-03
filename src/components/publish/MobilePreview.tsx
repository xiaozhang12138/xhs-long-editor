import React from 'react';
import type { ArticleData, Template } from '../../types';
import { templates as templateData } from '../../data/templates';
import { useArticlePages } from '../../hooks/useArticlePages';
import { ArticlePage } from '../format/ArticlePage';

interface MobilePreviewProps {
  article: ArticleData;
}

/** Inner content width available inside the iPhone screen (px) */
const AVAIL_W = 232;

/**
 * iPhone mockup mobile preview component.
 * CSS-drawn phone frame with notch, home indicator.
 *
 * - 笔记预览: swipeable list of the auto-generated pages (cover + content),
 *   matching the pagination engine exactly.
 * - 封面预览: the generated cover page.
 */
export const MobilePreview: React.FC<MobilePreviewProps> = ({ article }) => {
  const [activeTab, setActiveTab] = React.useState<'note' | 'cover'>('note');
  const { pages, ready } = useArticlePages(article);

  const tpl: Template =
    templateData.find((t) => t.id === article.selectedTemplate) || templateData[0];
  const { width, height } = article.selectedSize;

  // Scale the selected real-size card down to fit the phone screen width.
  const r = Math.min(1, AVAIL_W / width);
  const cardW = Math.round(width * r);
  const cardH = Math.round(height * r);
  const radius = Math.max(0, Math.round(tpl.cardRadius * r));

  /** Scaled page card (keeps export-fidelity of ArticlePage but shrunk). */
  const renderScaledPage = (pageIndex: number): React.ReactNode => {
    const page = pages[pageIndex];
    if (!page) return null;
    return (
      <div
        style={{
          scrollSnapAlign: 'center',
          flexShrink: 0,
          width: cardW,
          height: cardH,
          overflow: 'hidden',
          borderRadius: radius,
          boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
          backgroundColor: tpl.bgColor,
        }}
      >
        <div
          style={{
            transform: `scale(${r})`,
            transformOrigin: 'top left',
            width,
            height,
          }}
        >
          <ArticlePage page={page} article={article} template={tpl} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      {/* Tab switcher */}
      <div className="flex bg-[#F5F5F5] rounded-full p-0.5 mb-4">
        <button
          type="button"
          className={`px-4 py-1.5 text-xs rounded-full cursor-pointer border-none transition-all duration-300 ease-out ${
            activeTab === 'note'
              ? 'bg-white text-[#333] shadow-sm font-medium'
              : 'text-[#999] bg-transparent hover:text-[#666]'
          }`}
          onClick={() => setActiveTab('note')}
        >
          笔记预览
        </button>
        <button
          type="button"
          className={`px-4 py-1.5 text-xs rounded-full cursor-pointer border-none transition-all duration-300 ease-out ${
            activeTab === 'cover'
              ? 'bg-white text-[#333] shadow-sm font-medium'
              : 'text-[#999] bg-transparent hover:text-[#666]'
          }`}
          onClick={() => setActiveTab('cover')}
        >
          封面预览
        </button>
      </div>

      {/* iPhone Mockup */}
      <div className="iphone-mockup">
        {/* Notch / dynamic island */}
        <div className="iphone-notch" />

        {/* Screen */}
        <div className="iphone-screen flex flex-col">
          {/* Status bar */}
          <div className="h-10 px-5 flex items-center justify-between text-[11px] font-medium text-black z-10">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <svg width="16" height="10" viewBox="0 0 16 10" fill="black">
                <path d="M1 3.5C1 2 2 1 4 1h8c2 0 3 1 3 2.5v3c0 1.5-1 2.5-3 2.5H4c-2 0-3-1-3-2.5v-3z" opacity="0.15" />
                <rect x="1" y="4" width="12" height="2" rx="1" />
                <rect x="14" y="2" width="1" height="6" rx="0.5" />
                <path d="M15 3l1 2-1 2" stroke="black" strokeWidth="0.7" fill="none" />
              </svg>
            </div>
          </div>

          {/* App header */}
          <div className="px-3 py-2 flex items-center gap-2 border-b border-[#F0F0F0]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="#666">
              <path d="M8 3L5 7l3 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
              健
            </div>
            <span className="text-[11px] text-[#333] font-medium">健康的蛤蟆</span>
            <button
              type="button"
              className="ml-auto px-2 py-0.5 text-[10px] rounded-full cursor-pointer border border-[#FF2442] text-[#FF2442] bg-transparent hover:bg-[#FFF0F2] transition-colors"
            >
              关注
            </button>
            <button type="button" className="cursor-pointer border-none bg-transparent p-0.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#999">
                <circle cx="7" cy="3" r="1.2" /><circle cx="7" cy="7" r="1.2" /><circle cx="7" cy="11" r="1.2" />
              </svg>
            </button>
          </div>

          {/* Content area (scrollable) */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'note' ? (
              /* Note preview — swipeable page list */
              <div className="py-3 flex flex-col items-center">
                {ready && pages.length > 0 ? (
                  <>
                    <div
                      className="w-full"
                      style={{
                        overflowX: 'auto',
                        scrollSnapType: 'x mandatory',
                        WebkitOverflowScrolling: 'touch',
                        paddingBottom: 4,
                      }}
                    >
                      <div className="flex gap-2" style={{ padding: '0 12px', width: 'max-content' }}>
                        {pages.map((_p, index) => (
                          <React.Fragment key={index}>{renderScaledPage(index)}</React.Fragment>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-[#999] mt-1.5 tabular-nums">
                      {pages.length} 张 · 左滑查看更多
                    </p>
                  </>
                ) : (
                  <div className="text-[11px] text-[#999] py-8">排版中…</div>
                )}

                {article.description && (
                  <p className="text-[12px] text-[#666] mt-3 leading-relaxed line-clamp-3 w-full px-3">
                    {article.description}
                  </p>
                )}

                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 w-full px-3">
                    {article.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] text-[#FF2442]">{tag}</span>
                    ))}
                    {article.tags.length > 3 && (
                      <span className="text-[10px] text-[#999]">+{article.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Cover preview */
              <div className="py-3 flex flex-col items-center">
                {ready && pages.length > 0 ? (
                  renderScaledPage(0)
                ) : (
                  <div className="text-[11px] text-[#999] py-8">排版中…</div>
                )}
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="px-4 py-2.5 border-t border-[#F0F0F0] flex items-center justify-between">
            <div className="flex items-center gap-4 text-[11px] text-[#999]">
              <span>收藏件车...</span>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" className="flex items-center gap-1 cursor-pointer border-none bg-transparent text-[#999] hover:text-[#FF2442] transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M9 16s-6.5-4.35-6.5-8.65C2.5 4.47 5.41 2 9 2s6.5 2.47 6.5 5.35C15.5 11.65 9 16 9 16z" />
                  <circle cx="9" cy="7.5" r="2" />
                </svg>
                <span className="text-[10px]">点赞</span>
              </button>
              <button type="button" className="flex items-center gap-1 cursor-pointer border-none bg-transparent text-[#999] hover:text-[#FFB800] transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M9 3L10.5 7H15L11.5 10L13 15L9 12L5 15L6.5 10L3 7H7.5L9 3z" />
                </svg>
                <span className="text-[10px]">收藏</span>
              </button>
              <button type="button" className="flex items-center gap-1 cursor-pointer border-none bg-transparent text-[#999] hover:text-[#333] transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M3 15h12M5 11l4-7 4 7" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="4" r="1.5" />
                </svg>
                <span className="text-[10px]">评论</span>
              </button>
            </div>
          </div>

          {/* Home indicator */}
          <div className="iphone-home-indicator" />
        </div>
      </div>
    </div>
  );
};
