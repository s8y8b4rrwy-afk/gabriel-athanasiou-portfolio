import { useMemo, useCallback } from 'react';
import type { Project } from '../types';

/**
 * Hook for efficient project lookup by ID
 * 
 * Purpose: Replaces embedded project data in drafts with runtime lookups.
 * This prevents duplicate project data and ensures fresh data is always used.
 * 
 * Usage:
 *   const { getProject, projectMap } = useProjectLookup(projects);
 *   const project = getProject(draft.projectId);
 */
export function useProjectLookup(projects: Project[]) {
  // Build a Map for O(1) lookups
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Memoized lookup function
  const getProject = useCallback((projectId: string): Project | undefined => {
    return projectMap.get(projectId);
  }, [projectMap]);

  /**
   * Get project with a fallback stub for deleted/hidden projects
   * Use this when you need to display something even if project is missing
   */
  const getProjectWithFallback = useCallback((
    projectId: string, 
    fallbackData?: { selectedImages?: string[] }
  ): Project => {
    const project = projectMap.get(projectId);
    if (project) return project;

    // Create stub project for deleted/hidden projects
    // This prevents crashes and shows meaningful info
    return {
      id: projectId,
      title: `Project ${projectId?.slice(-6) || 'Unknown'}`,
      year: '',
      gallery: fallbackData?.selectedImages || [],
      type: 'unknown',
      slug: '',
      kinds: [],
      genre: [],
      productionCompany: '',
      client: '',
      releaseDate: '',
      workDate: '',
      description: '',
      isFeatured: false,
      isHero: false,
      heroImage: fallbackData?.selectedImages?.[0] || '',
      videoUrl: '',
      additionalVideos: [],
      awards: [],
      credits: [],
      externalLinks: [],
      relatedArticleId: null,
    };
  }, [projectMap]);

  return { 
    projectMap, 
    getProject, 
    getProjectWithFallback,
    hasProject: useCallback((projectId: string) => projectMap.has(projectId), [projectMap])
  };
}
