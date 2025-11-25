/**
 * Image optimization utilities
 * Handles responsive images, lazy loading, and format selection
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
 * Generate optimized image URL with size parameters
 * Works with any image CDN that supports width parameters
 */
export const getOptimizedImageUrl = (
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
