import React, { useRef } from 'react';
import { coverColors } from '../../data/templates';

interface CoverSettingsProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  /** Current uploaded cover image (data URL) or null. */
  coverImage: string | null;
  /** Set / clear the uploaded cover image. */
  onCoverChange: (image: string | null) => void;
}

/**
 * Cover settings panel.
 * - Auto cover: template background color choice (white / black / beige).
 * - Upload cover: replaces the auto-generated cover with a user image;
 *   a "使用自动封面" action switches back.
 */
export const CoverSettings: React.FC<CoverSettingsProps> = ({
  selectedColor,
  onColorChange,
  coverImage,
  onCoverChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCoverChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="py-4">
      {/* Upload cover */}
      <h3 className="text-sm font-medium text-[#333] mb-3">上传封面</h3>
      {coverImage ? (
        <div className="flex items-center gap-4">
          <div className="relative inline-block">
            <img
              src={coverImage}
              alt="封面"
              className="w-[120px] h-[80px] object-cover rounded-xhsCard border border-[#E8E8E8]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 text-xs rounded-xhs cursor-pointer border border-[#E8E8E8] bg-white text-[#666] hover:border-[#D0D0D0] transition-colors"
            >
              更换图片
            </button>
            <button
              type="button"
              onClick={() => {
                onCoverChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="px-3 py-1.5 text-xs rounded-xhs cursor-pointer border border-[#FF2442] bg-white text-[#FF2442] hover:bg-[#FFF0F2] transition-colors"
            >
              使用自动封面
            </button>
          </div>
        </div>
      ) : (
        <div className="upload-area inline-flex flex-col items-center gap-2" onClick={() => inputRef.current?.click()}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="text-[#BBBBBB]">
            <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <path d="M4 22l6-5 4 4 6-7 6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M16 4v6M13 7h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-[#999]">点击上传封面图（可替换自动封面）</span>
        </div>
      )}

      {/* Auto cover color */}
      <h3 className="text-sm font-medium text-[#333] mt-6 mb-3">自动封面颜色</h3>
      <div className="flex items-center gap-4">
        {coverColors.map((cc) => (
          <button
            key={cc.id}
            type="button"
            className={`color-circle ${selectedColor === cc.id ? 'selected' : ''}`}
            style={{
              backgroundColor: cc.color,
              border: cc.color === '#FFFFFF' ? '1px solid #E8E8E8' : undefined,
            }}
            onClick={() => onColorChange(cc.id)}
            title={cc.label}
          />
        ))}
      </div>

      <p className="text-xs text-[#999] mt-4 leading-relaxed">
        未上传封面时使用自动封面（模板背景 + 标题 + 装饰）；上传后封面页将替换为你的图片，标题叠加在图片底部。
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
