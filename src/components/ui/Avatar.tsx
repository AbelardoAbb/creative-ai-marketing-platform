import React from 'react';
import { UserRole } from '../../types/ui';

export interface AvatarProps {
  name: string;
  avatarUrl?: string;
  role?: UserRole;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarUrl,
  role,
  size = 'md',
  className = '',
  id,
}) => {
  const [imgError, setImgError] = React.useState(false);

  const getInitials = (str: string) => {
    return str
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const sizeStyles = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
  }[size];

  const roleIndicator = {
    Designer: 'bg-pink-500',
    Copywriter: 'bg-sky-500',
    Approver: 'bg-emerald-500',
    Administrator: 'bg-purple-500',
  };

  return (
    <div
      id={id}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full font-semibold select-none ring-1 ring-[#202b42] ${sizeStyles} ${className}`}
      title={`${name}${role ? ` (${role})` : ''}`}
    >
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-[#1c263d] text-slate-200 flex items-center justify-center">
          {getInitials(name)}
        </div>
      )}

      {role && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#090d16] ${roleIndicator[role]}`}
          title={`Role: ${role}`}
        />
      )}
    </div>
  );
};
