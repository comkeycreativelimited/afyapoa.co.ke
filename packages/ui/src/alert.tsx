import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  ShieldAlert,
} from 'lucide-react';
import { cn } from './utils.js';

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface ClinicalAlertProps {
  severity?: AlertSeverity;
  title: string;
  message?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
  isPanicValue?: boolean;
}

const severityConfig: Record<
  AlertSeverity,
  {
    container: string;
    icon: React.ReactNode;
    titleColor: string;
    textColor: string;
    role: 'alert' | 'status';
  }
> = {
  critical: {
    container: 'bg-red-50 border-red-300 text-red-950',
    icon: <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />,
    titleColor: 'text-red-900',
    textColor: 'text-red-800',
    role: 'alert',
  },
  warning: {
    container: 'bg-amber-50 border-amber-300 text-amber-950',
    icon: <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />,
    titleColor: 'text-amber-900',
    textColor: 'text-amber-800',
    role: 'alert',
  },
  info: {
    container: 'bg-blue-50 border-blue-300 text-blue-950',
    icon: <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />,
    titleColor: 'text-blue-900',
    textColor: 'text-blue-800',
    role: 'status',
  },
  success: {
    container: 'bg-emerald-50 border-emerald-300 text-emerald-950',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />,
    titleColor: 'text-emerald-900',
    textColor: 'text-emerald-800',
    role: 'status',
  },
};

export const ClinicalAlert: React.FC<ClinicalAlertProps> = ({
  severity = 'info',
  title,
  message,
  actionText,
  onAction,
  onDismiss,
  className,
  isPanicValue = false,
}) => {
  const config = severityConfig[severity];

  return (
    <div
      role={config.role}
      aria-live={severity === 'critical' ? 'assertive' : 'polite'}
      className={cn(
        'rounded-lg border p-4 shadow-sm flex items-start gap-3 transition-colors',
        config.container,
        isPanicValue && 'border-2 border-red-600 bg-red-100/90 shadow-md animate-pulse',
        className,
      )}
    >
      {isPanicValue ? (
        <ShieldAlert className="w-6 h-6 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
      ) : (
        config.icon
      )}

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className={cn('text-sm font-bold tracking-tight', config.titleColor)}>
            {isPanicValue && <span className="uppercase text-red-700 mr-1.5">[PANIC ALERT]</span>}
            {title}
          </h3>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss alert"
              className="text-slate-500 hover:text-slate-800 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {message && <div className={cn('text-xs leading-relaxed', config.textColor)}>{message}</div>}

        {actionText && onAction && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onAction}
              className={cn(
                'text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1 py-0.5',
                severity === 'critical'
                  ? 'text-red-900 hover:text-red-950'
                  : 'text-slate-900 hover:text-emerald-900',
              )}
            >
              {actionText} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
