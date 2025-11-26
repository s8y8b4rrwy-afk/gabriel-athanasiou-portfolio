/**
 * Shared Video Utilities
 * Used across frontend and backend for consistent video handling
 * Supports YouTube and Vimeo with vanity URL resolution
 */

export interface VideoIdResult {
  type: 'youtube' | 'vimeo' | null;
  id: string | null;
  hash?: string | null;
}

/**
 * Extract video ID and type from various URL formats
 * Supports YouTube (watch, embed, youtu.be, shorts, live) and Vimeo (with hash support)
 */
export const getVideoId = (url: string): VideoIdResult => {
  if (!url) return { type: null, id: null };
  const cleanUrl = url.trim();

  // YouTube Regex
  // Covers: youtube.com/watch?v=, youtube.com/embed/, youtu.be/, youtube.com/v/, youtube.com/shorts/, youtube.com/live/
  const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (ytMatch && ytMatch[1]) {
    return { type: 'youtube', id: ytMatch[1] };
  }

  // Vimeo Regex
  // Covers: vimeo.com/123456, vimeo.com/123456/hash, player.vimeo.com/video/123456
  // Ignores prefixes: manage/videos, channels/xxx, groups/xxx/videos
  const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(?:(?:channels\/[a-zA-Z0-9]+\/)|(?:groups\/[a-zA-Z0-9]+\/videos\/)|(?:manage\/videos\/))?([0-9]+)(?:\/([a-zA-Z0-9]+))?/);
  
  if (vimeoMatch && vimeoMatch[1]) {
    let id = vimeoMatch[1];
    let hash = vimeoMatch[2] || null;

    // Check for query param hash if not found in path (?h=abcdef)
    if (!hash && cleanUrl.includes('?')) {
      try {
        const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
        const urlObj = new URL(fullUrl);
        const h = urlObj.searchParams.get('h');
        if (h) hash = h;
      } catch (e) {
        // Fallback regex if URL parsing fails
        const queryHash = cleanUrl.match(/[?&]h=([a-zA-Z0-9]+)/);
        if (queryHash) hash = queryHash[1];
      }
    }

    return { type: 'vimeo', id, hash };
  }

  return { type: null, id: null };
};

/**
 * Resolve vanity URLs and normalize video URLs
 * Uses OEmbed API for Vimeo vanity URLs as fallback
 */
export const resolveVideoUrl = async (url: string): Promise<string> => {
  if (!url) return '';
  const { type, id, hash } = getVideoId(url);
  
  // If we already have a valid ID, reconstruct the canonical URL
  if (id) {
    if (type === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
    if (type === 'vimeo') {
      return hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
    }
  }

  // Fallback: Use OEmbed only if regex failed (e.g. vanity URLs like vimeo.com/staffpicks)
  if (url.includes('vimeo.com')) {
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.video_id) {
          return `https://vimeo.com/${data.video_id}`;
        }
      }
    } catch (e) {
      console.warn(`Failed to resolve Vimeo OEmbed for: ${url}`);
    }
  }

  return url;
};

/**
 * Generate embed URL for iframe players
 */
export const getEmbedUrl = (url: string, autoplay: boolean = false, muted: boolean = false): string | null => {
  const { type, id, hash } = getVideoId(url);
  if (!type || !id) return null; 

  const params = new URLSearchParams();
  if (autoplay) {
    params.set('autoplay', '1');
    if (muted) {
      params.set('muted', '1');
    }
  }

  if (type === 'youtube') {
    params.set('rel', '0');
    params.set('modestbranding', '1');
    params.set('playsinline', '1');
    params.set('controls', '1');
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  }

  if (type === 'vimeo') {
    if (hash) params.set('h', hash);
    params.set('title', '0');
    params.set('byline', '0');
    params.set('portrait', '0');
    params.set('dnt', '1');
    params.set('playsinline', '1');
    return `https://player.vimeo.com/video/${id}?${params.toString()}`;
  }

  return null;
};

/**
 * Fetch video thumbnail URL
 * For YouTube: uses maxresdefault
 * For Vimeo: tries OEmbed first, falls back to vumbnail service
 */
export const fetchVideoThumbnail = async (url: string): Promise<string> => {
  const { type, id } = getVideoId(url);
  if (!id) return '';

  if (type === 'youtube') {
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  }
  
  if (type === 'vimeo') {
    // Try OEmbed first for highest quality and private video support
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        return data.thumbnail_url || data.thumbnail_url_with_play_button || '';
      }
    } catch (e) {
      console.warn(`Vimeo OEmbed thumbnail failed for ${url}, falling back.`);
    }
    // Fallback to vumbnail
    return `https://vumbnail.com/${id}.jpg`;
  }
  
  return '';
};
