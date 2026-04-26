// ============================================================
// Button.tsx — Reusable button with variants and loading state
// ============================================================

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-teal-600 hover:bg-teal-700 text-white border-transparent focus:ring-teal-500',
  secondary:
    'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 focus:ring-slate-400',
  danger:
    'bg-red-600 hover:bg-red-700 text-white border-transparent focus:ring-red-500',
  ghost:
    'bg-transparent hover:bg-slate-100 text-slate-600 border-transparent focus:ring-slate-400',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...rest
}) => {
  console.log('[Button] render', { variant, size, isLoading, disabled });

  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg border ' +
    'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};