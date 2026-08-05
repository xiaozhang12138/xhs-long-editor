import React, { useState } from 'react';
import type { ArticleData } from '../../types';
import { ImageUploader } from './ImageUploader';
import { TopicTags } from './TopicTags';
import { MobilePreview } from './MobilePreview';

interface PublishPageProps {
  article: ArticleData;
  onCoverChange: (image: string | null) => void;
  onDescriptionChange: (desc: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  /** Navigate back to Stage 2 (format page). Article state is preserved. */
  onBack: () => void;
}

/** Sidebar menu items for publish page */
const sidebarItems = [
  { id: 'publish', label: '发布笔记', icon: 'note', active: true, hasDropdown: true },
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'notes', label: '笔记管理', icon: 'document' },
  { id: 'builder', label: 'Builder hub', icon: 'code', expandable: true },
  { id: 'redskill', label: 'Red Skill', icon: 'code-alt' },
  { id: 'data', label: '数据看板', icon: 'chart', expandable: true },
  { id: 'activity', label: '活动中心', icon: 'calendar' },
  { id: 'inspiration', label: '笔记灵感', icon: 'lightbulb' },
  { id: 'academy', label: '创作学院', icon: 'graduation' },
  { id: 'wiki', label: '创作百科', icon: 'book' },
];

/**
 * Stage 3: Final publish page with three-column layout.
 * Left: navigation sidebar
 * Center: form content (封面 / 标题 / 描述 / 话题 only — P1-5 removed the
 *         content-settings and plugin sections for the self-use tool)
 * Right: iPhone mockup preview (collapsible, default expanded)
 */
