import React, { useState } from 'react';
import type { ArticleData } from '../../types';
import { PageCardStream } from './PageCardStream';
import { TemplateSelector } from './TemplateSelector';
import { CoverSettings } from './CoverSettings';
import { SizeSelector } from './SizeSelector';
import { PaginationPanel } from './PaginationPanel';

interface FormatPageProps {
  article: ArticleData;
  onTemplateSelect: (id: string) => void;
  onCoverColorChange: (color: string) => void;
  /** Set / clear the uploaded cover image (null = auto cover). */
  onCoverChange: (image: string | null) => void;
  onCoverSettingsChange: (patch: Partial<ArticleData>) => void;
  onManualPageBreaksChange: (breaks: string[]) => void;
  onSelectSizePreset: (presetId: string) => void;
  onCustomWidthChange: (width: number) => void;
  onCustomHeightChange: (height: number) => void;
  /** Merge click-to-edit card changes back into the store. */
  onContentChange: (content: string, html: string) => void;
  /** Update the title from the editable cover card. */
  onTitleChange: (title: string) => void;
  /** Success toast callback (wired from App). */
  onToast?: (message: string) => void;
  onNext: () => void;
  onBack: () => void;
  onDraftLeave: () => void;
}

type PanelTab = 'template' | 'pagination' | 'cover' | 'size';

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'template', label: '选择模板' },
  { id: 'pagination', label: '分页' },
  { id: 'cover', label: '封面设置' },
  { id: 'size', label: '尺寸' },
];

/**
 * Stage 2: Format / layout settings page.
 * Left: multi-page card stream (cover + every paginated content page),
 * with per-page PNG download and one-click zip export.
 * Right: template / cover / size settings panel.
 */
export const FormatPage: React.FC<FormatPageProps> = ({
  article,
  onTemplateSelect,
  onCoverColorChange,
  onCoverChange,
  onCoverSettingsChange,
  onManualPageBreaksChange,
  onSelectSizePreset,
  onCustomWidthChange,
  onCustomHeightChange,
  onContentChange,
  onTitleChange,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('template');

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Left: horizontal dual-card preview stream (click-to-edit) */}
      <div className="flex-1 min-h-0 flex flex-col border-r border-[#EDEDED] bg-[#FAFAFA] overflow-hidden">
        <PageCardStream
          article={article}
          onContentChange={onContentChange}
          onTitleChange={onTitleChange}
          onToast={onToast}
          onManualPageBreaksChange={onManualPageBreaksChange}
        />
      </div>

      {/* Right: Settings panel */}
      <div className="w-[348px] flex flex-col bg-white shrink-0">
        {/* Panel header with tabs */}
        <div className="flex items-center justify-between px-5 pt-3 border-b border-[#EFEFEF]">
          <div className="flex gap-5" role="tablist">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`panel-tab ${active ? 'panel-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'template' && (
            <TemplateSelector
              selectedId={article.selectedTemplate}
              onSelect={onTemplateSelect}
            />
          )}
          {activeTab === 'cover' && (
            <CoverSettings
              article={article}
              onSettingsChange={onCoverSettingsChange}
              onColorChange={onCoverColorChange}
              onCoverChange={onCoverChange}
            />
          )}
          {activeTab === 'pagination' && (
            <PaginationPanel
              article={article}
              onManualPageBreaksChange={onManualPageBreaksChange}
            />
          )}
          {activeTab === 'size' && (
            <SizeSelector
              size={article.selectedSize}
              onSelectPreset={onSelectSizePreset}
              onWidthChange={onCustomWidthChange}
              onHeightChange={onCustomHeightChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};
