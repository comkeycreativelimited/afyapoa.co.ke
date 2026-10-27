import React from 'react';
import { Loader2, Inbox } from 'lucide-react';
import { cn } from './utils.js';

export interface AccessibleTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  caption: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  containerClassName?: string;
}

export const AccessibleTable: React.FC<AccessibleTableProps> = ({
  caption,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No records found.',
  emptyAction,
  containerClassName,
  className,
  children,
  ...props
}) => {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`${caption} - Scrollable table container`}
      className={cn(
        'w-full overflow-x-auto rounded-lg border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm',
        containerClassName,
      )}
    >
      <table
        className={cn('w-full text-left border-collapse text-xs sm:text-sm text-slate-700', className)}
        aria-busy={isLoading}
        {...props}
      >
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>

      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center p-8 space-y-2 text-slate-500"
        >
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" aria-hidden="true" />
          <span className="text-xs font-medium">Loading clinical records...</span>
        </div>
      )}

      {!isLoading && isEmpty && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center p-8 text-center space-y-2 text-slate-500"
        >
          <Inbox className="w-8 h-8 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">{emptyMessage}</p>
          {emptyAction && <div className="pt-2">{emptyAction}</div>}
        </div>
      )}
    </div>
  );
};
