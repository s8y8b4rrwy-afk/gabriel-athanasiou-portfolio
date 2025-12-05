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
  instagram: {
    quality: 100,
    width: null, // No width limit - use original
    format: null // No format conversion - use original
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
 * Build a Cloudinary URL directly from project ID and image index
 * This is the core function - matches main site pattern: portfolio-projects-{recordId}-{index}
 * 
 * @param projectId - The project's record ID
 * @param imageIndex - The image's index in the gallery
 * @param preset - Image quality preset ('fine' for preview, 'instagram' for publishing)
 */
export function buildCloudinaryUrl(
  projectId: string,
  imageIndex: number,
  preset: ImagePreset = 'fine'
): string {
  // Build public ID in the same format as main site
  const publicId = `portfolio-projects-${projectId}-${imageIndex}`;
  
  const presetConfig = IMAGE_PRESETS[preset];
  
  // For Instagram preset, return original file without transformations
  // Add .jpg extension for Instagram API compatibility
  if (preset === 'instagram' || !presetConfig.format || !presetConfig.width) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}.jpg`;
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
 * Get original quality Cloudinary URLs for Instagram publishing
 * Returns URLs WITHOUT any transformations - Instagram gets the original files
 * 
 * IMPORTANT: Use this for publishing to Instagram API, not for preview!
 */
export async function getInstagramPublishUrls(
  urls: string[],
  projectId: string
): Promise<string[]> {
  await loadCloudinaryMapping();
  return urls.map((_, index) => buildCloudinaryUrl(projectId, index, 'instagram'));
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
