/**
 * Design Tokens — Creative AI Design System
 * Centralized theme tokens for colors, surfaces, borders, typography, and states.
 */

export const tokens = {
  colors: {
    bg: {
      base: '#f8fafc',
      surface: '#ffffff',
      surfaceElevated: '#f1f5f9',
      surfaceHover: '#e2e8f0',
    },
    border: {
      subtle: '#e2e8f0',
      strong: '#cbd5e1',
      active: '#2563eb',
    },
    accent: {
      primary: '#2563eb', // Professional blue
      primaryHover: '#1d4ed8',
      secondary: '#eff6ff', // Light blue
      secondaryHover: '#dbeafe',
    },
    text: {
      main: '#0f172a',
      muted: '#64748b',
      dim: '#94a3b8',
    },
    status: {
      success: '#16a34a',
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb',
      pending: '#d97706',
      approved: '#16a34a',
      rejected: '#dc2626',
    },
  },
  typography: {
    display: 'text-3xl lg:text-4xl font-bold tracking-tight text-slate-900',
    heading: 'text-xl lg:text-2xl font-semibold tracking-tight text-slate-900',
    subheading: 'text-base lg:text-lg font-medium text-slate-800',
    body: 'text-sm lg:text-base font-normal text-slate-700 leading-relaxed',
    small: 'text-xs lg:text-sm font-normal text-slate-600',
    caption: 'text-xs font-medium tracking-wide text-slate-500 uppercase',
  },
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },
  transitions: {
    default: 'transition-all duration-200 ease-in-out',
    smooth: 'transition-all duration-300 ease-out',
  },
} as const;

export type DesignTokens = typeof tokens;
