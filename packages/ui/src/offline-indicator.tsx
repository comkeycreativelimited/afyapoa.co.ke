import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from './utils.js';

export interface OfflineIndicatorProps {
  isOnline?: boolean;
  isSyncing?: boolean;
  pendingSyncCount?: number;
  onTriggerSync?: () => void;
  className?: string;
  t?: (key: string, defaultText?: string) => string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline = true,
  isSyncing = false,
  pendingSyncCount = 0,
  onTriggerSync,
  className,
  t = (_, d) => d || '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors select-none',
        isOnline
          ? isSyncing
            ? 'bg-blue-50 text-blue-800 border-blue-200'
            : pendingSyncCount > 0
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-red-50 text-red-800 border-red-200',
        className,
      )}
    >
      {isOnline ? (
        isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" aria-hidden="true" />
        ) : (
          <Wifi className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        )
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
      )}

      <span className={isOnline ? 'hidden sm:inline' : 'inline'}>
        {!isOnline
          ? t('network.offline', 'Offline Mode')
          : isSyncing
          ? t('network.syncing', 'Syncing DHA/SHA...')
          : pendingSyncCount > 0
          ? `${pendingSyncCount} ${t('network.pending_sync', 'pending sync')}`
          : t('network.online', 'Online • Synced')}
      </span>

      {isOnline && pendingSyncCount > 0 && onTriggerSync && !isSyncing && (
        <button
          type="button"
          onClick={onTriggerSync}
          className="hidden sm:inline underline text-[11px] font-bold text-amber-900 hover:text-amber-950 ml-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded"
        >
          {t('network.sync_now', 'Sync Now')}
        </button>
      )}
    </div>
  );
};
