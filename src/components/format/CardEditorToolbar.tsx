import React, { useRef, useState } from 'react';
import { EmojiPicker } from '../editor/EmojiPicker';

interface CardEditorToolbarProps {
  /** Active card's contentEditable element (target of execCommand). */
  target: HTMLElement | null;
  onCommitted: () => void;
  onInsertImage: (src: string) => void;
}

/**
 * Format-page toolbar that operates on the active click-to-edit card.
 *
 * Uses the well-supported document.execCommand API against the focused
 * contentEditable card, mirroring the XHS behaviour where the header
 * toolbar (H1/H2/粗体/斜体/高亮/列表/引用/表情/图片) edits the current card.
 * Every command is followed by an explicit `onCommitted` so the edited DOM
 * is immediately merged back into the store.
 */
export const CardEditorToolbar: React.FC<CardEditorToolbarProps> = ({
  target,
  onCommitted,
  onInsertImage,
}) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  /** Run an execCommand against the active card and commit afterwards. */
  const run = (command: string, value?: string): void => {
    target?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    onCommitted();
  };

  const insertEmoji = (emoji: string): void => {
    target?.focus();
    document.execCommand('insertText', false, emoji);
    onCommitted();
    setShowEmoji(false);
  };

  const insertImage = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onInsertImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="card-toolbar">
      {/* H1 */}
      <button
        type="button"
        className="toolbar-btn"
        title="一级标题"
        onClick={() => run('formatBlock', '<h1>')}
      >
        <span className="text-[13px] font-bold leading-none">H1</span>
      </button>

      {/* H2 */}
      <button
        type="button"
        className="toolbar-btn"
        title="二级标题"
        onClick={() => run('formatBlock', '<h2>')}
      >
        <span className="text-[13px] font-bold leading-none">H2</span>
      </button>

      <span className="toolbar-divider" />

      {/* Bold */}
      <button type="button" className="toolbar-btn" title="粗体" onClick={() => run('bold')}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M4 2h4.5a2.5 2.5 0 010 5H4V2zm0 5h5a2.5 2.5 0 010 5H4V7zm1-4v3h3a1.5 1.5 0 000-3H5zm0 5v3h3.5a1.5 1.5 0 000-3H5z" />
        </svg>
      </button>

      {/* Italic */}
      <button type="button" className="toolbar-btn" title="斜体" onClick={() => run('italic')}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M9 2l-3 10M6 2H3m6 10h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* Underline */}
      <button type="button" className="toolbar-btn" title="下划线" onClick={() => run('underline')}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M3 10V4.5A4.5 4.5 0 017.5 0 4.5 4.5 0 0112 4.5V10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M2 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {/* Strike */}
      <button type="button" className="toolbar-btn" title="删除线" onClick={() => run('strikeThrough')}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M3 7.5h9M5 4c0-1.5 1-2.5 2.5-2.5S10 2.5 10 4M5 11c0 1.5 1 2.5 2.5 2.5S10 12.5 10 11" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Highlight */}
      <button
        type="button"
        className="toolbar-btn"
        title="高亮标记"
        onClick={() => run('hiliteColor', '#FEF3C7')}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M4 13l5-10h2L6 13H4z" fill="#FEF3C7" stroke="#E5B84B" strokeWidth="0.8" />
          <path d="M2 13h10" stroke="#E5B84B" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* Bullet list */}
      <button type="button" className="toolbar-btn" title="无序列表" onClick={() => run('insertUnorderedList')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="4" r="1.2" /><circle cx="3" cy="8" r="1.2" /><circle cx="3" cy="12" r="1.2" />
          <path d="M6.5 4h7M6.5 8h7M6.5 12h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Ordered list */}
      <button type="button" className="toolbar-btn" title="有序列表" onClick={() => run('insertOrderedList')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.5 4.5h.5V2.5h-.5L2 3l.3.4.2-.9zM2.2 9h.6V7.2h-.6l-.5.5.3.4.2-.9zM2.2 13.5h.6v-1.8h-.6l-.5.5.3.4.2-.9z" />
          <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Quote */}
      <button type="button" className="toolbar-btn" title="引用块" onClick={() => run('formatBlock', '<blockquote>')}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M3 8.5c0-2 1-3.5 3-3.5v2c-.8 0-1 .5-1 1.5h2V13H3V8.5zM9 8.5c0-2 1-3.5 3-3.5v2c-.8 0-1 .5-1 1.5h2V13H9V8.5z" opacity="0.7" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* Emoji */}
      <div className="relative">
        <button
          ref={emojiBtnRef}
          type="button"
          className="toolbar-btn"
          title="表情"
          onClick={() => setShowEmoji((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <circle cx="6" cy="6.5" r="1" fill="currentColor" />
            <circle cx="10" cy="6.5" r="1" fill="currentColor" />
            <path d="M5.5 10s1 1.5 2.5 1.5S10.5 10 10.5 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          </svg>
        </button>
        {showEmoji && (
          <div ref={pickerRef} className="absolute top-full left-0 mt-2 z-50">
            <EmojiPicker onInsert={insertEmoji} onClose={() => setShowEmoji(false)} />
          </div>
        )}
      </div>

      {/* Image */}
      <button type="button" className="toolbar-btn" title="插入图片" onClick={insertImage}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.5" />
          <path d="M2 11l3.5-3.5L9 11l2-2 3 3.5" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 5.5h3M12 4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};

export default CardEditorToolbar;
