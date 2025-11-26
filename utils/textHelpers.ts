/**
 * Shared Text Utilities
 * Used across frontend and backend for consistent text processing
 */

/**
 * Normalize title text: Replace underscores/dashes with spaces, title case
 */
export const normalizeTitle = (title: string): string => {
  if (!title) return 'Untitled';
  let clean = title.replace(/[_-]/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

/**
 * Parse credits text from various formats (comma, pipe, newline separated)
 * Format: "Role: Name" or just "Name"
 */
export const parseCreditsText = (text: string): Array<{ role: string; name: string }> => {
  if (!text) return [];
  
  // Split by comma, pipe, or newline
  const items = text.split(/[,|\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  return items.map(item => {
    // Split "Role: Name"
    const parts = item.split(':');
    if (parts.length >= 2) {
      return {
        role: parts[0].trim(),
        name: parts.slice(1).join(':').trim() // Join back in case name has colons
      };
    }
    return { role: 'Credit', name: item };
  });
};

/**
 * Escape HTML special characters for safe injection into HTML
 */
export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, " "); // Remove newlines
};

/**
 * Calculate reading time based on content length
 */
export const calculateReadingTime = (content: string): string => {
  if (!content) return "1 min read";
  const text = content.replace(/<[^>]*>/g, '');
  const wordCount = text.split(/\s+/).length;
  const readingSpeed = 225; 
  const minutes = Math.ceil(wordCount / readingSpeed);
  return `${minutes} min read`;
};
