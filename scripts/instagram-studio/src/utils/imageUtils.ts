/**
 * Image utilities for Instagram Studio
 * Converts Airtable URLs to Cloudinary URLs using project ID and index
 * 
 * The main site uses this pattern: portfolio-projects-{recordId}-{index}
 * We build URLs directly from project data, not by extracting Airtable IDs
 * 
 * IMPORTANT: Two URL modes:
 * - Preview: Uses 'fine' preset (quality 80, width 1000, webp) for fast loading in app
 * - Instagram: Uses original files (no transformations) for best quality on IG
 */

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'date24ay6';

/**
 * Image presets matching the main site (from theme.ts)
 * These determine image quality and size for different use cases
 */
export const IMAGE_PRESETS = {
  // Ultra-low quality for 2G/slow connections
  micro: {
    quality: 70,
    width: 600,
    format: 'webp' as const
  },
  // Standard quality for app preview (matches main site)
  fine: {
    quality: 80,
    width: 1000,
    format: 'webp' as const
  },
  // High quality for larger displays
  ultra: {
    quality: 90,
    width: 1600,
    format: 'webp' as const
  },
  // Maximum quality for hero images
  hero: {
    quality: 100,
    width: 2400,
    format: 'webp' as const
  },
  // Original quality for Instagram publishing (no transformations)
  // Will be cropped to 4:5 aspect ratio for Instagram compatibility
  instagram: {
    quality: 100,
    width: null, // No width limit - use original
    format: null // No format conversion - handled separately
  }
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

interface CloudinaryImageMapping {
  index: number;
  publicId: string;
  cloudinaryUrl: string;
  airtableId: string;
  format: string;
  size: number;
}

interface CloudinaryProjectMapping {
  recordId: string;
  title: string;
  images: CloudinaryImageMapping[];
}

interface CloudinaryMapping {
  generatedAt: string;
  projects: CloudinaryProjectMapping[];
}

// Cache for the cloudinary mapping (used for validation/fallback)
let cloudinaryMappingCache: CloudinaryMapping | null = null;
let cloudinaryMappingPromise: Promise<CloudinaryMapping | null> | null = null;

// Build a lookup map: recordId -> images array
let projectImageMap: Map<string, CloudinaryImageMapping[]> | null = null;

/**
 * Load the cloudinary mapping from the main site
 * Used for validation and to check which projects have images on Cloudinary
 */
async function loadCloudinaryMapping(): Promise<CloudinaryMapping | null> {
  if (cloudinaryMappingCache) {
    return cloudinaryMappingCache;
  }

  if (cloudinaryMappingPromise) {
    return cloudinaryMappingPromise;
  }

  cloudinaryMappingPromise = (async () => {
    try {
      // Fetch from production site - mapping is hosted there
      const mappingUrl = 'https://lemonpost.studio/cloudinary-mapping.json';
      const response = await fetch(mappingUrl);
      if (!response.ok) {
        console.warn('Failed to load cloudinary mapping:', response.status);
        return null;
      }

      const mapping: CloudinaryMapping = await response.json();
      cloudinaryMappingCache = mapping;

      // Build lookup map: recordId -> images
      projectImageMap = new Map();
      for (const project of mapping.projects) {
        projectImageMap.set(project.recordId, project.images);
      }

      console.log(`✅ Loaded cloudinary mapping: ${mapping.projects.length} projects`);
      return mapping;
    } catch (err) {
      console.error('Error loading cloudinary mapping:', err);
      return null;
    }
  })();

  return cloudinaryMappingPromise;
}

/**
 * Find the index of an image URL in a project's gallery
 * Returns -1 if not found
 */
export function findImageIndex(imageUrl: string, projectGallery: string[]): number {
  // Direct match
  const directIndex = projectGallery.indexOf(imageUrl);
  if (directIndex !== -1) return directIndex;
  
  // If the URL is already a Cloudinary URL with the index pattern, extract it
  if (isCloudinaryUrl(imageUrl)) {
    const match = imageUrl.match(/portfolio-projects-[^-]+-(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return -1;
}

/**
 * Get Cloudinary URL for an image, auto-detecting index from project gallery
 */
export function getCloudinaryUrlForImage(
  imageUrl: string,
  projectId: string,
  projectGallery: string[]
): string {
  // If already Cloudinary, just optimize
  if (isCloudinaryUrl(imageUrl)) {
    return getOptimizedCloudinaryUrl(imageUrl);
  }
  
  // Find the index in the gallery
  const index = findImageIndex(imageUrl, projectGallery);
  if (index !== -1) {
    return buildCloudinaryUrl(projectId, index);
  }
  
  // Can't determine index, return original
  console.warn('Could not find image in gallery:', imageUrl.substring(0, 50) + '...');
  return imageUrl;
}

/**
 * Check if a URL is an Airtable URL
 */
function isAirtableUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('airtable.com') || url.includes('airtableusercontent.com');
}

/**
 * Check if a URL is already a Cloudinary URL
 */
function isCloudinaryUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('res.cloudinary.com');
}

/**
 * Instagram acceptable aspect ratios
 * Min: 4:5 (0.8) - portrait
 * Max: 1.91:1 (1.91) - landscape
 * Square: 1:1 (1.0)
 */
const INSTAGRAM_ASPECT_RATIOS = {
  MIN: 0.8,      // 4:5 portrait
  MAX: 1.91,     // 1.91:1 landscape
  SQUARE: 1.0,  // 1:1 square
  
  // Common ratios for Cloudinary ar_ parameter
  // Using decimal format to avoid colons in URL (Instagram API doesn't like colons)
  PORTRAIT_4_5: '0.8',      // 4:5 as decimal
  SQUARE_1_1: '1.0',        // 1:1 as decimal
  LANDSCAPE_191_100: '1.91', // 1.91:1 as decimal
  LANDSCAPE_16_9: '1.78',    // 16:9 as decimal
};

/**
 * Get the Instagram aspect ratio for an image
 * Instagram accepts: 4:5 (0.8) to 1.91:1 (1.91)
 * 
 * Strategy: Default to landscape (1.91:1) unless image is portrait.
 * This ensures consistent letterboxing for wide images.
 * 
 * @param width - Original image width
 * @param height - Original image height
 * @returns The Cloudinary ar_ parameter value
 */
export function getClosestInstagramAspectRatio(width: number, height: number): string {
  const originalRatio = width / height;
  
  // If portrait (ratio < 1), use 4:5
  if (originalRatio < 1) {
    return INSTAGRAM_ASPECT_RATIOS.PORTRAIT_4_5;
  }
  
  // Otherwise use landscape 1.91:1 (Instagram's max landscape)
  // This will add letterboxing (black bars) for images wider than 1.91:1
  return INSTAGRAM_ASPECT_RATIOS.LANDSCAPE_191_100;
}

/**
 * Carousel Transform Mode
 * Determines whether the entire carousel should use letterbox or crop based on majority
 */
export type CarouselTransformMode = 'letterbox' | 'crop' | 'none';

export interface CarouselModeResult {
  /** The mode to apply to all images in the carousel */
  mode: CarouselTransformMode;
  /** The target aspect ratio to use for all images */
  targetAspectRatio: number;
  /** CSS object-fit value */
  objectFit: 'contain' | 'cover';
  /** Count of images that would naturally letterbox */
  letterboxCount: number;
  /** Count of images that would naturally crop */
  cropCount: number;
  /** Count of images that fit naturally (no transform) */
  noneCount: number;
}

/**
 * Analyze all images in a carousel and determine the majority transform mode.
 * All images in the carousel will then use this same mode for visual consistency.
 * 
 * The logic is based on how Cloudinary transforms images for Instagram:
 * - LANDSCAPE images (ratio > 1.0) → displayed in landscape container, full width
 * - PORTRAIT images taller than 4:5 (ratio < 0.8) → cropped to 4:5
 * - Images between 0.8 and 1.0 → fit naturally into Instagram's 4:5 format
 * 
 * @param dimensions - Map of image URLs to their dimensions
 * @param selectedImages - Array of selected image URLs in order
 * @returns The carousel mode to apply to all images
 */
export function getCarouselTransformMode(
  dimensions: Map<string, { width: number; height: number }>,
  selectedImages: string[]
): CarouselModeResult {
  let landscapeCount = 0;
  let cropCount = 0;
  let noneCount = 0;
  
  // Track average aspect ratio of landscape images
  let totalLandscapeRatio = 0;
  
  // Default to 4:5 portrait if no images
  if (selectedImages.length === 0) {
    return {
      mode: 'none',
      targetAspectRatio: 0.8,
      objectFit: 'cover',
      letterboxCount: 0,
      cropCount: 0,
      noneCount: 0,
    };
  }
  
  // Analyze each image based on orientation
  // Instagram's standard is 4:5 (0.8 ratio) - anything outside this range gets transformed
  for (const imageUrl of selectedImages) {
    const dims = dimensions.get(imageUrl);
    if (!dims) {
      // Unknown dimensions, default to none (will be determined at publish time)
      noneCount++;
      continue;
    }
    
    const originalRatio = dims.width / dims.height;
    
    // LANDSCAPE: ratio > 1.0 (wider than square)
    if (originalRatio > 1.0) {
      landscapeCount++;
      totalLandscapeRatio += originalRatio;
    }
    // VERY TALL PORTRAIT: ratio < 0.8 (taller than 4:5)
    // These get cropped to fit 4:5
    else if (originalRatio < 0.8) {
      cropCount++;
    }
    // FITS NATURALLY: ratio between 0.8 and 1.0 (portrait or square-ish)
    // These fit Instagram's 4:5 format without transformation
    else {
      noneCount++;
    }
  }
  
  // Determine majority mode
  // Ties: prefer letterbox (more cinematic, preserves full image)
  let mode: CarouselTransformMode;
  let objectFit: 'contain' | 'cover';
  let targetAspectRatio: number;
  
  if (landscapeCount >= cropCount && landscapeCount >= noneCount) {
    mode = 'letterbox';
    objectFit = 'contain'; // Show full image without cropping
    // Use average landscape ratio (clamped to Instagram's max 1.91)
    const avgRatio = landscapeCount > 0 ? totalLandscapeRatio / landscapeCount : 1.78;
    targetAspectRatio = Math.min(avgRatio, 1.91);
  } else if (cropCount > landscapeCount && cropCount >= noneCount) {
    mode = 'crop';
    objectFit = 'cover';
    targetAspectRatio = 0.8;
  } else {
    mode = 'none';
    objectFit = 'cover';
    targetAspectRatio = 0.8;
  }
  
  return {
    mode,
    targetAspectRatio,
    objectFit,
    letterboxCount: landscapeCount, // renamed for clarity
    cropCount,
    noneCount,
  };
}

/**
 * Instagram Preview Transform Info
 * Returns CSS styles to locally simulate Cloudinary's Instagram transformations
 * 
 * This matches the Cloudinary logic:
 * - If image is WIDER than target ratio → use c_pad (adds top/bottom black bars) → object-fit: contain
 * - If image is TALLER than target ratio → use c_lfill (crops to fill width) → object-fit: cover
 */
export interface InstagramPreviewStyle {
  /** CSS object-fit value: 'contain' for letterbox, 'cover' for crop */
  objectFit: 'contain' | 'cover';
  /** The target aspect ratio (numeric) */
  targetAspectRatio: number;
  /** Whether black bars will be added (letterboxing) */
  willLetterbox: boolean;
  /** Whether the image will be cropped */
  willCrop: boolean;
}

/**
 * Get the CSS styles needed to preview how an image will look on Instagram
 * after Cloudinary transformations are applied.
 * 
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @returns Style info for accurate Instagram preview
 */
export function getInstagramPreviewStyle(
  originalWidth: number | undefined,
  originalHeight: number | undefined
): InstagramPreviewStyle {
  // Default when dimensions unknown - assume portrait 4:5, use cover (c_lfill default)
  if (!originalWidth || !originalHeight) {
    return {
      objectFit: 'cover',
      targetAspectRatio: 0.8,
      willLetterbox: false,
      willCrop: true,
    };
  }
  
  const originalRatio = originalWidth / originalHeight;
  
  // Determine target aspect ratio (same logic as getClosestInstagramAspectRatio)
  const targetRatioStr = getClosestInstagramAspectRatio(originalWidth, originalHeight);
  const targetRatio = parseFloat(targetRatioStr);
  
  // If image is WIDER than target ratio, use c_pad (letterbox with top/bottom bars)
  // Example: 21:9 image (2.33) going to 1.91:1 → needs top/bottom padding
  if (originalRatio > targetRatio) {
    return {
      objectFit: 'contain',
      targetAspectRatio: targetRatio,
      willLetterbox: true,
      willCrop: false,
    };
  }
  
  // If image is TALLER than target (or same), use c_lfill (crops top/bottom, fills width)
  // Example: 9:16 image (0.56) going to 4:5 (0.8) → crops to fill width, no side bars
  return {
    objectFit: 'cover',
    targetAspectRatio: targetRatio,
    willLetterbox: false,
    willCrop: originalRatio < targetRatio,
  };
}

/**
 * Build a Cloudinary URL directly from project ID and image index
 * This is the core function - matches main site pattern: portfolio-projects-{recordId}-{index}
 * 
 * @param projectId - The project's record ID
 * @param imageIndex - The image's index in the gallery
 * @param preset - Image quality preset ('fine' for preview, 'instagram' for publishing)
 * @param aspectRatio - Optional aspect ratio for Instagram (e.g., '0.8', '1.0', '1.91' - use decimals to avoid colons in URL)
 * @param originalWidth - Optional original image width (for smart crop/pad decision)
 * @param originalHeight - Optional original image height (for smart crop/pad decision)
 */
export function buildCloudinaryUrl(
  projectId: string,
  imageIndex: number,
  preset: ImagePreset = 'fine',
  aspectRatio?: string,
  originalWidth?: number,
  originalHeight?: number
): string {
  // Build public ID in the same format as main site
  const publicId = `portfolio-projects-${projectId}-${imageIndex}`;
  
  const presetConfig = IMAGE_PRESETS[preset];
  
  // For Instagram preset, fit to aspect ratio
  // IMPORTANT: Only allow letterboxing on TOP/BOTTOM (vertical bars), never on LEFT/RIGHT
  // - If image is WIDER than target ratio → use c_pad (adds top/bottom black bars) ✓
  // - If image is TALLER than target ratio → use c_lfill (crops top/bottom to fill width) 
  if (preset === 'instagram' || !presetConfig.format || !presetConfig.width) {
    // Use provided aspect ratio or default to 4:5
    const ar = aspectRatio || INSTAGRAM_ASPECT_RATIOS.PORTRAIT_4_5;
    const targetRatio = parseFloat(ar);
    
    // Determine crop mode based on original image dimensions
    // Default to c_lfill (fill width, crop height) to avoid side bars
    // Only use c_pad if we have dimensions AND image is wider than target
    let cropMode = 'c_lfill'; // Fill width, crop height if needed (no side bars)
    
    if (originalWidth && originalHeight) {
      const originalRatio = originalWidth / originalHeight;
      
      // If image is WIDER than target ratio, use c_pad (adds top/bottom bars only)
      // Example: 21:9 image (2.33) going to 1.91:1 → needs top/bottom padding
      if (originalRatio > targetRatio) {
        cropMode = 'c_pad';
      }
      // If image is TALLER than target, use c_lfill (crops top/bottom, fills width)
      // Example: 9:16 image (0.56) going to 4:5 (0.8) → crops to fill width, no side bars
    }
    
    // Instagram transformation
    // c_pad: adds padding (only used when image is wider than target - top/bottom bars)
    // c_lfill: fills width, crops height (used when image is taller - no side bars)
    // IMPORTANT: Must use chained transformations - first fit to ratio, then limit width
    // Instagram limits: max 1440px width, ratio between 4:5 (0.8) and 1.91:1
    const igTransforms = [
      `ar_${ar}`,     // Aspect ratio (dynamic based on original image)
      cropMode,       // Crop mode: c_pad (top/bottom bars) or c_lfill (fill width, crop height)
      'b_black',      // Black background for letterboxing (only applies with c_pad)
      'g_center',     // Center the image
      'q_95',         // High quality
      'f_jpg'         // JPEG format for compatibility
    ].join(',');
    
    // Chain a second transformation to limit width (prevents Instagram rejection for large images)
    const widthLimit = 'w_1440,c_limit';
    
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${igTransforms}/${widthLimit}/${publicId}.jpg`;
  }
  
  // Build transformation string for preview (optimized for app display)
  const transforms = [
    `f_${presetConfig.format}`,
    `w_${presetConfig.width}`,
    'c_limit', // Don't upscale
    `q_${presetConfig.quality}`
  ].join(',');

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}

/**
 * Build Cloudinary URL for Instagram with automatic aspect ratio detection
 * Fetches image dimensions and crops to the closest acceptable ratio
 * 
 * IMPORTANT: Passes original dimensions to buildCloudinaryUrl so it can decide
 * whether to use c_pad (for wider images - top/bottom bars) or c_lfill (for taller images - no side bars)
 * 
 * @param projectId - The project's record ID
 * @param imageIndex - The image's index in the gallery
 * @param width - Original image width (optional - will use default if not provided)
 * @param height - Original image height (optional - will use default if not provided)
 */
export function buildInstagramUrlWithRatio(
  projectId: string,
  imageIndex: number,
  width?: number,
  height?: number
): string {
  // If dimensions provided, calculate closest ratio and pass dimensions for crop/pad decision
  if (width && height) {
    const aspectRatio = getClosestInstagramAspectRatio(width, height);
    return buildCloudinaryUrl(projectId, imageIndex, 'instagram', aspectRatio, width, height);
  }
  
  // Default to 4:5 portrait if no dimensions (will use c_lfill to avoid side bars)
  return buildCloudinaryUrl(projectId, imageIndex, 'instagram', INSTAGRAM_ASPECT_RATIOS.PORTRAIT_4_5);
}

/**
 * Build Cloudinary URL for app preview (uses 'fine' preset - optimized for fast loading)
 */
export function buildPreviewUrl(projectId: string, imageIndex: number): string {
  return buildCloudinaryUrl(projectId, imageIndex, 'fine');
}

/**
 * Build Cloudinary URL for Instagram publishing (original quality, no transformations)
 */
export function buildInstagramUrl(projectId: string, imageIndex: number): string {
  return buildCloudinaryUrl(projectId, imageIndex, 'instagram');
}

/**
 * Get optimized Cloudinary URL with transformations
 * For URLs that are already Cloudinary URLs
 */
export function getOptimizedCloudinaryUrl(
  cloudinaryUrl: string,
  preset: ImagePreset = 'fine'
): string {
  if (!cloudinaryUrl || !isCloudinaryUrl(cloudinaryUrl)) {
    return cloudinaryUrl;
  }

  const presetConfig = IMAGE_PRESETS[preset];

  // Parse existing URL and extract public ID
  // URL format: https://res.cloudinary.com/{cloud}/image/upload/{transforms}/{publicId}
  const uploadIndex = cloudinaryUrl.indexOf('/upload/');
  if (uploadIndex === -1) {
    return cloudinaryUrl;
  }

  const baseUrl = cloudinaryUrl.substring(0, uploadIndex + 8); // includes '/upload/'
  const rest = cloudinaryUrl.substring(uploadIndex + 8);
  
  // Get the public ID (last part after transforms)
  const parts = rest.split('/');
  const publicId = parts[parts.length - 1];
  
  // For Instagram preset, return original file without transformations
  if (preset === 'instagram' || !presetConfig.format || !presetConfig.width) {
    return `${baseUrl}${publicId}`;
  }
  
  // Build transformation string
  const transforms = [
    `f_${presetConfig.format}`,
    `w_${presetConfig.width}`,
    'c_limit',
    `q_${presetConfig.quality}`
  ].join(',');

  return `${baseUrl}${transforms}/${publicId}`;
}

/**
 * Get original quality Cloudinary URL (for Instagram publishing)
 */
export function getOriginalCloudinaryUrl(cloudinaryUrl: string): string {
  return getOptimizedCloudinaryUrl(cloudinaryUrl, 'instagram');
}

/**
 * Convert an image URL to its Cloudinary equivalent
 * REQUIRES projectId and imageIndex to build the correct URL
 * 
 * @param url - Original image URL (Airtable or Cloudinary)
 * @param projectId - The project's record ID (required for Airtable URLs)
 * @param imageIndex - The image's index in the gallery (required for Airtable URLs)
 * @returns Optimized Cloudinary URL
 */
export async function getCloudinaryUrl(
  url: string,
  projectId?: string,
  imageIndex?: number
): Promise<string> {
  if (!url) return url;

  // If already a Cloudinary URL, just optimize it
  if (isCloudinaryUrl(url)) {
    return getOptimizedCloudinaryUrl(url);
  }

  // If not an Airtable URL, return as-is
  if (!isAirtableUrl(url)) {
    return url;
  }

  // For Airtable URLs, we NEED the projectId and imageIndex
  if (projectId !== undefined && imageIndex !== undefined) {
    // Verify project exists in mapping (optional validation)
    await loadCloudinaryMapping();
    
    if (projectImageMap?.has(projectId)) {
      const images = projectImageMap.get(projectId)!;
      if (imageIndex < images.length) {
        // Use the cloudinaryUrl from mapping (it's reliable)
        return getOptimizedCloudinaryUrl(images[imageIndex].cloudinaryUrl);
      }
    }
    
    // Fallback: build URL directly (if project not in mapping yet)
    return buildCloudinaryUrl(projectId, imageIndex);
  }

  // No projectId/imageIndex provided - can't convert
  console.warn('Cannot convert Airtable URL without projectId and imageIndex:', url.substring(0, 60) + '...');
  return url;
}

/**
 * Get all Cloudinary URLs for a project's gallery
 * Uses the mapping if available, otherwise builds URLs from ID + index
 * 
 * @param projectId - The project's record ID
 * @param originalUrls - Original URLs from the project (for counting)
 * @returns Array of Cloudinary URLs
 */
export async function getProjectCloudinaryUrls(
  projectId: string,
  originalUrls: string[]
): Promise<string[]> {
  await loadCloudinaryMapping();

  // Try to get from mapping first (most reliable)
  if (projectImageMap?.has(projectId)) {
    const images = projectImageMap.get(projectId)!;
    // Return all images from mapping, optimized
    return images.map(img => getOptimizedCloudinaryUrl(img.cloudinaryUrl));
  }

  // Fallback: build URLs from projectId + index
  console.log(`Building Cloudinary URLs for project ${projectId} (${originalUrls.length} images)`);
  return originalUrls.map((_, index) => buildCloudinaryUrl(projectId, index));
}

/**
 * Synchronous version for immediate rendering
 * REQUIRES projectId and imageIndex to work
 */
export function getCloudinaryUrlSync(
  url: string,
  projectId?: string,
  imageIndex?: number
): string {
  if (!url) return url;

  // If already a Cloudinary URL, just optimize it
  if (isCloudinaryUrl(url)) {
    return getOptimizedCloudinaryUrl(url);
  }

  // If not an Airtable URL, return as-is
  if (!isAirtableUrl(url)) {
    return url;
  }

  // For Airtable URLs, we NEED the projectId and imageIndex
  if (projectId !== undefined && imageIndex !== undefined) {
    // Try mapping first
    if (projectImageMap?.has(projectId)) {
      const images = projectImageMap.get(projectId)!;
      if (imageIndex < images.length) {
        return getOptimizedCloudinaryUrl(images[imageIndex].cloudinaryUrl);
      }
    }
    // Build URL directly
    return buildCloudinaryUrl(projectId, imageIndex);
  }

  // Can't convert without context
  return url;
}

/**
 * Convert an array of URLs to Cloudinary URLs for preview (optimized)
 * Uses 'fine' preset for app display
 */
export async function ensureCloudinaryUrls(
  urls: string[],
  projectId: string
): Promise<string[]> {
  await loadCloudinaryMapping();
  return urls.map((_, index) => buildCloudinaryUrl(projectId, index, 'fine'));
}

/**
 * Load image dimensions from URL
 * Returns { width, height } or null if failed
 */
async function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      console.warn('Failed to load image dimensions:', imageUrl.substring(0, 50));
      resolve(null);
    };
    // Load the actual image to get true dimensions (don't use tiny preview - causes rounding errors)
    img.src = imageUrl;
  });
}

/**
 * Get original quality Cloudinary URLs for Instagram publishing
 * 
 * @param urls - Array of image URLs
 * @param projectId - Project ID for Cloudinary mapping
 * @param imageMode - 'fill' = crop to fill (no bars), 'fit' = letterbox (preserve full image)
 * 
 * When imageMode is 'fill':
 * - Uses c_lfill (fill crop) for all images with 4:5 ratio
 * - Crops to fill the frame, no letterbox bars
 * 
 * When imageMode is 'fit':
 * - Uses MAJORITY RULE: All carousel images use the same aspect ratio for consistency
 * - Landscape majority → 1.91:1 with c_pad (letterbox top/bottom)
 * - Portrait majority → 4:5 with c_lfill (crop height)
 * - c_pad adds letterbox bars to preserve full image
 */
export async function getInstagramPublishUrls(
  urls: string[],
  projectId: string,
  imageMode: 'fill' | 'fit' = 'fit'
): Promise<string[]> {
  await loadCloudinaryMapping();
  
  // First pass: Get dimensions for all images and determine their categories
  const imageData: Array<{
    url: string;
    imageIndex: number;
    dimensions: { width: number; height: number } | null;
  }> = [];
  
  let landscapeCount = 0;
  let portraitCount = 0;
  let normalCount = 0;
  let totalLandscapeRatio = 0; // Track for FIT mode average calculation
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    // Find the actual image index from the URL
    let imageIndex = i;
    if (url.includes('res.cloudinary.com')) {
      const match = url.match(/portfolio-projects-[^-]+-([\d]+)/);
      if (match) {
        imageIndex = parseInt(match[1], 10);
      }
    }
    
    // Get dimensions
    const previewUrl = buildCloudinaryUrl(projectId, imageIndex, 'fine');
    const dimensions = await getImageDimensions(previewUrl);
    
    imageData.push({ url, imageIndex, dimensions });
    
    if (dimensions) {
      const ratio = dimensions.width / dimensions.height;
      // MUST use SAME categorization as getCarouselTransformMode() for consistency
      if (ratio > 1.0) {
        landscapeCount++;
        totalLandscapeRatio += ratio; // Track for FIT mode calculation
      } else if (ratio < 0.8) {
        portraitCount++;
      } else {
        normalCount++;
      }
    }
  }
  
  // Determine majority orientation
  const isLandscapeMajority = landscapeCount >= portraitCount && landscapeCount >= normalCount;
  
  // FILL MODE: Crop to fill (no letterbox), respecting majority orientation
  if (imageMode === 'fill') {
    const targetAspectRatio = isLandscapeMajority 
      ? INSTAGRAM_ASPECT_RATIOS.LANDSCAPE_191_100 
      : INSTAGRAM_ASPECT_RATIOS.PORTRAIT_4_5;
    
    console.log(`📐 FILL mode: Cropping to ${isLandscapeMajority ? '1.91:1 (landscape)' : '4:5 (portrait)'} with c_lfill (${landscapeCount}L, ${portraitCount}P, ${normalCount}N)`);
    
    return imageData.map(({ imageIndex }) => {
      return buildCloudinaryUrlForCarousel(projectId, imageIndex, targetAspectRatio, 'lfill');
    });
  }
  
  // FIT MODE: Preserve original images with same logic as preview
  // CRITICAL: MUST match getCarouselTransformMode() exactly
  // - Landscape majority: objectFit='contain' → use c_fill for ALL images (letterbox ONLY top/bottom, no side bars)
  // - Portrait/crop majority: objectFit='cover' → use c_lfill for ALL images (crop to fill)
  
  if (isLandscapeMajority) {
    // Landscape majority: ALL images use c_fill with calculated average landscape ratio
    // c_fill adds letterbox ONLY where needed (top/bottom for landscape), NO side bars
    // Matches preview's objectFit='contain' which preserves full image
    const avgRatio = landscapeCount > 0 ? totalLandscapeRatio / landscapeCount : 1.78;
    const clampedRatio = Math.min(avgRatio, 1.91);
    const landscapeAspectRatio = clampedRatio.toFixed(2);
    
    console.log(`📐 FIT mode landscape majority (avg ${landscapeAspectRatio}): ALL images → c_fill (top/bottom letterbox ONLY, no side bars)`);
    
    const results: string[] = [];
    
    for (let i = 0; i < imageData.length; i++) {
      const { imageIndex, dimensions } = imageData[i];
      console.log(`📐 Image ${i + 1}/${urls.length} (index ${imageIndex}): ${dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown'} → ${landscapeAspectRatio} c_fill`);
      results.push(buildCloudinaryUrlForCarousel(projectId, imageIndex, landscapeAspectRatio, 'fill'));
    }
    
    return results;
    
  } else if (portraitCount > landscapeCount && portraitCount >= normalCount) {
    // Portrait majority: ALL images use c_lfill with 4:5
    // Matches preview's objectFit='cover' which crops all images
    const portraitAspectRatio = INSTAGRAM_ASPECT_RATIOS.PORTRAIT_4_5; // "0.8"
    
    console.log(`📐 FIT mode portrait majority: ALL images → 4:5 c_lfill (crop to fill, matches preview objectFit='cover')`);
    
    const results: string[] = [];
    
    for (let i = 0; i < imageData.length; i++) {
      const { imageIndex } = imageData[i];
      console.log(`📐 Image ${i + 1}/${urls.length} (index ${imageIndex}): → 4:5 c_lfill`);
      results.push(buildCloudinaryUrlForCarousel(projectId, imageIndex, portraitAspectRatio, 'lfill'));
    }
    
    return results;
    
  } else {
    // Normal/tie: Default to 4:5 crop (same as portrait majority)
    const portraitAspectRatio = INSTAGRAM_ASPECT_RATIOS.PORTRAIT_4_5;
    
    console.log(`📐 FIT mode normal/default: ALL images → 4:5 c_lfill`);
    
    const results: string[] = [];
    
    for (let i = 0; i < imageData.length; i++) {
      const { imageIndex } = imageData[i];
      console.log(`📐 Image ${i + 1}/${urls.length} (index ${imageIndex}): → 4:5 c_lfill`);
      results.push(buildCloudinaryUrlForCarousel(projectId, imageIndex, portraitAspectRatio, 'lfill'));
    }
    
    return results;
  }
}

/**
 * Build Cloudinary URL for carousel with consistent aspect ratio
 * 
 * @param projectId - Project ID
 * @param imageIndex - Image index
 * @param aspectRatio - Target aspect ratio (e.g., "4:5", "1.91:1")
 * @param cropMode - 'lfill' = fill and crop (no bars), 'pad' = letterbox (preserve full image)
 */
function buildCloudinaryUrlForCarousel(
  projectId: string,
  imageIndex: number,
  aspectRatio: string,
  cropMode: 'lfill' | 'pad' | 'fill' = 'lfill'
): string {
  const publicId = `portfolio-projects-${projectId}-${imageIndex}`;
  
  // Instagram transformation
  const igTransforms = cropMode === 'fill' ? [
    `ar_${aspectRatio}`,  // Consistent aspect ratio for all carousel images
    'c_fill',             // Fill to aspect ratio, letterbox ONLY where needed (not all sides)
    'b_black',            // Black letterbox bars (if any)
    'g_center',           // Center the image
    'q_95',               // High quality
    'f_jpg'               // JPEG format for compatibility
  ].join(',') : cropMode === 'pad' ? [
    `ar_${aspectRatio}`,  // Consistent aspect ratio for all carousel images
    'c_pad',              // Pad to fit (adds letterbox bars on all sides)
    'b_black',            // Black letterbox bars
    'g_center',           // Center the image
    'q_95',               // High quality
    'f_jpg'               // JPEG format for compatibility
  ].join(',') : [
    `ar_${aspectRatio}`,  // Consistent aspect ratio for all carousel images
    'c_lfill',            // Fill width, crop height - NO side bars ever
    'g_center',           // Center the image
    'q_95',               // High quality
    'f_jpg'               // JPEG format for compatibility
  ].join(',');
  
  // Chain a second transformation to limit width
  const widthLimit = 'w_1440,c_limit';
  
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${igTransforms}/${widthLimit}/${publicId}.jpg`;
}

/**
 * Check if mapping is loaded and ready
 */
export function isCloudinaryMappingLoaded(): boolean {
  return cloudinaryMappingCache !== null;
}

/**
 * Check if a project exists in the Cloudinary mapping
 */
export function isProjectInMapping(projectId: string): boolean {
  return projectImageMap?.has(projectId) ?? false;
}

/**
 * Get the number of images for a project in the mapping
 */
export function getProjectImageCount(projectId: string): number {
  return projectImageMap?.get(projectId)?.length ?? 0;
}

/**
 * Force reload the mapping (useful after updates)
 */
export async function reloadCloudinaryMapping(): Promise<void> {
  cloudinaryMappingCache = null;
  cloudinaryMappingPromise = null;
  projectImageMap = null;
  await loadCloudinaryMapping();
}

/**
 * Wait for mapping to load - returns a promise that resolves when mapping is ready
 */
export async function waitForCloudinaryMapping(): Promise<boolean> {
  const mapping = await loadCloudinaryMapping();
  return mapping !== null;
}

// Callbacks for when mapping loads
const mappingLoadedCallbacks: Set<() => void> = new Set();

/**
 * Register a callback to be called when mapping loads
 */
export function onMappingLoaded(callback: () => void): () => void {
  if (cloudinaryMappingCache) {
    // Already loaded, call immediately
    callback();
  } else {
    mappingLoadedCallbacks.add(callback);
  }
  // Return unsubscribe function
  return () => mappingLoadedCallbacks.delete(callback);
}

// Pre-load the mapping when the module is imported
loadCloudinaryMapping().then(() => {
  // Notify all callbacks that mapping is loaded
  mappingLoadedCallbacks.forEach(cb => cb());
  mappingLoadedCallbacks.clear();
});
