/**
 * ==============================================================================
 *  OPTIMIZED IMAGE COMPONENT
 * ==============================================================================
 * 
 *  Image component with loading states, shimmer animation, and automatic fallback.
 *  Provides a better UX than broken image icons during lazy loading.
 */

import React, { useState } from 'react';
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
 * Displays optimized WebP images with shimmer loading animation.
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const optimizedUrl = getOptimizedImageUrl(recordId, fallbackUrl, type as 'project' | 'journal', index, totalImages);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!hasError && e.currentTarget.src !== fallbackUrl) {
      setHasError(true);
      e.currentTarget.src = fallbackUrl;
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Loading shimmer */}
      {!isLoaded && (
        <div className="absolute inset-0 img-loading" />
      )}
      
      {/* Actual image */}
      <img
        src={optimizedUrl}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={handleLoad}
        onError={handleError}
        className={`${className} ${isLoaded ? 'img-loaded' : 'opacity-0'}`}
      />
    </div>
  );
};
