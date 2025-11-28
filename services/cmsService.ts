import { Project, BlogPost, HomeConfig } from '../types';
import { calculateReadingTime } from '../utils/textHelpers';

// Re-export commonly used utilities for backwards compatibility
export { getEmbedUrl } from '../utils/videoHelpers';
export { calculateReadingTime };

// ==========================================
// TYPES
// ==========================================

interface ApiResponse {
    projects: Project[];
    posts: BlogPost[];
    config: HomeConfig;
}

// ==========================================
// CACHE MANAGEMENT
// ==========================================

let cachedData: ApiResponse | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes client-side cache

// ==========================================
// DATA FETCHING FROM CACHED ENDPOINT
// ==========================================

const fetchCachedData = async (): Promise<ApiResponse> => {
    // Check if cache is still valid
    if (cachedData && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        console.log('[cmsService] Using client-side cache');
        return cachedData;
    }

    try {
        console.log('[cmsService] Fetching from static portfolio data');
        
        const response = await fetch('/portfolio-data.json', {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('Data not yet synced. Please wait a moment and refresh.');
            }
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the data
        cachedData = {
            projects: data.projects || [],
            posts: data.posts || [],
            config: data.config || getDefaultConfig()
        };
        cacheTimestamp = Date.now();

        console.log(`[cmsService] Loaded ${cachedData.projects.length} projects, ${cachedData.posts.length} posts`);
        
        return cachedData;
    } catch (error) {
        console.error('[cmsService] Failed to fetch cached data:', error);
        
        // If we have stale cache, return it
        if (cachedData) {
            console.warn('[cmsService] Using stale cache due to fetch error');
            return cachedData;
        }
        
        // Last resort: return empty data with default config
        console.warn('[cmsService] No cache available, using default empty state');
        return {
            projects: [],
            posts: [],
            config: getDefaultConfig()
        };
    }
};

// Default config fallback
const getDefaultConfig = (): HomeConfig => ({
    showreel: {
        enabled: false,
        videoUrl: '',
        placeholderImage: ''
    },
    contact: {
        email: '',
        phone: '',
        repUK: '',
        repUSA: '',
        instagram: '',
        vimeo: '',
        linkedin: ''
    },
    about: {
        bio: "Gabriel Athanasiou is a director and visual artist based between London and Athens.",
        profileImage: ''
    },
    allowedRoles: [],
    defaultOgImage: ''
});

// ==========================================
// PUBLIC API
// ==========================================

export const cmsService = {
    /**
     * Fetch all data (projects, posts, config) from cached endpoint
     */
    fetchAll: async (): Promise<ApiResponse> => {
        return fetchCachedData();
    },

    /**
     * Get home page configuration
     */
    getHomeConfig: async (): Promise<HomeConfig> => {
        const data = await fetchCachedData();
        return data.config;
    },

    /**
     * Get all projects
     */
    getProjects: async (): Promise<Project[]> => {
        const data = await fetchCachedData();
        return data.projects;
    },

    /**
     * Get all blog posts
     */
    getBlogPosts: async (): Promise<BlogPost[]> => {
        const data = await fetchCachedData();
        return data.posts;
    },

    /**
     * Force refresh cache (call after manual sync or when checking for updates)
     */
    invalidateCache: () => {
        cachedData = null;
        cacheTimestamp = null;
        console.log('[cmsService] Cache invalidated');
    },

    /**
     * Check if there are updates available (non-blocking background check)
     */
    checkForUpdates: async (): Promise<boolean> => {
        if (!cachedData) return false;

        try {
            const response = await fetch('/.netlify/functions/get-data', {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) return false;

            const newData = await response.json();
            const lastUpdatedHeader = response.headers.get('X-Last-Updated');
            
            // Simple check: compare data lengths
            const hasUpdates = 
                newData.projects?.length !== cachedData.projects.length ||
                newData.posts?.length !== cachedData.posts.length;

            if (hasUpdates) {
                console.log('[cmsService] Updates detected');
            }

            return hasUpdates;
        } catch (error) {
            console.warn('[cmsService] Update check failed:', error);
            return false;
        }
    }
};
