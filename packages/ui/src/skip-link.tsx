import React from 'react';
import { cn } from './utils.js';

export interface SkipLinkProps {
  targetId?: string;
  className?: string;
  children?: React.ReactNode;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  targetId = 'main-content',
  className,
  children = 'Skip to main content',
}) => {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:font-bold focus:rounded-md focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white',
        className,
      )}
    >
      {children}
    </a>
  );
};
