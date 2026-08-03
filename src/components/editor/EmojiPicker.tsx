import React, { useState } from 'react';
import { xhsEmojis, systemEmojis } from '../../data/templates';

interface EmojiPickerProps {
  onInsert: (emoji: string) => void;
  onClose: () => void;
}

/**
 * Dual-tab emoji picker panel.
 * Tab 1: XHS custom emojis (simulated)
 * Tab 2: System emoji keyboard
 * Panel size: ~352×226px
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onInsert, onClose }) => {
  const [activeTab, setActiveTab] = useState<'xhs' | 'system'>('xhs');

  return (
    <div
      className="bg-white rounded-xhsCard shadow-xl border border-[#E8E8E8]"
      style={{ width: 352 }}
      onMouseLeave={onClose}
    >
      {/* Tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium cursor-pointer border-none bg-transparent transition-colors ${
            activeTab === 'xhs'
              ? 'text-[#FF2442] border-b-2 border-[#FF2442]'
              : 'text-[#999] hover:text-[#666]'
          }`}
          onClick={() => setActiveTab('xhs')}
        >
          小红薯表情
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium cursor-pointer border-none bg-transparent transition-colors ${
            activeTab === 'system'
              ? 'text-[#FF2442] border-b-2 border-[#FF2442]'
              : 'text-[#999] hover:text-[#666]'
          }`}
          onClick={() => setActiveTab('system')}
        >
          emoji表情
        </button>
      </div>

      {/* Content */}
      <div className="p-3" style={{ maxHeight: 180, overflowY: 'auto' }}>
        <div className="emoji-grid">
          {(activeTab === 'xhs' ? xhsEmojis : systemEmojis).map((emoji, i) => (
            <button
              key={`${activeTab}-${i}`}
              type="button"
              className="emoji-item"
              onClick={() => onInsert(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
