/**
 * Instagram API Types
 */

export interface InstagramCredentials {
  connected: boolean;
  accountId: string | null;
  username: string | null;
  accessToken: string | null;
  tokenExpiry: string | null;  // ISO date string
  lastRefreshed: string | null; // ISO date string
}

export interface InstagramTokenResponse {
  access_token: string;
  user_id: number;
}

export interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds (typically 5184000 = 60 days)
}

export interface InstagramUserResponse {
  id: string;
  username: string;
  account_type: string;
  media_count: number;
}

export interface InstagramMediaContainerResponse {
  id: string;
}

export interface InstagramPublishResponse {
  id: string;
}

export interface InstagramMediaStatusResponse {
  status_code: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
}

export interface InstagramError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
}

export type PostPublishStatus = 'idle' | 'creating' | 'publishing' | 'success' | 'error';

export interface PublishResult {
  success: boolean;
  instagramPostId?: string;
  permalink?: string;
  error?: string;
}

// Rate limit tracking - now sourced from Instagram API headers
export interface RateLimitInfo {
  // Legacy fields for backwards compatibility
  callsRemaining: number;
  callsLimit: number;
  resetTime: string | null;
  postsToday: number;
  postsLimit: number; // 25 per day
  
  // New fields from Instagram API headers
  lastUpdated?: string;
  appUsage?: {
    callCount: number;      // Percentage of calls used (0-100)
    totalCpuTime: number;   // Percentage of CPU time used
    totalTime: number;      // Percentage of total time used
  };
  businessUsage?: {
    businessId: string;
    useCases: {
      [key: string]: {
        type: string;
        callCount: number;              // Percentage used (0-100)
        totalCpuTime: number;
        totalTime: number;
        estimatedTimeToRegainAccess: number; // Minutes until rate limit reset
      };
    };
  };
}
