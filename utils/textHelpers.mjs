/**
 * Shared Text Utilities (Node.js/ESM Compatible)
 * Used in Netlify functions and build scripts
 */

/**
 * Normalize title text
 */
export function normalizeTitle(title) {
  if (!title) return 'Untitled';
  let clean = title.replace(/[_-]/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Parse credits text
 */
export function parseCreditsText(text) {
  if (!text) return [];
  
  const items = text.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  return items.map(item => {
    const parts = item.split(':');
    if (parts.length >= 2) {
      return {
        role: parts[0].trim(),
        name: parts.slice(1).join(':').trim()
      };
    }
    return { role: 'Credit', name: item };
  });
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, " ");
}

/**
 * Calculate reading time
 */
export function calculateReadingTime(content) {
  if (!content) return "1 min read";
  const text = content.replace(/<[^>]*>/g, '');
  const wordCount = text.split(/\s+/).length;
  const readingSpeed = 225;
  const minutes = Math.ceil(wordCount / readingSpeed);
  return `${minutes} min read`;
}
