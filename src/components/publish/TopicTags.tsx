import React, { useState } from 'react';
import { Tag } from '../shared/Tag';
import { recommendedTags } from '../../data/templates';

interface TopicTagsProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

/**
 * Topic tags input with recommended tags and custom tag entry.
 * Shows the accumulated topic-character count (0/1000).
 */
export const TopicTags: React.FC<TopicTagsProps> = ({
  tags,
  onAdd,
  onRemove,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showMore, setShowMore] = useState(false);

  const visibleRecommended = showMore
    ? recommendedTags
    : recommendedTags.slice(0, 5);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      const val = inputValue.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        onAdd(`#${val}`);
        setInputValue('');
      }
    }
  };

  const handleRecommendClick = (label: string) => {
    if (!tags.includes(label)) {
      onAdd(label);
    }
  };

  // Count total tag characters
  const totalChars = tags.reduce((sum, t) => sum + t.length, 0);

  return (
    <div>
      {/* Recommended tags */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {visibleRecommended.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`px-3 py-1 text-xs rounded-xhsTag cursor-pointer border-none transition-colors ${
              tags.includes(tag.label)
                ? 'bg-[#FF2442] text-white'
                : 'bg-[#F5F5F5] text-[#666] hover:bg-[#EDEDED]'
            }`}
            onClick={() => handleRecommendClick(tag.label)}
          >
            {tag.label}
            {tag.hot && <span className="ml-1 text-[10px]">🔥</span>}
          </button>
        ))}
        {!showMore && recommendedTags.length > 5 && (
          <button
            type="button"
            className="text-xs text-[#999] cursor-pointer border-none bg-transparent hover:text-[#666]"
            onClick={() => setShowMore(true)}
          >
            更多 ▾
          </button>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 border border-[#E8E8E8] rounded-xhs px-3 py-2 bg-white focus-within:border-[#FF2442] focus-within:border transition-colors">
        {/* # prefix */}
        <span className="text-sm text-[#999]">#</span>

        {/* Input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="话题"
          className="flex-1 text-sm outline-none border-none bg-transparent text-[#333]"
          maxLength={100}
        />

        <div className="text-xs text-[#999]">
          <span className={`ml-1 ${totalChars > 1000 ? 'text-[#FF2442]' : ''}`}>
            {totalChars}/1000
          </span>
        </div>
      </div>

      {/* Added tags display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <Tag
              key={tag}
              label={tag}
              removable
              onRemove={() => onRemove(tag)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
