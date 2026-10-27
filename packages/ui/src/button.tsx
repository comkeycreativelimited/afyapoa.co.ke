import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './utils.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'teal' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const buttonStyles = {
  base: 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-md min-h-[38px] select-none',
  variants: {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900 focus-visible:ring-emerald-500 shadow-sm',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-500 border border-slate-200',
    outline: 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 focus-visible:ring-emerald-500 shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500 shadow-sm',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500',
    teal: 'bg-teal-700 text-white hover:bg-teal-800 active:bg-teal-900 focus-visible:ring-teal-500 shadow-sm',
    indigo: 'bg-indigo-700 text-white hover:bg-indigo-800 active:bg-indigo-900 focus-visible:ring-indigo-500 shadow-sm',
  },
  sizes: {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
  },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(
          buttonStyles.base,
          buttonStyles.variants[variant],
          buttonStyles.sizes[size],
          className,
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
        {!isLoading && leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0" aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
