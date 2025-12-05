import type { Credit } from '../types';

// Emoji mapping for credit roles
const creditEmojis: Record<string, string> = {
  Colourist: '🎨',
  Colorist: '🎨',
  Editor: '✂️',
  Director: '🎬',
  DOP: '📷',
  Cinematographer: '📷',
  'Director of Photography': '📷',
  Sound: '🎵',
  Audio: '🎵',
  'Sound Designer': '🎵',
  VFX: '✨',
  'Visual Effects': '✨',
  Producer: '🎞️',
  'Executive Producer': '🎞️',
  Writer: '✍️',
  Screenwriter: '✍️',
  Composer: '🎼',
  'Music Composer': '🎼',
  Animator: '🖌️',
  'Motion Designer': '🖌️',
};

// Display format for credit roles (short version for combining)
const creditRoleNames: Record<string, string> = {
  Colourist: 'Colour Grading',
  Colorist: 'Color Grading',
  Editor: 'Edit',
  Director: 'Directed',
  DOP: 'Cinematography',
  Cinematographer: 'Cinematography',
  'Director of Photography': 'Cinematography',
  Sound: 'Sound',
  Audio: 'Audio',
  'Sound Designer': 'Sound Design',
  VFX: 'VFX',
  'Visual Effects': 'Visual Effects',
  Producer: 'Produced',
  'Executive Producer': 'Executive Producer',
  Writer: 'Written',
  Screenwriter: 'Screenplay',
  Composer: 'Music',
  'Music Composer': 'Music',
  Animator: 'Animation',
  'Motion Designer': 'Motion Design',
};

// Display format for credit roles
const creditLabels: Record<string, string> = {
  Colourist: 'Colour Grading by',
  Colorist: 'Color Grading by',
  Editor: 'Edit by',
  Director: 'Directed by',
  DOP: 'Cinematography by',
  Cinematographer: 'Cinematography by',
  'Director of Photography': 'Cinematography by',
  Sound: 'Sound by',
  Audio: 'Audio by',
  'Sound Designer': 'Sound Design by',
  VFX: 'VFX by',
  'Visual Effects': 'Visual Effects by',
  Producer: 'Produced by',
  'Executive Producer': 'Executive Producer',
  Writer: 'Written by',
  Screenwriter: 'Screenplay by',
  Composer: 'Music by',
  'Music Composer': 'Music by',
  Animator: 'Animation by',
  'Motion Designer': 'Motion Design by',
};

// Instagram handle replacements
const instagramHandles: Record<string, string> = {
  'lemon post': '@lemonpoststudio',
  'gabriel athanasiou': '@gab.ath',
};

function getInstagramHandle(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [key, handle] of Object.entries(instagramHandles)) {
    if (lowerName.includes(key)) {
      return handle;
    }
  }
  return name;
}

function isLemonPost(name: string): boolean {
  return name.toLowerCase().includes('lemon post');
}

function isGabrielAthanasiou(name: string): boolean {
  return name.toLowerCase().includes('gabriel athanasiou');
}

export function getEmojiForRole(role: string): string {
  return creditEmojis[role] || '👤';
}

export function getLabelForRole(role: string): string {
  return creditLabels[role] || `${role} by`;
}

export function getRoleNameForRole(role: string): string {
  return creditRoleNames[role] || role;
}

export function formatCredit(credit: Credit): string {
  const emoji = getEmojiForRole(credit.role);
  const label = getLabelForRole(credit.role);
  const displayName = getInstagramHandle(credit.name);
  return `${emoji} ${label} ${displayName}`;
}

export function formatCredits(credits: Credit[]): string {
  if (credits.length === 0) return '';
  
  // Group Lemon Post credits together
  const lemonPostCredits = credits.filter(c => isLemonPost(c.name));
  const gabrielCredits = credits.filter(c => isGabrielAthanasiou(c.name) && !isLemonPost(c.name));
  const otherCredits = credits.filter(c => !isLemonPost(c.name) && !isGabrielAthanasiou(c.name));
  
  const formattedLines: string[] = [];
  
  // Format Lemon Post credits as combined line: "🎨 Colour Grading, Edit by @lemonpoststudio"
  if (lemonPostCredits.length > 0) {
    const roles = lemonPostCredits.map(c => getRoleNameForRole(c.role));
    // Use the emoji of the first role
    const emoji = getEmojiForRole(lemonPostCredits[0].role);
    const combinedRoles = roles.join(', ');
    formattedLines.push(`${emoji} ${combinedRoles} by @lemonpoststudio`);
  }
  
  // Format Gabriel Athanasiou credits with @gab.ath
  for (const credit of gabrielCredits) {
    const emoji = getEmojiForRole(credit.role);
    const label = getLabelForRole(credit.role);
    formattedLines.push(`${emoji} ${label} @gab.ath`);
  }
  
  // Format other credits normally
  for (const credit of otherCredits) {
    formattedLines.push(formatCredit(credit));
  }
  
  return formattedLines.join('\n');
}

// Get unique roles from credits where Lemon Post did the work
export function getLemonPostRoles(credits: Credit[]): string[] {
  return credits
    .filter(credit => credit.name.toLowerCase().includes('lemon post'))
    .map(credit => credit.role);
}
