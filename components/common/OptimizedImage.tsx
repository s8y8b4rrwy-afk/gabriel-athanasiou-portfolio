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
 * 
 *  ⚠️ CRITICAL: totalImages PARAMETER
 *  -----------------------------------
 *  ALWAYS pass totalImages prop to match the optimization script's file naming:
 *  - totalImages = 0: No gallery images, uses fallback URL directly (e.g., video thumbnail)
 *  - totalImages = 1: project-{id}.webp (no suffix)
 *  - totalImages > 1: project-{id}-0.webp, project-{id}-1.webp, etc.
 * 
 *  ✅ CORRECT USAGE:
 *  ```tsx
 *  // Project with gallery images
 *  <OptimizedImage
 *    recordId={project.id}
 *    fallbackUrl={project.heroImage}
 *    type="project"
 *    index={0}
 *    totalImages={project.gallery?.length || 0}  // ← Use 0, not 2!
 *    alt={project.title}
 *  />
 *  ```
 * 
 *  ❌ INCORRECT USAGE (will fail to load video thumbnails):
 *  ```tsx
 *  <OptimizedImage
 *    recordId={project.id}
 *    fallbackUrl={project.heroImage}
 *    type="project"
 *    totalImages={project.gallery?.length || 2}  // ← Wrong! Use 0 instead
 *  />
 *  ```
 */

import React, { useState, useMemo } from 'react';
import { getOptimizedImageUrl, getSessionPreset, type CloudinaryPreset } from '../../utils/imageOptimization';

interface OptimizedImageProps {
  /** Airtable record ID */
  recordId: string;
  /** Fallback Airtable image URL */
  fallbackUrl: string;
  /** Image type: 'project' or 'journal' */
  type?: 'project' | 'journal';
  /** Image index for galleries (default: 0) */
  index?: number;
  /** 
   * Total images in gallery (for local WebP naming consistency).
   * OPTIONAL: Only needed if you want local WebP fallback.
   * Cloudinary naming doesn't require this.
   */
  totalImages?: number;
  /** Alt text */
  alt: string;
  /** Additional CSS classes */
  className?: string;
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  /** Decode hint */
  decoding?: 'async' | 'sync' | 'auto';
  /** Use original JPEG on desktop/large devices (1024px+) for maximum quality */
  useOriginalOnDesktop?: boolean;
  /** Cloudinary quality preset: 'ultra' (90%) or 'fine' (75%). Auto-detects if not provided. */
  preset?: CloudinaryPreset;
  /** Cloudinary width: 1600 (default for full images) or 800 (for thumbnails) */
  width?: number;
}

/**
 * Optimized Image Component
 * 
 * Displays optimized WebP images with smooth fade-in animation.
 * Automatically falls back to Airtable URL if optimized version fails.
 * 
 * ⚠️ IMPORTANT: Always pass correct totalImages value:
 * - totalImages = 0: No gallery, skip optimization (e.g., video thumbnails)
 * - totalImages = gallery.length: Has gallery images, use optimized WebP
 * 
 * @example
 * ```tsx
 * <OptimizedImage
 *   recordId={project.id}
 *   fallbackUrl={project.heroImage}
 *   type="project"
 *   index={0}
 *   totalImages={project.gallery?.length || 0}  // Use 0, not 2!
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
  decoding = 'async',
  useOriginalOnDesktop = false,
  preset,
  width = 1600
}) => {
  // If no fallback URL provided, don't render anything
  if (!fallbackUrl) {
    console.error('OptimizedImage: No fallback URL provided');
    return null;
  }

  // Auto-detect preset if not provided
  const activePreset = preset || getSessionPreset();
  
  console.log('🖼️ OptimizedImage:', { 
    recordId, 
    presetProp: preset, 
    activePreset,
    width 
  });

  // Get all three URL options: Cloudinary, local WebP, Airtable
  const imageUrls = useMemo(() => 
    getOptimizedImageUrl(recordId, fallbackUrl, type as 'project' | 'journal', index, totalImages, activePreset, width)
  , [recordId, fallbackUrl, type, index, totalImages, activePreset, width]);

  // Determine initial source based on feature flag
  // If totalImages is 0, skip optimized versions and go straight to fallback (video thumbnail)
  const initialSrc = totalImages === 0 
    ? imageUrls.fallbackUrl
    : (imageUrls.useCloudinary && imageUrls.cloudinaryUrl 
      ? imageUrls.cloudinaryUrl 
      : imageUrls.localUrl);

  const [currentSrc, setCurrentSrc] = useState<string>(initialSrc);
  const [fallbackLevel, setFallbackLevel] = useState<number>(totalImages === 0 ? 2 : 0); // Skip fallbacks if totalImages=0
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    // Try next fallback level
    if (fallbackLevel === 0) {
      // Try local WebP if we were using Cloudinary, or Airtable if we were using local
      const nextSrc = imageUrls.useCloudinary ? imageUrls.localUrl : imageUrls.fallbackUrl;
      console.log(`Image load failed, trying fallback level 1: ${nextSrc}`);
      setFallbackLevel(1);
      setIsLoaded(false);
      setCurrentSrc(nextSrc);
    } else if (fallbackLevel === 1) {
      // Try final fallback (Airtable URL)
      if (currentSrc !== imageUrls.fallbackUrl) {
        console.log(`Image load failed, trying final fallback: ${imageUrls.fallbackUrl}`);
        setFallbackLevel(2);
        setIsLoaded(false);
        setCurrentSrc(imageUrls.fallbackUrl);
      } else {
        // Already at final fallback and it failed
        console.error(`All image sources failed for: ${recordId}`);
        setIsLoaded(true);
      }
    } else {
      // All fallbacks exhausted
      console.error(`All image sources failed for: ${recordId}`);
      setIsLoaded(true);
    }
  };

  // For desktop-only original quality: use picture element with media queries
  if (useOriginalOnDesktop) {
    return (
      <picture>
        {/* Desktop (1024px+): Original JPEG for maximum quality */}
        <source media="(min-width: 1024px)" srcSet={imageUrls.fallbackUrl} />
        {/* Mobile/Tablet: Optimized image for performance */}
        <source media="(max-width: 1023px)" srcSet={currentSrc} />
        <img
          src={imageUrls.fallbackUrl}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={handleLoad}
          onError={handleError}
          className={`${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          style={{ transition: isLoaded ? undefined : 'opacity 0.5s ease-out' }}
        />
      </picture>
    );
  }

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
