/**
 * Shared Video Utilities (Node.js/ESM Compatible)
 * Used in Netlify functions and build scripts
 */

/**
 * Extract video ID and type from various URL formats
 */
export function getVideoId(url) {
  if (!url) return { type: null, id: null };
  const cleanUrl = url.trim();

  // YouTube Regex
  const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (ytMatch && ytMatch[1]) {
    return { type: 'youtube', id: ytMatch[1] };
  }

  // Vimeo Regex
  const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(?:(?:channels\/[a-zA-Z0-9]+\/)|(?:groups\/[a-zA-Z0-9]+\/videos\/)|(?:manage\/videos\/))?([0-9]+)(?:\/([a-zA-Z0-9]+))?/);
  
  if (vimeoMatch && vimeoMatch[1]) {
    let id = vimeoMatch[1];
    let hash = vimeoMatch[2] || null;

    if (!hash && cleanUrl.includes('?')) {
      const queryHash = cleanUrl.match(/[?&]h=([a-zA-Z0-9]+)/);
      if (queryHash) hash = queryHash[1];
    }

    return { type: 'vimeo', id, hash };
  }

  return { type: null, id: null };
}

/**
 * Resolve vanity URLs (Node.js version using https module)
 */
export async function resolveVideoUrl(url) {
  if (!url) return '';
  const { type, id, hash } = getVideoId(url);
  
  if (id) {
    if (type === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
    if (type === 'vimeo') {
      return hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
    }
  }

  if (url.includes('vimeo.com')) {
    try {
      const https = await import('node:https');
      return new Promise((resolve) => {
        https.default.get(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.video_id) resolve(`https://vimeo.com/${json.video_id}`);
              else resolve(url);
            } catch (e) {
              resolve(url);
            }
          });
        }).on('error', () => resolve(url));
      });
    } catch (e) {
      console.warn(`Failed to resolve Vimeo OEmbed for: ${url}`);
    }
  }

  return url;
}

/**
 * Generate embed URL for iframe players
 */
export function getEmbedUrl(url, autoplay = false, muted = false) {
  const { type, id, hash } = getVideoId(url);
  if (!type || !id) return null;

  const params = new URLSearchParams();
  if (autoplay) {
    params.set('autoplay', '1');
    if (muted) params.set('muted', '1');
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
}

/**
 * Fetch video thumbnail URL (async for Node.js)
 */
export async function getVideoThumbnail(url) {
  const { type, id } = getVideoId(url);
  if (!id) return '';

  if (type === 'youtube') {
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  }
  
  if (type === 'vimeo') {
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        return data.thumbnail_url || data.thumbnail_url_with_play_button || `https://vumbnail.com/${id}.jpg`;
      }
    } catch (e) {
      console.warn(`Vimeo OEmbed thumbnail failed, using fallback`);
    }
    return `https://vumbnail.com/${id}.jpg`;
  }
  
  return '';
}
