import React, { useCallback } from 'react';

interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

/**
 * Title input with character counter (max 64 chars).
 * Shows red warning when over limit.
 */
export const TitleInput: React.FC<TitleInputProps> = ({
  value,
  onChange,
  maxLength = 64,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const isOverLimit = value.length > maxLength;

  return (
    <div className="relative mb-6">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="填写标题"
        maxLength={256}
        className="w-full text-[28px] font-bold leading-tight text-[#333] placeholder-[#CCCCCC] border-none outline-none bg-transparent px-0 py-2"
        style={{ fontFamily: 'inherit' }}
      />
      <div
        className={`absolute right-0 top-2 text-xs ${
          isOverLimit ? 'text-[#FF2442]' : 'text-[#999]'
        }`}
      >
        {value.length}/{maxLength}
      </div>
    </div>
  );
};
