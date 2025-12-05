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
  error?: string;
}

// Rate limit tracking
export interface RateLimitInfo {
  callsRemaining: number;
  callsLimit: number;
  resetTime: string | null;
  postsToday: number;
  postsLimit: number; // 25 per day
}
