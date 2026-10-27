import React from 'react';
import { cn } from './utils.js';

export interface BaseFieldProps {
  label: string;
  id: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
}

export interface InputFieldProps
  extends BaseFieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      id,
      error,
      helperText,
      required,
      className,
      leftAddon,
      rightAddon,
      disabled,
      ...props
    },
    ref,
  ) => {
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText ? `${id}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('space-y-1.5 w-full', className)}>
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-800 tracking-wide"
        >
          {label}
          {required && (
            <span className="text-red-600 ml-1" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </label>

        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 text-slate-500 pointer-events-none" aria-hidden="true">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            required={required}
            className={cn(
              'w-full min-h-[40px] px-3 py-2 text-sm text-slate-900 bg-white border rounded-md shadow-sm transition-colors',
              'placeholder:text-slate-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
              'disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed',
              error
                ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500 bg-red-50/20'
                : 'border-slate-300 hover:border-slate-400',
              leftAddon && 'pl-9',
              rightAddon && 'pr-9',
            )}
            {...props}
          />

          {rightAddon && (
            <div className="absolute right-3 text-slate-500 pointer-events-none" aria-hidden="true">
              {rightAddon}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-red-600 mt-1">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-slate-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

InputField.displayName = 'InputField';

export interface SelectFieldProps
  extends BaseFieldProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      label,
      id,
      error,
      helperText,
      required,
      className,
      options,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText ? `${id}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('space-y-1.5 w-full', className)}>
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-800 tracking-wide"
        >
          {label}
          {required && (
            <span className="text-red-600 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          required={required}
          className={cn(
            'w-full min-h-[40px] px-3 py-2 text-sm text-slate-900 bg-white border rounded-md shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
            'disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed',
            error
              ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500 bg-red-50/20'
              : 'border-slate-300 hover:border-slate-400',
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        {error && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-red-600 mt-1">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-slate-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

SelectField.displayName = 'SelectField';

export interface TextareaFieldProps
  extends BaseFieldProps,
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {}

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  (
    {
      label,
      id,
      error,
      helperText,
      required,
      className,
      disabled,
      rows = 3,
      ...props
    },
    ref,
  ) => {
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText ? `${id}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('space-y-1.5 w-full', className)}>
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-800 tracking-wide"
        >
          {label}
          {required && (
            <span className="text-red-600 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <textarea
          ref={ref}
          id={id}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          required={required}
          className={cn(
            'w-full px-3 py-2 text-sm text-slate-900 bg-white border rounded-md shadow-sm transition-colors',
            'placeholder:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
            'disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed',
            error
              ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500 bg-red-50/20'
              : 'border-slate-300 hover:border-slate-400',
          )}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-red-600 mt-1">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-slate-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

TextareaField.displayName = 'TextareaField';
