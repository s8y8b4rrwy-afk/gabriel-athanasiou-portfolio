import React from 'react';
import { THEME } from '../theme';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-main relative">
      {/* Animated gradient overlay - matches old loading screen */}
      {THEME.pageTransitions.loading.showGradient && (
        <div 
          className="fixed inset-0 z-[100] pointer-events-none"
          style={{
            background: `linear-gradient(
              90deg,
              ${THEME.pageTransitions.loading.gradientColors[0]} 0%,
              ${THEME.pageTransitions.loading.gradientColors[1]} 50%,
              ${THEME.pageTransitions.loading.gradientColors[2]} 100%
            )`,
            backgroundSize: '200% 100%',
            animation: `loadingShimmer ${THEME.pageTransitions.loading.animationDuration} ${THEME.pageTransitions.loading.animationEasing} infinite`
          }}
        />
      )}

      {/* Navigation skeleton - matches Navigation.tsx structure */}
      <nav className={`fixed top-0 left-0 w-full z-50 flex flex-col items-center md:flex-row ${THEME.header.gap} text-white ${THEME.header.paddingY} ${THEME.header.paddingX} ${THEME.header.background} animate-pulse`}>
        {/* Logo skeleton */}
        <div className={`${THEME.header.logoText} mb-6 md:mb-0`}>
          <div className="h-3 w-48 bg-white/10 rounded" />
        </div>
        
        {/* Navigation links skeleton */}
        <div className="flex gap-8">
          <div className="h-3 w-16 bg-white/10 rounded" />
          <div className="h-3 w-20 bg-white/10 rounded" />
          <div className="h-3 w-16 bg-white/10 rounded" />
          <div className="h-3 w-14 bg-white/10 rounded" />
        </div>
      </nav>

      {/* Generic content placeholder - works for any page */}
      <div className={`${THEME.header.height}`}></div>
      <div className={`${THEME.header.paddingX} pt-20 pb-20 animate-pulse`}>
        {/* Main content skeleton */}
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Large content block (hero/header area) */}
          <div className="space-y-6">
            <div className="h-8 w-3/4 bg-white/10 rounded" />
            <div className="h-4 w-1/2 bg-white/5 rounded" />
          </div>
          
          {/* Grid of content blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-video bg-white/5 rounded" />
                <div className="space-y-2">
                  <div className="h-5 w-3/4 bg-white/10 rounded" />
                  <div className="h-3 w-1/2 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
