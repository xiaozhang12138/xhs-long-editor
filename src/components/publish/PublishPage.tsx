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

/**
 * Stage 3: Final preparation page with two-column layout.
 * Center: cover / title / description / topic fields for manual publishing
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
  const [mobileOpen, setMobileOpen] = useState(true);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main publishing information */}
      <main className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="max-w-[760px] mx-auto px-8 py-6">
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
            <h2 className="text-xl font-bold text-[#333] leading-tight">
              {article.title || '未命名长文'}
            </h2>
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
