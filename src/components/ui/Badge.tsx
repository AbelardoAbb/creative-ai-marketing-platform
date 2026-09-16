import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
  hasDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  hasDot = false,
  className = '',
  id,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center font-medium rounded-full border whitespace-nowrap tracking-wide select-none';

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-2',
  }[size];

  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }[variant];

  const dotColorStyles = {
    neutral: 'bg-slate-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    purple: 'bg-purple-500',
  }[variant];

  return (
    <span id={id} className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`} {...props}>
      {hasDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColorStyles} shrink-0`} />}
      {children}
    </span>
  );
};
