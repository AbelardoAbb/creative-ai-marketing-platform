import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    rectangular: 'rounded-lg w-full',
    circular: 'rounded-full',
  }[variant];

  return (
    <div
      className={`animate-pulse bg-slate-200 border border-slate-200/50 ${variantStyles} ${className}`}
      aria-hidden="true"
    />
  );
};
