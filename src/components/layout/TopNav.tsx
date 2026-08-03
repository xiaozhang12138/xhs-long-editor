import React, { useState } from 'react';

/**
 * Top navigation bar with XHS logo and user info.
 * Used across all 3 stages.
 */
export const TopNav: React.FC = () => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="h-14 bg-white border-b border-[#E8E8E8] flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#FF2442] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill="white"
              transform="scale(0.8) translate(3,3)"
            />
          </svg>
        </div>
        <span className="text-base font-semibold text-[#333]">小红书</span>
        <span className="text-sm text-[#999] ml-1">创作服务平台</span>
      </div>

      {/* Right: User info */}
      <div className="relative">
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer border-none bg-transparent hover:opacity-80 transition-opacity"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
            健
          </div>
          <span className="text-sm text-[#333]">健康的蛤蟆</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="#999">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xhsCard shadow-lg border border-[#E8E8E8] py-1 z-50">
              {['个人主页', '账号设置', '退出登录'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-[#333] hover:bg-[#F5F5F5] cursor-pointer border-none bg-transparent"
                  onClick={() => setShowDropdown(false)}
                >
                  {item}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
  );
};
