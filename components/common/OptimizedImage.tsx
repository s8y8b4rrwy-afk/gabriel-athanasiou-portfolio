/**
 * ==============================================================================
 *  OPTIMIZED IMAGE COMPONENT
 * ==============================================================================
 * 
 *  Image component with fade-in animation and automatic fallback.
 * 
 *  ⚠️ CRITICAL: CLASS ORDER & TRANSITIONS
 *  ----------------------------------------
 *  This component applies className LAST (after loading state classes) to ensure
 *  parent hover animations work correctly. DO NOT reorder the className prop.
 * 
 *  The fade-in transition is applied via inline style only during loading,
 *  allowing parent components to control hover transitions (scale, opacity, etc.)
 *  without conflicts.
 * 
 *  Example parent usage:
 *  ```tsx
 *  <OptimizedImage
 *    className="transform-gpu scale-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
 *  />
 *  ```
 * 
 *  The parent's transition classes will control hover behavior, while this component
 *  only handles the initial fade-in on load.
 */

import React, { useState, useMemo } from 'react';
import { getOptimizedImageUrl } from '../../utils/imageOptimization';

interface OptimizedImageProps {
  /** Airtable record ID */
  recordId: string;
  /** Fallback Airtable image URL */
  fallbackUrl: string;
  /** Image type: 'project' or 'journal' */
  type?: 'project' | 'journal';
  /** Image index for galleries (default: 0) */
  index?: number;
  /** Total images in gallery (for naming) */
  totalImages?: number;
  /** Alt text */
  alt: string;
  /** Additional CSS classes */
  className?: string;
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  /** Decode hint */
  decoding?: 'async' | 'sync' | 'auto';
}

/**
 * Optimized Image Component
 * 
 * Displays optimized WebP images with smooth fade-in animation.
 * Automatically falls back to Airtable URL if optimized version fails.
 * 
 * @example
 * ```tsx
 * <OptimizedImage
 *   recordId={project.id}
 *   fallbackUrl={project.heroImage}
 *   type="project"
 *   alt={project.title}
 *   className="w-full h-full object-cover"
 * />
 * ```
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  recordId,
  fallbackUrl,
  type = 'project',
  index = 0,
  totalImages = 1,
  alt,
  className = '',
  loading = 'lazy',
  decoding = 'async'
}) => {
  // If no fallback URL provided, don't render anything
  if (!fallbackUrl) {
    console.error('OptimizedImage: No fallback URL provided');
    return null;
  }

  const optimizedUrl = useMemo(() => (
    getOptimizedImageUrl(recordId, fallbackUrl, type as 'project' | 'journal', index, totalImages)
  ), [recordId, fallbackUrl, type, index, totalImages]);

  const [currentSrc, setCurrentSrc] = useState<string>(optimizedUrl);
  const [triedFallback, setTriedFallback] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    // Only try fallback once and only if fallback URL exists and is different
    if (!triedFallback && fallbackUrl && currentSrc !== fallbackUrl) {
      console.log(`Failed to load optimized image, trying fallback: ${fallbackUrl}`);
      setTriedFallback(true);
      setIsLoaded(false);
      setCurrentSrc(fallbackUrl);
    } else {
      // If fallback also fails or doesn't exist, mark as loaded to prevent infinite loop
      console.error(`Failed to load image: ${currentSrc}`);
      setIsLoaded(true);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onLoad={handleLoad}
      onError={handleError}
      // ⚠️ CRITICAL ORDER: opacity state first, then className last
      // This ensures parent hover transitions (in className) take precedence
      className={`${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      // Only apply fade-in transition during loading, not after
      style={{ transition: isLoaded ? undefined : 'opacity 0.5s ease-out' }}
    />
  );
};
