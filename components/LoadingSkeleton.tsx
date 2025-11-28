import React from 'react';
import { THEME } from '../theme';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-main animate-pulse">
      {/* Navigation skeleton */}
      <div className={`${THEME.layout.header.height} border-b border-white/10 flex items-center justify-between px-6`}>
        <div className="h-4 w-48 bg-white/5 rounded" />
        <div className="flex gap-8">
          <div className="h-4 w-20 bg-white/5 rounded" />
          <div className="h-4 w-24 bg-white/5 rounded" />
          <div className="h-4 w-20 bg-white/5 rounded" />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className={`${THEME.hero.height} bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center px-6`}>
        <div className="space-y-6 text-center max-w-4xl">
          <div className="h-16 w-3/4 mx-auto bg-white/10 rounded" />
          <div className="h-6 w-1/2 mx-auto bg-white/5 rounded" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="aspect-video bg-white/5 rounded-lg" />
              <div className="space-y-2">
                <div className="h-6 w-3/4 bg-white/5 rounded" />
                <div className="h-4 w-1/2 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
