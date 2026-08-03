import React from 'react';
import { Toolbar } from '../editor/Toolbar';

interface EditorHeaderProps {
  onBack?: () => void;
  showToolbar?: boolean;
  editor: any; // TipTap Editor instance
  /** Optional actions rendered at the right end of the header (e.g. 草稿列表). */
  rightActions?: React.ReactNode;
}

/**
 * Editor header with back button and toolbar.
 * Used in Stage 1 (Editor) and Stage 2 (Format).
 */
export const EditorHeader: React.FC<EditorHeaderProps> = ({
  onBack,
  showToolbar = true,
  editor,
  rightActions,
}) => {
  return (
    <div className="h-12 bg-white border-b border-[#E8E8E8] flex items-center px-6 gap-4 shrink-0">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-[#666] hover:text-[#333] cursor-pointer border-none bg-transparent transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>返回</span>
      </button>

      {/* Toolbar */}
      {showToolbar && editor && <Toolbar editor={editor} />}

      {/* Right spacer */}
      <div className="flex-1" />

      {/* Right actions (draft list entry etc.) */}
      {rightActions}
    </div>
  );
};
