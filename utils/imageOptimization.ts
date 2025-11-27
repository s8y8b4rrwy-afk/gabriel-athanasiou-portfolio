/**
 * Image optimization utilities
 * Handles responsive images, lazy loading, and format selection
 * Now includes Cloudinary CDN with local WebP and Airtable fallbacks
 */

export interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  decoding?: 'async' | 'sync' | 'auto';
}

export interface CloudinaryOptions {
  width?: number;
  quality?: 'auto:best' | 'auto:good' | 'auto:eco' | 'auto:low' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'limit' | 'fill' | 'fit' | 'scale';
  dpr?: number | 'auto';
}

/**
 * Build Cloudinary URL with automatic format and quality optimization
 * 
 * @param recordId - Airtable record ID
 * @param type - 'project' or 'journal'
 * @param index - Image index for multiple images (default: 0)
 * @param options - Cloudinary transformation options
 * @returns Cloudinary CDN URL
 */
export const buildCloudinaryUrl = (
  recordId: string,
  type: 'project' | 'journal' = 'project',
  index: number = 0,
  options: CloudinaryOptions = {}
): string => {
  // Read cloud name from environment (client-side only, from meta tag or window)
  const cloudName = typeof window !== 'undefined' 
    ? window.CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    : null;

  if (!cloudName) {
    console.warn('buildCloudinaryUrl: CLOUDINARY_CLOUD_NAME not configured');
    return '';
  }

  // Build public ID based on naming convention
  // Projects: portfolio-projects-{recordId}-{index}
  // Journal: portfolio-journal-{recordId} (no index)
  const publicId = type === 'journal' 
    ? `portfolio-journal-${recordId}`
    : `portfolio-projects-${recordId}-${index}`;

  // Default options
  const {
    width = 1600,
    quality = 'auto:good',
    format = 'auto',
    crop = 'limit',
    dpr = 'auto'
  } = options;

  // Build transformation string
  const transformations = [
    `f_${format}`,
    `q_${quality}`,
    `w_${width}`,
    `c_${crop}`,
    `dpr_${dpr}`
  ].join(',');

  // Construct Cloudinary URL
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${publicId}`;
};

/**
 * Get optimized image URL with three-tier fallback strategy
 * 
 * Fallback chain:
 * 1. Cloudinary CDN (if USE_CLOUDINARY=true)
 * 2. Local WebP files (existing optimization)
 * 3. Original Airtable URL
 * 
 * ⚠️ CRITICAL: Always pass totalImages parameter for local WebP consistency
 * 
 * The optimization script generates images with index suffixes when totalImages > 1:
 * - totalImages = 1: project-{id}.webp (no suffix)
 * - totalImages > 1: project-{id}-0.webp, project-{id}-1.webp, etc.
 * 
 * @param recordId - Airtable record ID
 * @param fallbackUrl - Original Airtable image URL
 * @param type - 'project' or 'journal'
 * @param index - Image index for multiple images (default: 0)
 * @param totalImages - Total number of images. MUST match optimization script output.
 * @param cloudinaryOptions - Optional Cloudinary transformation options
 * @returns Object with cloudinaryUrl, localUrl, and fallbackUrl
 */
export const getOptimizedImageUrl = (
  recordId: string,
  fallbackUrl: string,
  type: 'project' | 'journal' = 'project',
  index: number = 0,
  totalImages: number = 1,
  cloudinaryOptions?: CloudinaryOptions
): { cloudinaryUrl: string; localUrl: string; fallbackUrl: string; useCloudinary: boolean } => {
  // If no fallback URL provided, return empty strings
  if (!fallbackUrl) {
    console.warn(`getOptimizedImageUrl: No fallback URL provided for record ${recordId}`);
    return { cloudinaryUrl: '', localUrl: '', fallbackUrl: '', useCloudinary: false };
  }
  
  // If no record ID, return fallback URL only
  if (!recordId) {
    console.warn(`getOptimizedImageUrl: No record ID provided, using fallback URL only`);
    return { cloudinaryUrl: '', localUrl: '', fallbackUrl, useCloudinary: false };
  }

  // Check feature flag (client-side only)
  const useCloudinary = typeof window !== 'undefined'
    ? window.USE_CLOUDINARY === 'true' || window.USE_CLOUDINARY === true
    : false;
  
  // Build Cloudinary URL
  const cloudinaryUrl = buildCloudinaryUrl(recordId, type, index, cloudinaryOptions);
  
  // Build local WebP path - matches optimization script naming
  const imageId = `${type}-${recordId}${totalImages > 1 ? `-${index}` : ''}`;
  const localUrl = `/images/portfolio/${imageId}.webp`;
  
  return {
    cloudinaryUrl,
    localUrl,
    fallbackUrl,
    useCloudinary
  };
};

/**
 * Generate responsive Cloudinary URLs for srcset
 * 
 * @param recordId - Airtable record ID
 * @param type - 'project' or 'journal'
 * @param index - Image index
 * @returns srcset string with responsive breakpoints
 */
export const buildCloudinarySrcSet = (
  recordId: string,
  type: 'project' | 'journal' = 'project',
  index: number = 0
): string => {
  const breakpoints = [400, 800, 1200, 1600];
  
  return breakpoints
    .map(width => {
      const url = buildCloudinaryUrl(recordId, type, index, { width });
      return `${url} ${width}w`;
    })
    .join(', ');
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
