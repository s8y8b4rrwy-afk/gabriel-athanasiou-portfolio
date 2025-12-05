import { useState, useEffect, useMemo } from 'react';
import type { Project, PortfolioData } from '../types';

const PORTFOLIO_DATA_URL = '/portfolio-data-postproduction.json';

interface UseProjectsOptions {
  filterType?: string;
  filterKind?: string;
  filterYear?: string;
  searchQuery?: string;
  showOnlyWithImages?: boolean;
}

interface UseProjectsReturn {
  projects: Project[];
  allProjects: Project[];
  isLoading: boolean;
  error: string | null;
  filters: {
    types: string[];
    kinds: string[];
    years: string[];
  };
  refetch: () => Promise<void>;
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    filterType,
    filterKind,
    filterYear,
    searchQuery,
    showOnlyWithImages = true,
  } = options;

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch from public folder (served by vite)
      const response = await fetch(PORTFOLIO_DATA_URL);
      
      if (!response.ok) {
        // Try alternative path for development
        const altResponse = await fetch('../../public/portfolio-data-postproduction.json');
        if (!altResponse.ok) {
          throw new Error(`Failed to fetch portfolio data: ${response.status}`);
        }
        const data: PortfolioData = await altResponse.json();
        setAllProjects(data.projects);
        return;
      }

      const data: PortfolioData = await response.json();
      setAllProjects(data.projects);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Extract unique filter values
  const filters = useMemo(() => {
    const types = [...new Set(allProjects.map(p => p.type).filter(Boolean))];
    const kinds = [...new Set(allProjects.flatMap(p => p.kinds).filter(Boolean))];
    const years = [...new Set(allProjects.map(p => p.year).filter(Boolean))].sort((a, b) => b.localeCompare(a));

    return { types, kinds, years };
  }, [allProjects]);

  // Filter projects
  const projects = useMemo(() => {
    let filtered = allProjects;

    // Only show projects with images (for Instagram)
    if (showOnlyWithImages) {
      filtered = filtered.filter(p => p.heroImage || p.gallery.length > 0);
    }

    // Filter by type
    if (filterType) {
      filtered = filtered.filter(p => p.type === filterType);
    }

    // Filter by kind
    if (filterKind) {
      filtered = filtered.filter(p => p.kinds.includes(filterKind));
    }

    // Filter by year
    if (filterYear) {
      filtered = filtered.filter(p => p.year === filterYear);
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.client.toLowerCase().includes(query) ||
        p.productionCompany.toLowerCase().includes(query)
      );
    }

    // Sort by work date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = a.workDate || a.releaseDate || '0000-00-00';
      const dateB = b.workDate || b.releaseDate || '0000-00-00';
      return dateB.localeCompare(dateA);
    });
  }, [allProjects, filterType, filterKind, filterYear, searchQuery, showOnlyWithImages]);

  return {
    projects,
    allProjects,
    isLoading,
    error,
    filters,
    refetch: fetchProjects,
  };
}
