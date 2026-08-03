import React from 'react';
import { Button } from '../shared/Button';

interface EditorFooterProps {
  wordCount: number;
  lastSavedAt: string | null;
  onDraftLeave?: () => void;
  /** When provided, shows a "复制全文" button (editor stage). */
  onCopyText?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
}

/**
 * Editor footer with word count, auto-save time, and action buttons.
 * Used in Stage 1 and Stage 2.
 */
export const EditorFooter: React.FC<EditorFooterProps> = ({
  wordCount,
  lastSavedAt,
  onDraftLeave,
  onCopyText,
  primaryAction,
}) => {
  return (
    <div className="h-14 bg-white border-t border-[#E8E8E8] flex items-center justify-between px-6 fixed bottom-0 left-0 right-0 z-40">
      {/* Left: status */}
      <div className="text-xs text-[#999]">
        <span>字数: {wordCount}</span>
        {lastSavedAt && (
          <>
            <span className="mx-1">·</span>
            <span>自动保存于 {lastSavedAt}</span>
          </>
        )}
      </div>

      {/* Right: buttons */}
      <div className="flex items-center gap-3">
        {onCopyText && (
          <Button variant="secondary" onClick={onCopyText}>
            复制全文
          </Button>
        )}
        {onDraftLeave && (
          <Button variant="secondary" onClick={onDraftLeave}>
            暂存离开
          </Button>
        )}
        {primaryAction && (
          <Button
            variant={primaryAction.variant || 'primary'}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};
