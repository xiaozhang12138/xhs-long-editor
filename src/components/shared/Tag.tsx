import React from 'react';

interface TagProps {
  label: string;
  onRemove?: () => void;
  removable?: boolean;
}

/** Pill-shaped tag component for topic tags */
export const Tag: React.FC<TagProps> = ({ label, onRemove, removable = true }) => {
  return (
    <span className="topic-tag">
      <span>{label}</span>
      {removable && onRemove && (
        <button type="button" onClick={onRemove} aria-label={`移除 ${label}`}>
          ×
        </button>
      )}
    </span>
  );
};
