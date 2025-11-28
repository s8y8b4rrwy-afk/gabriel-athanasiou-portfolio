import React from 'react';
import { THEME } from '../theme';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-main">
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

      {/* Hero skeleton - matches HomeView hero structure */}
      <div className={`relative w-full h-[70vh] md:h-[80vh] lg:${THEME.hero.height} bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center overflow-hidden animate-pulse`}>
        {/* Hero overlay */}
        <div className="absolute inset-0 bg-black/10 z-10"></div>
        
        {/* Hero text skeleton */}
        <div className={`absolute z-20 ${THEME.hero.textPosition} ${THEME.hero.textAlignment} ${THEME.hero.textMaxWidth} space-y-4`}>
          <div className="h-4 w-32 bg-white/20 rounded mx-auto" />
          <div className="h-12 w-96 bg-white/20 rounded mx-auto" />
        </div>
      </div>

      {/* Grid section skeleton - matches HomeView filmstrip */}
      <div className={`${THEME.filmography.paddingTop} ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} bg-bg-main relative z-10 animate-pulse`}>
        {/* Section header skeleton */}
        <div className="flex justify-between items-end mb-16 border-b border-white/10 pb-4">
          <div className="h-3 w-28 bg-white/10 rounded" />
          <div className="h-3 w-24 bg-white/10 rounded hidden md:block" />
        </div>

        {/* Grid skeleton */}
        <div className={`grid grid-cols-1 ${THEME.filmography.grid.columns} ${THEME.filmography.grid.gapX} ${THEME.filmography.grid.gapY}`}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="group block">
              <div className={`w-full ${THEME.filmography.grid.aspectRatio} bg-white/5 overflow-hidden mb-6 rounded`}></div>
              <div className="space-y-3">
                <div className="h-5 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-1/2 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
