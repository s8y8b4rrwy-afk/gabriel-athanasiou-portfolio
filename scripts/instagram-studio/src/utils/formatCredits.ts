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

export function getEmojiForRole(role: string): string {
  return creditEmojis[role] || '👤';
}

export function getLabelForRole(role: string): string {
  return creditLabels[role] || `${role} by`;
}

export function formatCredit(credit: Credit): string {
  const emoji = getEmojiForRole(credit.role);
  const label = getLabelForRole(credit.role);
  return `${emoji} ${label} ${credit.name}`;
}

export function formatCredits(credits: Credit[]): string {
  if (credits.length === 0) return '';
  return credits.map(formatCredit).join('\n');
}

// Get unique roles from credits where Lemon Post did the work
export function getLemonPostRoles(credits: Credit[]): string[] {
  return credits
    .filter(credit => credit.name.toLowerCase().includes('lemon post'))
    .map(credit => credit.role);
}
