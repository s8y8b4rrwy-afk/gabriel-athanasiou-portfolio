/**
 * Generate placeholder thumbnails for projects without images
 * Provides 4 different design options
 */

export type PlaceholderStyle = 'text-minimal' | 'first-letter' | 'color-coded' | 'gradient';

interface PlaceholderOptions {
  title: string;
  year?: string;
  type?: string; // 'Narrative', 'Commercial', 'Music Video', etc.
  style: PlaceholderStyle;
}

/**
 * Generate an inline SVG data URL for placeholder thumbnails
 */
export const generatePlaceholder = ({ title, year, type, style }: PlaceholderOptions): string => {
  const width = 1920;
  const height = 1080;
  
  switch (style) {
    case 'text-minimal':
      return generateTextMinimal(title, year, width, height);
    
    case 'first-letter':
      return generateFirstLetter(title, width, height);
    
    case 'color-coded':
      return generateColorCoded(title, year, type, width, height);
    
    case 'gradient':
      return generateGradient(title, year, type, width, height);
    
    default:
      return generateTextMinimal(title, year, width, height);
  }
};

/**
 * Option 1: Text-based minimal design
 * Clean typography with project title, year, and initials
 */
const generateTextMinimal = (title: string, year: string | undefined, width: number, height: number): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#050505"/>
      
      <!-- Title -->
      <text 
        x="50%" 
        y="45%" 
        text-anchor="middle" 
        fill="#ffffff" 
        font-family="'Playfair Display', serif" 
        font-size="72" 
        font-weight="400"
        letter-spacing="2"
      >
        ${escapeXml(truncateTitle(title, 30))}
      </text>
      
      ${year ? `
      <!-- Year -->
      <text 
        x="50%" 
        y="52%" 
        text-anchor="middle" 
        fill="#999999" 
        font-family="'Inter', sans-serif" 
        font-size="32" 
        letter-spacing="4"
      >
        ${year}
      </text>
      ` : ''}
      
      <!-- Initials -->
      <text 
        x="50%" 
        y="62%" 
        text-anchor="middle" 
        fill="#333333" 
        font-family="'Playfair Display', serif" 
        font-size="48" 
        font-weight="600"
        letter-spacing="8"
      >
        GA
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Option 2: First letter typography
 * Large first letter of project title
 */
