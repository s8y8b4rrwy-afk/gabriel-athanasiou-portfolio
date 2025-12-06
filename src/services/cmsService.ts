import { Project, BlogPost, HomeConfig } from '../types';
import { calculateReadingTime } from '../utils/helpers/textHelpers';

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
// DATA FETCHING FROM CLOUDINARY CDN
// ==========================================

// Cloudinary CDN URL for static portfolio data (primary source)
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'date24ay6';
const PORTFOLIO_MODE = import.meta.env.VITE_PORTFOLIO_MODE || 'directing';
const CLOUDINARY_DATA_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/portfolio-static/portfolio-data-${PORTFOLIO_MODE}.json`;
const LOCAL_DATA_URL = `/portfolio-data-${PORTFOLIO_MODE}.json`;

// Generate cache-busting URL with timestamp
const getCacheBustedUrl = (baseUrl: string): string => {
    const timestamp = Date.now();
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}_t=${timestamp}`;
};

const fetchCachedData = async (): Promise<ApiResponse> => {
    // Check if cache is still valid
    if (cachedData && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        console.log('[cmsService] Using client-side cache');
        return cachedData;
    }

    // Try Cloudinary CDN first (primary source)
    try {
        // Add timestamp to bypass CDN cache and get fresh data
        const freshUrl = getCacheBustedUrl(CLOUDINARY_DATA_URL);
        console.log('[cmsService] Fetching fresh data from Cloudinary CDN');
        
        const response = await fetch(freshUrl, {
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            },
            cache: 'no-store' // Bypass browser cache
        });

        if (!response.ok) {
            throw new Error(`Cloudinary fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the data
        cachedData = {
            projects: data.projects || [],
            posts: data.posts || [],
            config: data.config || getDefaultConfig()
        };
        cacheTimestamp = Date.now();

        console.log(`[cmsService] ✅ Loaded from Cloudinary: ${cachedData.projects.length} projects, ${cachedData.posts.length} posts`);
        
        return cachedData;
    } catch (cloudinaryError) {
        console.warn('[cmsService] ⚠️ Cloudinary fetch failed, trying local fallback:', cloudinaryError);
        
        // Fallback to local static file with cache-busting
        try {
            const localUrl = getCacheBustedUrl(LOCAL_DATA_URL);
            const response = await fetch(localUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`Local fetch failed: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the data
            cachedData = {
                projects: data.projects || [],
                posts: data.posts || [],
                config: data.config || getDefaultConfig()
            };
            cacheTimestamp = Date.now();

            console.log(`[cmsService] ✅ Loaded from local fallback: ${cachedData.projects.length} projects, ${cachedData.posts.length} posts`);
            
            return cachedData;
        } catch (localError) {
            console.error('[cmsService] ❌ Both Cloudinary and local fetch failed');
            console.error('Cloudinary error:', cloudinaryError);
            console.error('Local error:', localError);
            
            // If we have stale cache, return it
            if (cachedData) {
                console.warn('[cmsService] Using stale cache due to fetch errors');
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
