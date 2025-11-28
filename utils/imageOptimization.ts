/**
 * Image optimization utilities
 * Handles responsive images, lazy loading, and format selection
 * Now includes Cloudinary CDN with local WebP and Airtable fallbacks
 */

export type CloudinaryPreset = 'ultra' | 'fine';

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
  preset?: CloudinaryPreset;
}

/**
 * Detect optimal preset based on device capabilities and network conditions
 * 
 * Decision logic:
 * - Slow connection (saveData or 2G) → fine
 * - Large viewport × DPR (≥1024px effective) → ultra
 * - Default → fine
 * 
 * @returns CloudinaryPreset ('ultra' or 'fine')
 */
export const detectOptimalPreset = (): CloudinaryPreset => {
  if (typeof window === 'undefined') return 'fine';

  // Check network conditions
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (connection) {
    if (connection.saveData || connection.effectiveType === '2g') {
      console.log('🌐 Network: Slow connection detected, using fine preset');
      return 'fine';
    }
  }

  // Check viewport size and DPR
  const viewportWidth = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const effectiveWidth = viewportWidth * dpr;

  if (effectiveWidth >= 1024) {
    console.log(`🖥️ Device: ${viewportWidth}px × ${dpr} DPR = ${effectiveWidth}px effective, using ultra preset`);
    return 'ultra';
  }

  console.log(`📱 Device: ${viewportWidth}px × ${dpr} DPR = ${effectiveWidth}px effective, using fine preset`);
  return 'fine';
};

/**
 * Get session-cached preset (detects once per session)
 * 
 * @returns CloudinaryPreset ('ultra' or 'fine')
 */
export const getSessionPreset = (): CloudinaryPreset => {
  if (typeof window === 'undefined') {
    console.log('⚠️ SSR: Returning default preset "fine"');
    return 'fine';
  }

  const STORAGE_KEY = 'cloudinary_preset';
  
  // Check session storage
  const cached = sessionStorage.getItem(STORAGE_KEY);
  console.log('📦 Session storage check:', { cached, type: typeof cached });
  
  if (cached === 'ultra' || cached === 'fine') {
    console.log(`✅ Using cached preset: ${cached}`);
    return cached as CloudinaryPreset;
  }

  // Detect and cache
  const preset = detectOptimalPreset();
  console.log(`🎯 Detected and caching preset: ${preset}`);
  sessionStorage.setItem(STORAGE_KEY, preset);
  return preset;
};

/**
 * Build Cloudinary URL with preset-based quality optimization
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

  // Map preset to quality value AND width
  let qualityValue: number | string = 'auto';
  let widthValue: number = 1600; // Default
  
  console.log('🔍 Preset check:', { 
    'options.preset': options.preset, 
    'typeof': typeof options.preset,
    'truthy': !!options.preset 
  });
  
  if (options.preset) {
    // Ultra preset: higher quality + larger width for high-end devices
    // Fine preset: optimized quality + standard width for all devices
    if (options.preset === 'ultra') {
      qualityValue = 90;
      widthValue = 1600;
      console.log(`✅ Preset "ultra" → quality 90, width 1600`);
    } else {
      qualityValue = 75;
      widthValue = 1600;
      console.log(`✅ Preset "fine" → quality 75, width 1600`);
    }
  } else if (options.quality) {
    qualityValue = options.quality;
    console.log(`✅ Using explicit quality ${qualityValue}`);
  } else {
    console.warn(`⚠️ No preset or quality specified, defaulting to "auto"`);
  }

  // Allow explicit width override if provided
  const {
    width = widthValue,  // Use preset-determined width or explicit override
    format = 'webp',     // Force WebP format
    crop = 'limit'       // Prevent upscaling
  } = options;

  // Build transformation string: f_webp,w_1600,c_limit,q_90
  const transformations = [
    `f_${format}`,
    `w_${width}`,
    `c_${crop}`,
    `q_${qualityValue}`
  ].join(',');

  // Construct Cloudinary URL
  const finalUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${publicId}`;
  
  // Log complete transformation specs
  console.log(`🎨 Cloudinary URL built:`, {
    publicId,
    preset: options.preset || 'none',
    width,
    quality: qualityValue,
    format,
    url: finalUrl
  });
  
  return finalUrl;
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
 * @param preset - Quality preset for Cloudinary delivery ('ultra' or 'fine')
 * @param width - Width for Cloudinary delivery (1600 for full images, 800 for thumbnails)
 * @returns Object with cloudinaryUrl, localUrl, and fallbackUrl
 */
export const getOptimizedImageUrl = (
  recordId: string,
  fallbackUrl: string,
  type: 'project' | 'journal' = 'project',
  index: number = 0,
  totalImages: number = 1,
  preset?: CloudinaryPreset,
  width?: number
): { cloudinaryUrl: string; localUrl: string; fallbackUrl: string; useCloudinary: boolean } => {
  console.log('🚀 getOptimizedImageUrl called:', { recordId, type, index, preset, width, totalImages });
  
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
  
  // Build Cloudinary URL with preset and width parameters (only pass defined values)
  const cloudinaryOptions: CloudinaryOptions = {};
  
  console.log('🔧 Building cloudinaryOptions:', {
    'preset param': preset,
    'preset type': typeof preset,
    'preset truthy': !!preset,
    'preset === undefined': preset === undefined,
    'width param': width
  });
  
  if (preset !== undefined) {
    cloudinaryOptions.preset = preset;
    console.log(`✅ Added preset to options: ${preset}`);
  }
  if (width !== undefined) {
    cloudinaryOptions.width = width;
    console.log(`✅ Added width to options: ${width}`);
  }
  
  console.log('🔧 Final cloudinaryOptions:', cloudinaryOptions);
  
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
 * @deprecated - Use Cloudinary width parameter instead
 */
/*
export const generateSrcSet = (src: string): string => {
  if (!src || !src.startsWith('http')) return src;
  
  const sizes = [480, 768, 1024, 1440, 1920];
  return sizes
    .map(width => `${getOptimizedImageUrl(src, width)} ${width}w`)
    .join(', ');
};
*/

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
