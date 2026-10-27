import React from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  Clock,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { cn } from './utils.js';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'teal'
  | 'indigo'
  | 'purple';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  warning: 'bg-amber-50 text-amber-900 border-amber-300',
  danger: 'bg-red-50 text-red-800 border-red-300',
  info: 'bg-blue-50 text-blue-800 border-blue-300',
  neutral: 'bg-slate-100 text-slate-800 border-slate-300',
  teal: 'bg-teal-50 text-teal-800 border-teal-300',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  purple: 'bg-purple-50 text-purple-800 border-purple-300',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-full border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className,
  ...props
}) => {
  const norm = status.toUpperCase();

  // Define semantic variants and icons
  let variant: BadgeVariant = 'neutral';
  let icon = <Info className="w-3.5 h-3.5" />;
  const displayLabel = label || status;

  if (
    norm.includes('VERIFIED') ||
    norm.includes('COMPLETED') ||
    norm.includes('APPROVED') ||
    norm.includes('PAID') ||
    norm.includes('NORMAL') ||
    norm.includes('FULLY_DISPENSED') ||
    norm === 'ACTIVE'
  ) {
    variant = 'success';
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />;
  } else if (
    norm.includes('PENDING') ||
    norm.includes('TRIAGED') ||
    norm.includes('IN_PROGRESS') ||
    norm.includes('WAITING') ||
    norm.includes('QUEUED') ||
    norm.includes('PARTIAL') ||
    norm.includes('LOCAL_ONLY')
  ) {
    variant = 'warning';
    icon = <Clock className="w-3.5 h-3.5 text-amber-700" />;
  } else if (
    norm.includes('CRITICAL') ||
    norm.includes('REJECTED') ||
    norm.includes('CANCELLED') ||
    norm.includes('RESUSCITATION') ||
    norm.includes('EMERGENCY') ||
    norm.includes('ABNORMAL_HIGH') ||
    norm.includes('ABNORMAL_LOW') ||
    norm.includes('FAILED')
  ) {
    variant = 'danger';
    icon = <AlertOctagon className="w-3.5 h-3.5 text-red-700" />;
  } else if (norm.includes('EXTERNAL') || norm.includes('SYNCED')) {
    variant = 'info';
    icon = <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />;
  }

  return (
    <Badge variant={variant} icon={icon} className={className} {...props}>
      {displayLabel}
    </Badge>
  );
};
