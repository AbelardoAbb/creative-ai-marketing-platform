import React, { ButtonHTMLAttributes } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  variant = 'ghost',
  size = 'md',
  className = '',
  id,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-lg transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#090d16] disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'p-1.5 text-xs w-7 h-7',
    md: 'p-2 text-sm w-9 h-9',
    lg: 'p-2.5 text-base w-10 h-10',
  }[size];

  const variantStyles = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
    secondary: 'bg-[#161e31] hover:bg-[#1c263d] text-slate-300 border border-[#202b42]',
    ghost: 'bg-transparent hover:bg-[#161e31] text-slate-400 hover:text-slate-200',
    outline: 'border border-[#202b42] text-slate-400 hover:text-slate-200 hover:bg-[#161e31]',
    danger: 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40',
  }[variant];

  return (
    <button
      id={id}
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};
