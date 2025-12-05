/**
 * Image utilities for Instagram Studio
 * Converts Airtable URLs to Cloudinary URLs using the mapping file
 */

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

// Cache for the cloudinary mapping
let cloudinaryMappingCache: CloudinaryMapping | null = null;
let cloudinaryMappingPromise: Promise<CloudinaryMapping | null> | null = null;

// Build a lookup map for faster access: airtableId -> cloudinaryUrl
let airtableToCloudinaryMap: Map<string, string> | null = null;
// Also build: recordId -> images array for project-based lookups
let projectImageMap: Map<string, CloudinaryImageMapping[]> | null = null;

/**
 * Load the cloudinary mapping from the public folder
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
      const response = await fetch('/cloudinary-mapping.json');
      if (!response.ok) {
        console.warn('Failed to load cloudinary mapping:', response.status);
        return null;
      }

      const mapping: CloudinaryMapping = await response.json();
      cloudinaryMappingCache = mapping;

      // Build lookup maps
      airtableToCloudinaryMap = new Map();
      projectImageMap = new Map();

      for (const project of mapping.projects) {
        projectImageMap.set(project.recordId, project.images);
        
        for (const image of project.images) {
          if (image.airtableId) {
            airtableToCloudinaryMap.set(image.airtableId, image.cloudinaryUrl);
          }
        }
      }

      console.log(`✅ Loaded cloudinary mapping: ${mapping.projects.length} projects, ${airtableToCloudinaryMap.size} images`);
      return mapping;
    } catch (err) {
      console.error('Error loading cloudinary mapping:', err);
      return null;
    }
  })();

  return cloudinaryMappingPromise;
}

/**
 * Extract Airtable attachment ID from various URL formats
 * Airtable URLs can be:
 * - https://dl.airtable.com/.attachments/xxx/attXXXXXXXXXXXXXX/filename.jpg
 * - https://v5.airtableusercontent.com/xxx/attXXXXXXXXXXXXXX/...
 */
function extractAirtableId(url: string): string | null {
  if (!url) return null;

  // Pattern 1: /attXXXXXXXXXXXXXX/ in path
  const attMatch = url.match(/\/(att[A-Za-z0-9]{14})\//);
  if (attMatch) {
    return attMatch[1];
  }

  // Pattern 2: attXXXXXXXXXXXXXX at the end or before extension
  const attMatch2 = url.match(/(att[A-Za-z0-9]{14})/);
  if (attMatch2) {
    return attMatch2[1];
  }

  return null;
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
 * Get optimized Cloudinary URL with transformations
 * 
 * @param cloudinaryUrl - Base Cloudinary URL
 * @param options - Transformation options
 */
export function getOptimizedCloudinaryUrl(
  cloudinaryUrl: string,
  options: {
    width?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png' | 'auto';
  } = {}
): string {
  if (!cloudinaryUrl || !isCloudinaryUrl(cloudinaryUrl)) {
    return cloudinaryUrl;
  }

  const { width = 1080, quality = 85, format = 'webp' } = options;

  // Parse existing URL and insert transformations
  // URL format: https://res.cloudinary.com/{cloud}/image/upload/{transforms}/{publicId}
  const uploadIndex = cloudinaryUrl.indexOf('/upload/');
  if (uploadIndex === -1) {
    return cloudinaryUrl;
  }

  const baseUrl = cloudinaryUrl.substring(0, uploadIndex + 8); // includes '/upload/'
  const rest = cloudinaryUrl.substring(uploadIndex + 8);
  
  // Remove any existing transformations (they start with letters and contain _)
  // Public ID is usually at the end after the last transformation
  const parts = rest.split('/');
  const publicId = parts[parts.length - 1];
  
  // Build transformation string for Instagram (1080px max width, high quality)
  const transforms = [
    `f_${format}`,
    `w_${width}`,
    'c_limit', // Don't upscale
    `q_${quality}`
  ].join(',');

  return `${baseUrl}${transforms}/${publicId}`;
}

/**
 * Convert an image URL to its Cloudinary equivalent
 * Works for both Airtable URLs and already-Cloudinary URLs
 * 
 * @param url - Original image URL (Airtable or Cloudinary)
 * @param _projectId - Unused, kept for API compatibility
 * @param _imageIndex - Unused, kept for API compatibility
 * @returns Optimized Cloudinary URL or original if conversion not possible
 */
export async function getCloudinaryUrl(
  url: string,
  _projectId?: string,
  _imageIndex?: number
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

  // Load the mapping if not already loaded
  await loadCloudinaryMapping();

  if (!airtableToCloudinaryMap) {
    console.warn('Cloudinary mapping not available, using original URL');
    return url;
  }

  // Try to find by Airtable ID - this is the only reliable method
  const airtableId = extractAirtableId(url);
  if (airtableId && airtableToCloudinaryMap.has(airtableId)) {
    const cloudinaryUrl = airtableToCloudinaryMap.get(airtableId)!;
    return getOptimizedCloudinaryUrl(cloudinaryUrl);
  }

  // No match found - return original URL
  // Don't use index-based fallback as it can match wrong images
  if (airtableId) {
    console.warn('Airtable ID not found in mapping:', airtableId);
  }
  return url;
}

/**
 * Get all Cloudinary URLs for a project's images
 * 
 * @param _projectId - Unused, kept for API compatibility
 * @param originalUrls - Original URLs from the project (heroImage + gallery)
 * @returns Array of optimized Cloudinary URLs
 */
export async function getProjectCloudinaryUrls(
  _projectId: string,
  originalUrls: string[]
): Promise<string[]> {
  await loadCloudinaryMapping();

  return Promise.all(
    originalUrls.map((url) => getCloudinaryUrl(url))
  );
}

/**
 * Synchronous version that returns a promise
 * Useful for components that need immediate rendering
 */
export function useCloudinaryUrl(url: string, _projectId?: string, _imageIndex?: number): string {
  // For now, return the URL as-is for immediate rendering
  // The async conversion will happen when the mapping is loaded
  if (isCloudinaryUrl(url)) {
    return getOptimizedCloudinaryUrl(url);
  }
  return url;
}

// Pre-load the mapping when the module is imported
loadCloudinaryMapping();
