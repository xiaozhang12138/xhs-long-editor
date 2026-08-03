import React, { useState, useRef, useEffect } from 'react';
import { EmojiPicker } from './EmojiPicker';

interface ToolbarProps {
  editor: any; // TipTap Editor instance
}

/** Font size options shown in the toolbar dropdown (px). */
const FONT_SIZES = [12, 14, 16, 18, 20, 24];

/** Text color palette for the color popup. */
const TEXT_COLORS = [
  '#333333',
  '#FF2442',
  '#FF6B81',
  '#FF8A00',
  '#FFC107',
  '#52C41A',
  '#00B96B',
  '#13C2C2',
  '#1677FF',
  '#2F54EB',
  '#722ED1',
  '#EB2F96',
  '#8C8C8C',
  '#000000',
];

/** Background (highlight) color palette. */
const BG_COLORS = [
  '#FEF3C7',
  '#FFE0E5',
  '#FFEDD5',
  '#FEF9C3',
  '#DCFCE7',
  '#DBEAFE',
  '#EDE9FE',
  '#FCE7F3',
  '#FFFFFF',
];

/**
 * Full toolbar matching the XHS editor toolbar.
 * Includes undo/redo, headings, formatting, font size, text color,
 * background color, lists, emoji, and image insertion.
 */
