/**
 * Image optimization utilities
 * Handles responsive images, lazy loading, and format selection
 * Now includes Netlify CDN optimized images with Airtable fallback
 */

export interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  decoding?: 'async' | 'sync' | 'auto';
}

/**
 * Get optimized image URL for a record
 * Returns local optimized image if available, otherwise falls back to Airtable URL
 * 
 * ⚠️ CRITICAL: Always pass totalImages parameter for consistency
 * 
 * The optimization script generates images with index suffixes when totalImages > 1:
 * - totalImages = 1: project-{id}.webp (no suffix)
 * - totalImages > 1: project-{id}-0.webp, project-{id}-1.webp, etc.
 * 
 * In practice, most projects have multiple gallery images, so the script generates
 * files with the -0, -1, -2 suffix pattern. To ensure thumbnails load correctly:
 * 
 * ✅ CORRECT (for projects with galleries):
 * getOptimizedImageUrl(project.id, project.heroImage, 'project', 0, project.gallery.length || 2)
 * 
 * ❌ INCORRECT (will try to load project-{id}.webp which doesn't exist):
 * getOptimizedImageUrl(project.id, project.heroImage, 'project', 0, 1)
 * 
 * @param recordId - Airtable record ID
 * @param fallbackUrl - Original Airtable image URL
 * @param type - 'project' or 'journal'
 * @param index - Image index for multiple images (default: 0)
 * @param totalImages - Total number of images. MUST match optimization script output.
 *                      Use project.gallery.length || 2 for safety.
 */
export const getOptimizedImageUrl = (
  recordId: string,
  fallbackUrl: string,
  type: 'project' | 'journal' = 'project',
  index: number = 0,
  totalImages: number = 1
): string => {
  // If no fallback URL provided, return empty string
  if (!fallbackUrl) {
    console.warn(`getOptimizedImageUrl: No fallback URL provided for record ${recordId}`);
    return '';
  }
  
  // If no record ID, return fallback URL directly
  if (!recordId) {
    console.warn(`getOptimizedImageUrl: No record ID provided, using fallback URL`);
    return fallbackUrl;
  }
  
  // Build optimized image path - matches optimization script naming:
  // Single image: project-{id}.webp
  // Multiple images: project-{id}-0.webp, project-{id}-1.webp, etc.
  const imageId = `${type}-${recordId}${totalImages > 1 ? `-${index}` : ''}`;
  const optimizedPath = `/images/portfolio/${imageId}.webp`;
  
  // In production, check if optimized image exists by attempting to use it
  // If it 404s, browser will handle the fallback
  // For now, we return the optimized path and rely on runtime fallback in components
  
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    // Return optimized path - if it doesn't exist, component should handle fallback
    return optimizedPath;
  }
  
  // Server-side: return optimized path
  return optimizedPath;
};

/**
 * Get fallback URL for images that aren't optimized yet
 */
export const getImageWithFallback = (
  recordId: string,
  fallbackUrl: string,
  type: 'project' | 'journal' = 'project',
  index: number = 0
): string => {
  const optimizedUrl = getOptimizedImageUrl(recordId, fallbackUrl, type, index);
  return optimizedUrl;
};

/**
 * Legacy function for CDN-based optimization
 * Generate optimized image URL with size parameters
 * Works with any image CDN that supports width parameters
 */
export const getOptimizedImageUrlLegacy = (
  src: string,
  width: number,
  quality: number = 85
): string => {
  if (!src || !src.startsWith('http')) return src;

  // Unsplash URLs
  if (src.includes('unsplash.com')) {
    return `${src}&w=${width}&q=${quality}&auto=format,compress`;
  }

  // Airtable attachment URLs (already optimized by Airtable)
  if (src.includes('airtable.com') || src.includes('cdn.airtable.com')) {
    return src;
  }

  // YouTube/Vimeo thumbnails
  if (src.includes('img.youtube.com') || src.includes('vumbnail.com')) {
    return src;
  }

  // Generic URLs - add width parameter if CDN supports it
  return src.includes('?') ? `${src}&w=${width}&q=${quality}` : `${src}?w=${width}&q=${quality}`;
};

/**
 * Generate srcset string for responsive images
 */
export const generateSrcSet = (src: string): string => {
  if (!src || !src.startsWith('http')) return src;
  
  const sizes = [480, 768, 1024, 1440, 1920];
  return sizes
    .map(width => `${getOptimizedImageUrl(src, width)} ${width}w`)
    .join(', ');
};

/**
 * Get responsive sizes attribute for images
 */
export const getImageSizes = (imageType: 'hero' | 'grid' | 'thumbnail' | 'profile'): string => {
  switch (imageType) {
    case 'hero':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw';
    case 'grid':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
    case 'thumbnail':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw';
    case 'profile':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 400px, 400px';
    default:
      return '100vw';
  }
};

/**
 * Preload critical images for better Core Web Vitals
 */
export const preloadImage = (src: string): void => {
  if (!src || typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.fetchPriority = 'high';
  document.head.appendChild(link);
};

/**
 * Prefetch images for smoother navigation
 */
export const prefetchImage = (src: string): void => {
  if (!src || typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
};