const generateFirstLetter = (title: string, width: number, height: number): string => {
  const firstLetter = title.charAt(0).toUpperCase();
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#050505"/>
      
      <!-- Large First Letter -->
      <text 
        x="50%" 
        y="55%" 
        text-anchor="middle" 
        dominant-baseline="middle"
        fill="#ffffff" 
        font-family="'Playfair Display', serif" 
        font-size="480" 
        font-weight="600"
        opacity="0.15"
      >
        ${escapeXml(firstLetter)}
      </text>
      
      <!-- Full Title -->
      <text 
        x="50%" 
        y="85%" 
        text-anchor="middle" 
        fill="#ffffff" 
        font-family="'Inter', sans-serif" 
        font-size="32" 
        font-weight="300"
        letter-spacing="6"
      >
        ${escapeXml(truncateTitle(title, 40))}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Option 3: Color-coded by project type
 * Different colors for Narrative, Commercial, Music Video
 */
const generateColorCoded = (title: string, year: string | undefined, type: string | undefined, width: number, height: number): string => {
  const typeColors: Record<string, string> = {
    'Narrative': '#1e3a8a', // Deep blue
    'Commercial': '#d97706', // Gold
    'Music Video': '#7c3aed', // Purple
    'Documentary': '#047857', // Green
    'Uncategorized': '#1f2937' // Dark gray
  };
  
  const color = typeColors[type || 'Uncategorized'] || typeColors['Uncategorized'];
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="typeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#050505;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <rect width="${width}" height="${height}" fill="url(#typeGradient)"/>
      
      <!-- Type Label -->
      <text 
        x="50%" 
        y="35%" 
        text-anchor="middle" 
        fill="#ffffff" 
        font-family="'Inter', sans-serif" 
        font-size="24" 
        font-weight="600"
        letter-spacing="8"
        opacity="0.6"
      >
        ${escapeXml((type || 'PROJECT').toUpperCase())}
      </text>
      
      <!-- Title -->
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        fill="#ffffff" 
        font-family="'Playfair Display', serif" 
        font-size="64" 
        font-weight="400"
        letter-spacing="2"
      >
        ${escapeXml(truncateTitle(title, 30))}
      </text>
      
      ${year ? `
      <!-- Year -->
      <text 
        x="50%" 
        y="58%" 
        text-anchor="middle" 
        fill="#cccccc" 
        font-family="'Inter', sans-serif" 
        font-size="28" 
        letter-spacing="4"
      >
        ${year}
      </text>
      ` : ''}
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Option 4: Gradient with project info - ENHANCED
 * Blend of color-coded gradient + interesting SVG patterns
 * Sophisticated muted colors matching site aesthetic
 */
const generateGradient = (title: string, year: string | undefined, type: string | undefined, width: number, height: number): string => {
  // Muted, sophisticated colors by project type
  const typeColors: Record<string, { start: string; mid: string }> = {
    'Narrative': { start: '#1e293b', mid: '#0f172a' }, // Muted slate blue
    'Commercial': { start: '#374151', mid: '#1f2937' }, // Sophisticated charcoal
    'Music Video': { start: '#312e81', mid: '#1e1b4b' }, // Deep muted indigo
    'Documentary': { start: '#1f2937', mid: '#111827' }, // Dark gray
    'Uncategorized': { start: '#1f2937', mid: '#0a0a0a' } // Near black
  };
  
  const colors = typeColors[type || 'Uncategorized'] || typeColors['Uncategorized'];
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <!-- Dramatic gradient -->
        <linearGradient id="dramaticGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors.start};stop-opacity:1" />
          <stop offset="70%" style="stop-color:${colors.mid};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
        </linearGradient>
        
        <!-- Radial glow effect -->
        <radialGradient id="glowEffect" cx="50%" cy="40%">
          <stop offset="0%" style="stop-color:${colors.start};stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#000000;stop-opacity:0" />
        </radialGradient>
        
        <!-- Film grain texture -->
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feBlend mode="multiply" in2="SourceGraphic"/>
        </filter>
      </defs>
      
      <!-- Base gradient -->
      <rect width="${width}" height="${height}" fill="url(#dramaticGradient)"/>
      
      <!-- Glow overlay -->
      <rect width="${width}" height="${height}" fill="url(#glowEffect)"/>
      
      <!-- Geometric patterns -->
      <circle cx="${width * 0.15}" cy="${height * 0.2}" r="${height * 0.4}" fill="${colors.start}" opacity="0.04"/>
      <circle cx="${width * 0.85}" cy="${height * 0.8}" r="${height * 0.3}" fill="${colors.start}" opacity="0.06"/>
      
      <!-- Diagonal lines for depth -->
      <line x1="0" y1="0" x2="${width}" y2="${height}" stroke="#ffffff" stroke-width="1" opacity="0.02"/>
      <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="#ffffff" stroke-width="1" opacity="0.02"/>
      
      <!-- Grid pattern -->
      ${Array.from({ length: 8 }, (_, i) => `
        <line x1="${(i + 1) * (width / 9)}" y1="0" x2="${(i + 1) * (width / 9)}" y2="${height}" stroke="#ffffff" stroke-width="0.5" opacity="0.015"/>
        <line x1="0" y1="${(i + 1) * (height / 9)}" x2="${width}" y2="${(i + 1) * (height / 9)}" stroke="#ffffff" stroke-width="0.5" opacity="0.015"/>
      `).join('')}
      
      <!-- Top corner accent -->
      <path d="M 0,0 L ${width * 0.3},0 L 0,${height * 0.2} Z" fill="#ffffff" opacity="0.02"/>
      
      <!-- Bottom corner accent -->
      <path d="M ${width},${height} L ${width * 0.7},${height} L ${width},${height * 0.8} Z" fill="#ffffff" opacity="0.02"/>
      
      <!-- Main Title - LARGER -->
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        fill="#ffffff" 
        font-family="'Playfair Display', serif" 
        font-size="110" 
        font-weight="500"
        letter-spacing="2"
      >
        ${escapeXml(truncateTitle(title, 20))}
      </text>
      
      <!-- Year with decorative elements -->
      ${year ? `
      <line x1="${width * 0.35}" y1="${height * 0.60}" x2="${width * 0.42}" y2="${height * 0.60}" stroke="#ffffff" stroke-width="1.5" opacity="0.3"/>
      <text 
        x="50%" 
        y="${height * 0.605}" 
        text-anchor="middle" 
        fill="#999999" 
        font-family="'Inter', sans-serif" 
        font-size="32" 
        letter-spacing="6"
        font-weight="300"
      >
        ${year}
      </text>
      <line x1="${width * 0.58}" y1="${height * 0.60}" x2="${width * 0.65}" y2="${height * 0.60}" stroke="#ffffff" stroke-width="1.5" opacity="0.3"/>
      ` : ''}
      
      <!-- Film grain overlay -->
      <rect width="${width}" height="${height}" filter="url(#noise)" opacity="0.012"/>
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Helper functions
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const truncateTitle = (title: string, maxLength: number): string => {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
};