export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);

  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const textColorButtonRef = useRef<HTMLButtonElement>(null);
  const textColorRef = useRef<HTMLDivElement>(null);
  const bgColorButtonRef = useRef<HTMLButtonElement>(null);
  const bgColorRef = useRef<HTMLDivElement>(null);

  // Close popups on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        showEmojiPicker &&
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        showTextColor &&
        textColorRef.current &&
        !textColorRef.current.contains(target) &&
        textColorButtonRef.current &&
        !textColorButtonRef.current.contains(target)
      ) {
        setShowTextColor(false);
      }
      if (
        showBgColor &&
        bgColorRef.current &&
        !bgColorRef.current.contains(target) &&
        bgColorButtonRef.current &&
        !bgColorButtonRef.current.contains(target)
      ) {
        setShowBgColor(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker, showTextColor, showBgColor]);

  if (!editor) return null;

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          editor.chain().focus().setImage({ src: reader.result as string }).run();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  /** Current font size (px) from the textStyle mark, 0 when unset. */
  const currentFontSize = (() => {
    const raw = editor.getAttributes('textStyle').fontSize as string | undefined;
    if (!raw) return 0;
    const px = parseInt(raw, 10);
    return Number.isNaN(px) ? 0 : px;
  })();

  /** Current text color from the textStyle mark. */
  const currentTextColor = editor.getAttributes('textStyle').color as
    | string
    | undefined;

  /** Current highlight color from the highlight mark. */
  const currentBgColor = editor.getAttributes('highlight').color as
    | string
    | undefined;

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = Number(e.target.value);
    if (v > 0) {
      editor.chain().focus().setFontSize(`${v}px`).run();
    } else {
      editor.chain().focus().unsetFontSize().run();
    }
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {/* Undo */}
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="撤销"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8H12M3 8L6 5M3 8L6 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 5C9.5 5 13 6 13 10C13 13 10 14 8 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {/* Redo */}
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="重做"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13 8H4M13 8L10 5M13 8L10 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 5C6.5 5 3 6 3 10C3 13 6 14 8 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* H1 */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="一级标题"
      >
        <span className="text-[13px] font-bold leading-none">H1</span>
      </button>

      {/* H2 */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="二级标题"
      >
        <span className="text-[13px] font-bold leading-none">H2</span>
      </button>

      <span className="toolbar-divider" />

      {/* Font size select */}
      <select
        value={currentFontSize}
        onChange={handleFontSizeChange}
        className="toolbar-select"
        title="字号"
        aria-label="字号"
      >
        <option value={0}>字号</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>

      {/* Text color */}
      <div className="relative">
        <button
          ref={textColorButtonRef}
          type="button"
          className={`toolbar-btn ${currentTextColor ? 'active' : ''}`}
          onClick={() => setShowTextColor(!showTextColor)}
          title="文字颜色"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 12l4-9h1l4 9M5.2 9.5h5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 14h12" stroke={currentTextColor || '#999'} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {showTextColor && (
          <div ref={textColorRef} className="toolbar-popup" style={{ width: 192 }}>
            <p className="text-[11px] text-[#999] mb-2">文字颜色</p>
            <div className="grid grid-cols-7 gap-1.5">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`mini-swatch ${currentTextColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  title={color}
                  onClick={() => {
                    editor.chain().focus().setColor(color).run();
                    setShowTextColor(false);
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="w-full mt-2 px-2 py-1 text-[11px] text-[#666] rounded-xhs cursor-pointer border border-[#E8E8E8] bg-white hover:bg-[#F5F5F5] transition-colors"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setShowTextColor(false);
              }}
            >
              恢复默认颜色
            </button>
          </div>
        )}
      </div>

      {/* Background color (highlight) */}
      <div className="relative">
        <button
          ref={bgColorButtonRef}
          type="button"
          className={`toolbar-btn ${editor.isActive('highlight') ? 'active' : ''}`}
          onClick={() => setShowBgColor(!showBgColor)}
          title="文字背景色"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 13l4.5-9h1.5l4.5 9M5 9.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="2" y="13.5" width="12" height="2.5" rx="1" fill={currentBgColor || '#FEF3C7'} stroke="#D9B45B" strokeWidth="0.6" />
          </svg>
        </button>

        {showBgColor && (
          <div ref={bgColorRef} className="toolbar-popup" style={{ width: 192 }}>
            <p className="text-[11px] text-[#999] mb-2">文字背景色</p>
            <div className="grid grid-cols-5 gap-1.5">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`mini-swatch ${currentBgColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color, border: color === '#FFFFFF' ? '1px solid #E8E8E8' : undefined }}
                  title={color}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color }).run();
                    setShowBgColor(false);
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="w-full mt-2 px-2 py-1 text-[11px] text-[#666] rounded-xhs cursor-pointer border border-[#E8E8E8] bg-white hover:bg-[#F5F5F5] transition-colors"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setShowBgColor(false);
              }}
            >
              清除背景色
            </button>
          </div>
        )}
      </div>

      <span className="toolbar-divider" />

      {/* Bold */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="粗体"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M4 2h4.5a2.5 2.5 0 010 5H4V2zm0 5h5a2.5 2.5 0 010 5H4V7zm1-4v3h3a1.5 1.5 0 000-3H5zm0 5v3h3.5a1.5 1.5 0 000-3H5z" />
        </svg>
      </button>

      {/* Italic */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="斜体"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M9 2l-3 10M6 2H3m6 10h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* Underline */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="下划线"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M3 10V4.5A4.5 4.5 0 017.5 0 4.5 4.5 0 0112 4.5V10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M2 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {/* Strikethrough */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="删除线"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M3 7.5h9M5 4c0-1.5 1-2.5 2.5-2.5S10 2.5 10 4M5 11c0 1.5 1 2.5 2.5 2.5S10 12.5 10 11" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Quote */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="引用块"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <path d="M3 8.5c0-2 1-3.5 3-3.5v2c-.8 0-1 .5-1 1.5h2V13H3V8.5zM9 8.5c0-2 1-3.5 3-3.5v2c-.8 0-1 .5-1 1.5h2V13H9V8.5z" opacity="0.7" />
        </svg>
      </button>

      {/* Highlight (default yellow) */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('highlight') ? 'active' : ''} ${editor.isActive('blockquote') ? 'opacity-40 cursor-not-allowed' : ''}`}
        onClick={() => !editor.isActive('blockquote') && editor.chain().focus().toggleHighlight({ color: '#FEF3C7' }).run()}
        disabled={editor.isActive('blockquote')}
        title="高亮标记"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M4 13l5-10h2L6 13H4z" fill="#FEF3C7" stroke="#E5B84B" strokeWidth="0.8" />
          <path d="M2 13h10" stroke="#E5B84B" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* Bullet List */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="无序列表"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="4" r="1.2" /><circle cx="3" cy="8" r="1.2" /><circle cx="3" cy="12" r="1.2" />
          <path d="M6.5 4h7M6.5 8h7M6.5 12h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Ordered List */}
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="有序列表"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.5 4.5h.5V2.5h-.5L2 3l.3.4.2-.9zM2.2 9h.6V7.2h-.6l-.5.5.3.4.2-.9zM2.2 13.5h.6v-1.8h-.6l-.5.5.3.4.2-.9z" />
          <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      {/* Emoji Picker */}
      <div className="relative">
        <button
          ref={emojiButtonRef}
          type="button"
          className="toolbar-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="表情"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <circle cx="6" cy="6.5" r="1" fill="currentColor" />
            <circle cx="10" cy="6.5" r="1" fill="currentColor" />
            <path d="M5.5 10s1 1.5 2.5 1.5S10.5 10 10.5 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          </svg>
        </button>

        {showEmojiPicker && (
          <div ref={pickerRef} className="absolute top-full left-0 mt-2 z-50">
            <EmojiPicker
              onInsert={(emoji) => {
                editor.chain().focus().insertContent(emoji).run();
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </div>

      {/* Image Upload */}
      <button
        type="button"
        className="toolbar-btn"
        onClick={insertImage}
        title="插入图片"
      >
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
