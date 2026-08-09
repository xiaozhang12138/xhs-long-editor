import React from 'react';

/** Product navigation used across all three stages. */
export const TopNav: React.FC = () => {
  return (
    <nav className="h-14 bg-white border-b border-[#E8E8E8] flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm shadow-blue-200/70 shrink-0">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="3" width="11" height="14" rx="2" stroke="white" strokeWidth="1.7" />
            <rect x="9" y="7" width="11" height="14" rx="2" fill="#2563EB" stroke="white" strokeWidth="1.7" />
            <path d="M12 11h5M12 14h5M12 17h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-base font-semibold tracking-tight text-[#242424] truncate">长文自由拆分图片</span>
        <span className="hidden sm:inline text-xs text-[#999] ml-1">长文排版与图片导出</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#777] shrink-0" title="数据仅保存在当前浏览器">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
        <span className="hidden sm:inline">本地自动保存</span>
      </div>
    </nav>
  );
};
