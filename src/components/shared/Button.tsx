import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/** Size class map */
const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2 text-sm',
  lg: 'px-7 py-2.5 text-base',
};

/** Variant class map */
const variantClasses: Record<string, string> = {
  primary: 'bg-[#FF2442] text-white hover:bg-[#E01F3C] active:bg-[#CC1A35]',
  secondary: 'bg-white text-[#333] border border-[#E8E8E8] hover:border-[#D0D0D0] hover:bg-[#FAFAFA]',
  ghost: 'bg-transparent text-[#666] hover:text-[#333] hover:bg-[#F5F5F5]',
  danger: 'bg-transparent text-[#FF2442] border border-[#FF2442] hover:bg-[#FFF0F2]',
};

/**
 * Unified button component with XHS brand styling.
 * - primary: red background (#FF2442), white text
 * - secondary: white background, gray border
 * - ghost: transparent, text only
 * - danger: red outline
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  style,
  ...props
}) => {
  const baseClass = 'inline-flex items-center justify-center font-medium rounded-xhs transition-all duration-150 cursor-pointer border-none select-none';

  return (
    <button
      className={`${baseClass} ${sizeClasses[size] || ''} ${variantClasses[variant] || ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </button>
  );
};
