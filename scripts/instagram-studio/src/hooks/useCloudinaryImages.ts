import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getCloudinaryUrlSync, 
  isCloudinaryMappingLoaded, 
  onMappingLoaded,
  ensureCloudinaryUrls,
  getInstagramPublishUrls,
  buildCloudinaryUrl
} from '../utils/imageUtils';

/**
 * Hook to get a Cloudinary URL for a specific image in a project
 * Uses 'fine' preset for optimized preview display
 * 
 * @param url - Original image URL (Airtable or Cloudinary)
 * @param projectId - The project's record ID
 * @param imageIndex - The image's index in the gallery
 * @returns Optimized Cloudinary URL (webp, compressed)
 */
export function useCloudinaryUrl(url: string, projectId: string, imageIndex: number): string {
  const [, setMappingLoaded] = useState(isCloudinaryMappingLoaded());
  
  useEffect(() => {
    // Subscribe to mapping loaded event
    const unsubscribe = onMappingLoaded(() => {
      setMappingLoaded(true);
    });
    return unsubscribe;
  }, []);
  
  return getCloudinaryUrlSync(url, projectId, imageIndex);
}

/**
 * Hook to get multiple Cloudinary URLs for a project's gallery
 * Uses 'fine' preset for optimized preview display
 * 
 * @param urls - Array of original image URLs
 * @param projectId - The project's record ID
 * @returns Array of optimized Cloudinary URLs (webp, compressed)
 */
export function useCloudinaryUrls(urls: string[], projectId: string): string[] {
  const [, setMappingLoaded] = useState(isCloudinaryMappingLoaded());
  
  useEffect(() => {
    const unsubscribe = onMappingLoaded(() => {
      setMappingLoaded(true);
    });
    return unsubscribe;
  }, []);
  
  return useMemo(() => {
    return urls.map((url, index) => getCloudinaryUrlSync(url, projectId, index));
  }, [urls, projectId]);
}

/**
 * Hook to build Cloudinary URLs directly from project ID
 * Uses 'fine' preset for optimized preview display
 */
export function useProjectCloudinaryUrls(projectId: string, imageCount: number): string[] {
  const [, setMappingLoaded] = useState(isCloudinaryMappingLoaded());
  
  useEffect(() => {
    const unsubscribe = onMappingLoaded(() => {
      setMappingLoaded(true);
    });
    return unsubscribe;
  }, []);
  
  return useMemo(() => {
    return Array.from({ length: imageCount }, (_, index) => 
      buildCloudinaryUrl(projectId, index, 'fine')
    );
  }, [projectId, imageCount]);
}

/**
 * Hook that returns whether the Cloudinary mapping is loaded
 */
export function useCloudinaryMappingReady(): boolean {
  const [isReady, setIsReady] = useState(isCloudinaryMappingLoaded());
  
  useEffect(() => {
    if (isReady) return;
    
    const unsubscribe = onMappingLoaded(() => {
      setIsReady(true);
    });
    return unsubscribe;
  }, [isReady]);
  
  return isReady;
}

/**
 * Hook to convert URLs to optimized Cloudinary URLs for preview
 * Returns async function - uses 'fine' preset (webp, compressed)
 */
export function useEnsureCloudinaryUrls() {
  return useCallback(async (urls: string[], projectId: string): Promise<string[]> => {
    return ensureCloudinaryUrls(urls, projectId);
  }, []);
}

/**
 * Hook to get original quality Cloudinary URLs for Instagram publishing
 * Returns async function with imageMode support
 * @param imageMode - 'fill' = crop to fill (no bars), 'fit' = letterbox (preserve full image)
 */
export function useInstagramPublishUrls() {
  return useCallback(async (urls: string[], projectId: string, imageMode: 'fill' | 'fit' = 'fill'): Promise<string[]> => {
    return getInstagramPublishUrls(urls, projectId, imageMode);
  }, []);
}