export const PublishPage: React.FC<PublishPageProps> = ({
  article,
  onCoverChange,
  onDescriptionChange,
  onAddTag,
  onRemoveTag,
  onBack,
}) => {
  const [showSmartTitle, setShowSmartTitle] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(true);

  /** Render a sidebar icon by name */
  const renderIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      note: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="3" y="2" width="12" height="14" rx="2" />
          <path d="M6 6h6M6 9h6M6 12h4" strokeLinecap="round" />
        </svg>
      ),
      home: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M3 8l6-5 6 5v7a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
          <path d="M1 10l2-2M17 10l-2-2" />
        </svg>
      ),
      document: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="4" y="2" width="10" height="14" rx="1" />
          <path d="M7 6h4M7 9h4M7 12h2" strokeLinecap="round" />
        </svg>
      ),
      code: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M7 4L3 9l4 5M11 4l4 5-4 5" />
        </svg>
      ),
      'code-alt': (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M12 4l4 5-4 5M6 4L2 9l4 5" />
          <line x1="9" y1="3" x2="9" y2="15" />
        </svg>
      ),
      chart: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="3" y="9" width="3" height="6" rx="0.5" />
          <rect x="7.5" y="5" width="3" height="10" rx="0.5" />
          <rect x="12" y="2" width="3" height="13" rx="0.5" />
        </svg>
      ),
      calendar: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="3" y="4" width="12" height="11" rx="2" />
          <path d="M3 7h12M6 2v3M12 2v3" strokeLinecap="round" />
        </svg>
      ),
      lightbulb: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M9 2a5 5 0 00-3.5 8.55c.5.55.85 1.23 1 1.95H11.5c.15-.72.5-1.4 1-1.95A5 5 0 009 2z" />
          <path d="M7 15h4M8 17h2" strokeLinecap="round" />
        </svg>
      ),
      graduation: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M2 6l7 4 7-4-7-4-7 4zM4 8v5c0 1 2 2 5 2s5-1 5-2V8" />
          <path d="M16 6v5" />
        </svg>
      ),
      book: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2" />
          <path d="M9 3v14M4 7h5M4 11h5" strokeLinecap="round" />
        </svg>
      ),
    };
    return icons[iconName] || null;
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Sidebar (~160px) */}
      <aside className="w-[160px] bg-white border-r border-[#E8E8E8] flex flex-col py-4 px-3 overflow-y-auto shrink-0">
        {/* Active item: 发布笔记 */}
        <button
          type="button"
          className="sidebar-item active mb-1"
        >
          {renderIcon('note')}
          <span>发布笔记</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="ml-auto opacity-80">
            <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Other items */}
        {sidebarItems.slice(1).map((item) => (
          <button
            key={item.id}
            type="button"
            className="sidebar-item"
          >
            {renderIcon(item.icon)}
            <span>{item.label}</span>
            {item.expandable && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="#999" className="ml-auto">
                <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}

        {/* Bottom: collapse toggle */}
        <div className="mt-auto pt-4 border-t border-[#F0F0F0]">
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-[#999] cursor-pointer border-none bg-transparent hover:text-[#666]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M2 5h10M2 9h6" strokeLinecap="round" />
            </svg>
            收起侧边栏
          </button>
        </div>
      </aside>

      {/* Center: Main content (~724px) */}
      <main className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="max-w-[724px] mx-auto px-8 py-6">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-[#666] hover:text-[#333] cursor-pointer border-none bg-transparent mb-6 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>返回</span>
          </button>

          {/* Image editor section */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-[#333] mb-3">图片编辑</h3>
            <ImageUploader image={article.coverImage} onChange={onCoverChange} />
          </section>

          {/* Title display */}
          <section className="mb-6">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold text-[#333] leading-tight">
                {article.title || '未命名长文'}
              </h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSmartTitle(!showSmartTitle)}
                  className="flex items-center gap-1 text-sm text-[#FF2442] cursor-pointer border-none bg-transparent hover:underline whitespace-nowrap ml-4"
                >
                  ✨ 智能标题
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="#FF2442">
                    <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showSmartTitle && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xhsCard shadow-lg border border-[#E8E8E8] p-3 z-20">
                    <p className="text-xs text-[#666]">AI 将根据内容智能生成标题建议</p>
                    <button
                      type="button"
                      className="mt-2 w-full px-3 py-1.5 text-xs bg-[#FFF0F2] text-[#FF2442] rounded-xhs cursor-pointer border-none hover:bg-[#FFE0E5] transition-colors"
                    >
                      生成建议
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Description input */}
          <section className="mb-6">
            <textarea
              value={article.description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="输入正文描述，真诚有价值的分享令人温暖"
              rows={3}
              maxLength={1000}
              className="w-full text-sm border border-[#E8E8E8] rounded-xhs px-4 py-3 bg-white text-[#333] outline-none resize-y placeholder-[#CCCCCC] focus:border-[#FF2442] transition-colors"
            />
          </section>

          {/* Topic tags */}
          <section className="mb-6">
            <TopicTags tags={article.tags} onAdd={onAddTag} onRemove={onRemoveTag} />
          </section>
        </div>
      </main>

      {/* Right: Mobile preview (collapsible — P1-5) */}
      <aside
        className={`${
          mobileOpen ? 'w-[360px]' : 'w-[52px]'
        } bg-[#F5F5F5] border-l border-[#E8E8E8] flex flex-col shrink-0 transition-[width] duration-200 overflow-hidden`}
      >
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8] bg-white cursor-pointer border-x-0 border-t-0"
          title={mobileOpen ? '收起手机预览' : '展开手机预览'}
        >
          <span className={`text-xs font-medium text-[#333] ${mobileOpen ? '' : 'hidden'}`}>
            手机预览
          </span>
          {!mobileOpen && (
            <span className="text-xs font-medium text-[#333] [writing-mode:vertical-rl] tracking-widest">
              手机预览
            </span>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`transition-transform duration-200 ${mobileOpen ? '' : 'rotate-180'} shrink-0`}
          >
            <path
              d={mobileOpen ? 'M7.5 3L4 6l3.5 3' : 'M4.5 3L8 6l-3.5 3'}
              stroke="#999"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {mobileOpen && (
          <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col items-center">
            <MobilePreview article={article} />
          </div>
        )}
      </aside>
    </div>
  );
};
