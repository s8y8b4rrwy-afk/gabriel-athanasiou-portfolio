/**
 * Image optimization utilities
 * Handles responsive images, lazy loading, and format selection
 * Now includes Cloudinary CDN with local WebP and Airtable fallbacks
 */

// Enable debug logging in development only
const DEBUG = import.meta.env.DEV;

/**
 * Cloudinary configuration
 */
export const cloudinaryConfig = {
  get cloudName() {
    return typeof window !== 'undefined'
      ? window.CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
      : import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'date24ay6';
  },
  get enabled() {
    return typeof window !== 'undefined'
      ? window.USE_CLOUDINARY === 'true' || window.USE_CLOUDINARY === true
      : false;
  }
};

/**
 * Check if Cloudinary is enabled
 * @returns {boolean} Whether Cloudinary feature flag is enabled
 */
export const isCloudinaryEnabled = (): boolean => {
  return cloudinaryConfig.enabled;
};

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
  quality?: number; // Only numeric quality values, no auto
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
      if (DEBUG) console.log('🌐 Network: Slow connection detected, using fine preset');
      return 'fine';
    }
  }

  // Check viewport size and DPR
  const viewportWidth = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const effectiveWidth = viewportWidth * dpr;

  if (effectiveWidth >= 1024) {
    if (DEBUG) console.log(`🖥️ Device: ${viewportWidth}px × ${dpr} DPR = ${effectiveWidth}px effective, using ultra preset`);
    return 'ultra';
  }

  if (DEBUG) console.log(`📱 Device: ${viewportWidth}px × ${dpr} DPR = ${effectiveWidth}px effective, using fine preset`);
  return 'fine';
};

/**
 * Get session-cached preset (detects once per session)
 * 
 * @returns CloudinaryPreset ('ultra' or 'fine')
 */
export const getSessionPreset = (): CloudinaryPreset => {
  if (typeof window === 'undefined') {
    return 'fine';
  }

  const STORAGE_KEY = 'cloudinary_preset';
  
  // Check session storage
  const cached = sessionStorage.getItem(STORAGE_KEY);
  
  if (cached === 'ultra' || cached === 'fine') {
    if (DEBUG) console.log(`✅ Using cached preset: ${cached}`);
    return cached as CloudinaryPreset;
  }

  // Detect and cache
  const preset = detectOptimalPreset();
  if (DEBUG) console.log(`🎯 Detected and caching preset: ${preset}`);
  sessionStorage.setItem(STORAGE_KEY, preset);
  return preset;
};

/**
 * Build Cloudinary URL with preset-based quality optimization
 * 
 * @param recordId - Airtable record ID
 * @param type - 'project', 'journal', or 'config'
 * @param index - Image index for multiple images (default: 0)
 * @param options - Cloudinary transformation options
 * @returns Cloudinary CDN URL
 */
export const buildCloudinaryUrl = (
  recordId: string,
  type: 'project' | 'journal' | 'config' = 'project',
  index: number = 0,
  options: CloudinaryOptions = {}
): string => {
  // Read cloud name from environment
  const cloudName = cloudinaryConfig.cloudName;

  if (!cloudName) {
    if (DEBUG) console.warn('CLOUDINARY_CLOUD_NAME not configured');
    return '';
  }

  // Build public ID based on naming convention
  // Projects: portfolio-projects-{recordId}-{index}
  // Journal: portfolio-journal-{recordId} (no index)
  // Config: portfolio-config-{recordId} (profile, showreel, etc.)
  let publicId: string;
  if (type === 'journal') {
    publicId = `portfolio-journal-${recordId}`;
  } else if (type === 'config') {
    publicId = `portfolio-config-${recordId}`;
  } else {
    publicId = `portfolio-projects-${recordId}-${index}`;
  }

  // Map preset to quality value AND width
  let qualityValue: number = 75; // Default to fine preset
  let widthValue: number = 1600; // Default
  
  if (options.preset) {
    // Ultra preset: higher quality + larger width for high-end devices
    // Fine preset: optimized quality + standard width for all devices
    if (options.preset === 'ultra') {
      qualityValue = 90;
      widthValue = 1600;
    } else {
      qualityValue = 75;
      widthValue = 1600;
    }
  } else if (options.quality && typeof options.quality === 'number') {
    qualityValue = options.quality;
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
  
  if (DEBUG) {
    console.log('Cloudinary URL:', { publicId, preset: options.preset, width, quality: qualityValue });
  }
  
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
 * @param type - 'project', 'journal', or 'config'
 * @param index - Image index for multiple images (default: 0)
 * @param totalImages - Total number of images. MUST match optimization script output.
 * @param preset - Quality preset for Cloudinary delivery ('ultra' or 'fine')
 * @param width - Width for Cloudinary delivery (1600 for full images, 800 for thumbnails)
 * @returns Object with cloudinaryUrl, localUrl, and fallbackUrl
 */
export const getOptimizedImageUrl = (
  recordId: string,
  fallbackUrl: string,
  type: 'project' | 'journal' | 'config' = 'project',
  index: number = 0,
  totalImages: number = 1,
  preset?: CloudinaryPreset,
  width?: number
): { cloudinaryUrl: string; localUrl: string; fallbackUrl: string; useCloudinary: boolean } => {
  // If no fallback URL provided, return empty strings
  if (!fallbackUrl) {
    if (DEBUG) console.warn(`No fallback URL for record ${recordId}`);
    return { cloudinaryUrl: '', localUrl: '', fallbackUrl: '', useCloudinary: false };
  }
  
  // If no record ID, return fallback URL only
  if (!recordId) {
    if (DEBUG) console.warn('No record ID, using fallback URL only');
    return { cloudinaryUrl: '', localUrl: '', fallbackUrl, useCloudinary: false };
  }

  // Check feature flag
  const useCloudinary = isCloudinaryEnabled();
  
  // Build Cloudinary URL with preset and width parameters (only pass defined values)
  const cloudinaryOptions: CloudinaryOptions = {};
  
  if (preset !== undefined) {
    cloudinaryOptions.preset = preset;
  }
  if (width !== undefined) {
    cloudinaryOptions.width = width;
  }
  
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
 * Legacy function for CDN-based optimization
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
