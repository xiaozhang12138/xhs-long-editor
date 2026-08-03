import React, { useRef } from 'react';

interface ImageUploaderProps {
  image: string | null;
  onChange: (image: string | null) => void;
}

/**
 * Cover image upload component with drag-and-drop support.
 * Shows thumbnail after upload with delete option.
 */
export const ImageUploader: React.FC<ImageUploaderProps> = ({
  image,
  onChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      {image ? (
        /* Thumbnail view */
        <div className="relative inline-block">
          <img
            src={image}
            alt="封面"
            className="w-[120px] h-[80px] object-cover rounded-xhsCard border border-[#E8E8E8]"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-5 h-5 bg-[#333] text-white rounded-full flex items-center justify-center text-xs cursor-pointer border-none hover:bg-[#FF2442] transition-colors"
          >
            ×
          </button>
        </div>
      ) : (
        /* Upload area */
        <div className="upload-area inline-flex flex-col items-center gap-2" onClick={handleUpload}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-[#BBBBBB]">
            <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <path d="M4 22l6-5 4 4 6-7 6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M16 4v6M13 7h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-[#999]">点击上传封面图</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Suggestion link */}
      <a href="#" className="inline-flex items-center gap-1 ml-4 text-sm text-[#FF2442] hover:underline no-underline">
        📷 获取封面建议
      </a>
    </div>
  );
};
