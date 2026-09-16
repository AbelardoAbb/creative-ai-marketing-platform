import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  id,
  ...props
}) => {
  const baseStyles = 'rounded-xl border transition-colors duration-150';

  const variantStyles = {
    default: 'bg-white border-slate-200 text-slate-800 shadow-xs',
    elevated: 'bg-white border-slate-200 shadow-sm text-slate-800',
    interactive:
      'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs cursor-pointer text-slate-800',
    outline: 'bg-transparent border-slate-200 text-slate-800',
  }[variant];

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6 sm:p-7',
  }[padding];

  return (
    <div id={id} className={`${baseStyles} ${variantStyles} ${paddingStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};
