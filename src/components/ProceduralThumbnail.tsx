/**
 * ==============================================================================
 *  PROCEDURAL THUMBNAIL COMPONENT
 * ==============================================================================
 * 
 *  React component for displaying procedural SVG thumbnails.
 *  Memoized for performance, with fallback support.
 */

import React, { useMemo } from 'react';
import { generateProceduralThumbnail, ThumbnailVariant } from '../utils/generators/thumbnailGenerator';

export interface ProceduralThumbnailProps {
  /** Project title (required for generation) */
  title: string;
  
  /** Project year (optional, adds to uniqueness) */
  year?: string;
  
  /** Project type (affects color palette) */
  type?: string;
  
  /** Visual variant (auto-selected if not provided) */
  variant?: ThumbnailVariant;
  
  /** Width of thumbnail (default: 1200) */
  width?: number;
  
  /** Height of thumbnail (default: 675, 16:9 aspect) */
  height?: number;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Alt text (defaults to title) */
  alt?: string;
  
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  
  /** Decode hint */
  decoding?: 'async' | 'sync' | 'auto';

  /** Show large title overlay */
  showTitle?: boolean;

  /** Show small metadata overlay */
  showMetadata?: boolean;
}

/**
 * Procedural SVG Thumbnail Component
 * 
 * Generates a unique, deterministic SVG thumbnail for projects without video.
 * Uses memoization to avoid regenerating the same thumbnail.
 * 
 * @example
 * ```tsx
 * <ProceduralThumbnail 
 *   title="The Last Dance"
 *   year="2024"
 *   type="Narrative"
 *   className="w-full h-full object-cover"
 * />
 * ```
 */
export const ProceduralThumbnail: React.FC<ProceduralThumbnailProps> = React.memo(({
  title,
  year,
  type,
  variant,
  width = 1200,
  height = 675,
  className = '',
  alt,
  loading = 'lazy',
  decoding = 'async',
  showTitle = true,
  showMetadata = true
}) => {
  // Generate SVG data URL (memoized)
  const dataUrl = useMemo(() => {
    return generateProceduralThumbnail({
      title,
      year,
      type,
      variant,
      width,
      height,
      showTitle,
      showMetadata
    });
  }, [title, year, type, variant, width, height, showTitle, showMetadata]);
  
  return (
    <img
      src={dataUrl}
      alt={alt || title}
      className={className}
      loading={loading}
      decoding={decoding}
      // Inline data URLs don't need error handling
      style={{ 
        imageRendering: 'crisp-edges',
        WebkitFontSmoothing: 'antialiased'
      }}
    />
  );
});

ProceduralThumbnail.displayName = 'ProceduralThumbnail';

/**
 * Hook to generate thumbnail data URL without rendering img tag
 * Useful for background images or SSR contexts
 */
export function useProceduralThumbnail(
  title: string,
  year?: string,
  type?: string,
  variant?: ThumbnailVariant,
  width?: number,
  height?: number,
  options?: { showTitle?: boolean; showMetadata?: boolean }
): string {
  return useMemo(() => {
    return generateProceduralThumbnail({
      title,
      year,
      type,
      variant,
      width,
      height,
      showTitle: options?.showTitle ?? true,
      showMetadata: options?.showMetadata ?? true
    });
  }, [title, year, type, variant, width, height, options?.showTitle, options?.showMetadata]);
}
