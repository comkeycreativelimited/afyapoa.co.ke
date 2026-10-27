import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils.js';

export interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  className,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus autofocus element or first input/focusable element inside modal
    const autoFocusEl = dialogRef.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea');
    if (autoFocusEl) {
      autoFocusEl.focus();
    } else {
      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusableElements && focusableElements.length > 0) {
        focusableElements[0]?.focus();
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }

      // Focus trap
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            last?.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first?.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const titleId = `dialog-title-${Math.random().toString(36).substring(2, 9)}`;
  const descId = description ? `dialog-desc-${Math.random().toString(36).substring(2, 9)}` : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          'w-full bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto',
          maxWidthMap[maxWidth],
          className,
        )}
      >
        {/* Dialog Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex-1 min-w-0 pr-3">
            <h2 id={titleId} className="text-base font-bold text-slate-900 tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-xs text-slate-600 mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800 text-sm">{children}</div>

        {/* Dialog Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
