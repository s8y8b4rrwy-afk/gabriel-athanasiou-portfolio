/**
 * React hook for converting image URLs to Cloudinary URLs
 */

import { useState, useEffect, useMemo } from 'react';
import { getCloudinaryUrl, getProjectCloudinaryUrls } from '../utils/imageUtils';

/**
 * Hook to convert a single image URL to its Cloudinary equivalent
 */
export function useCloudinaryImage(
  url: string | undefined,
  projectId?: string,
  imageIndex?: number
): { imageUrl: string; isLoading: boolean } {
  const [imageUrl, setImageUrl] = useState(url || '');
  const [isLoading, setIsLoading] = useState(!!url);

  useEffect(() => {
    if (!url) {
      setImageUrl('');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getCloudinaryUrl(url, projectId, imageIndex).then((cloudinaryUrl) => {
      if (!cancelled) {
        setImageUrl(cloudinaryUrl);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url, projectId, imageIndex]);

  return { imageUrl, isLoading };
}

/**
 * Hook to convert multiple image URLs to their Cloudinary equivalents
 */
export function useCloudinaryImages(
  urls: string[],
  projectId?: string
): { imageUrls: string[]; isLoading: boolean } {
  const [imageUrls, setImageUrls] = useState<string[]>(urls);
  const [isLoading, setIsLoading] = useState(urls.length > 0);

  // Memoize the URL array to prevent unnecessary re-renders
  const urlsKey = useMemo(() => urls.join('|'), [urls]);

  useEffect(() => {
    if (urls.length === 0) {
      setImageUrls([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    if (projectId) {
      // Use project-based lookup for better accuracy
      getProjectCloudinaryUrls(projectId, urls).then((cloudinaryUrls) => {
        if (!cancelled) {
          setImageUrls(cloudinaryUrls);
          setIsLoading(false);
        }
      });
    } else {
      // Convert each URL individually
      Promise.all(urls.map((url, index) => getCloudinaryUrl(url, undefined, index))).then(
        (cloudinaryUrls) => {
          if (!cancelled) {
            setImageUrls(cloudinaryUrls);
            setIsLoading(false);
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [urlsKey, projectId]);

  return { imageUrls, isLoading };
}

/**
 * Hook to get all project images (heroImage + gallery) as Cloudinary URLs
 */
export function useProjectImages(project: {
  id: string;
  heroImage?: string;
  gallery: string[];
} | null): { images: string[]; isLoading: boolean } {
  const allUrls = useMemo(() => {
    if (!project) return [];
    return [
      ...(project.heroImage ? [project.heroImage] : []),
      ...project.gallery
    ].filter(Boolean);
  }, [project?.id, project?.heroImage, project?.gallery]);

  const { imageUrls, isLoading } = useCloudinaryImages(allUrls, project?.id);
  return { images: imageUrls, isLoading };
}
