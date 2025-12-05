import type { Project } from '../types';
import { getHashtagsForProject } from '../data/hashtagLibrary';
import { getLemonPostRoles } from './formatCredits';

const MAX_HASHTAGS = 25; // Leave some room under Instagram's 30 limit

export function generateHashtags(project: Project): string[] {
  // Get credit roles where Lemon Post did the work
  const lemonPostRoles = getLemonPostRoles(project.credits);

  // Get all relevant hashtags
  const allHashtags = getHashtagsForProject(
    project.type,
    project.kinds,
    project.genre,
    lemonPostRoles
  );

  // Limit to max hashtags
  return allHashtags.slice(0, MAX_HASHTAGS);
}

export function formatHashtagsForCaption(hashtags: string[]): string {
  return hashtags.join(' ');
}

// Validate hashtags (no banned or spammy ones)
export function validateHashtags(hashtags: string[]): {
  valid: string[];
  invalid: string[];
} {
  // Common banned or problematic hashtags (simplified list)
  const problematicHashtags = [
    '#like4like',
    '#follow4follow',
    '#likeforlike',
    '#followforfollow',
    '#f4f',
    '#l4l',
    '#instagood', // Often shadowbanned
    '#instagram',
  ];

  const valid: string[] = [];
  const invalid: string[] = [];

  hashtags.forEach(tag => {
    if (problematicHashtags.includes(tag.toLowerCase())) {
      invalid.push(tag);
    } else {
      valid.push(tag);
    }
  });

  return { valid, invalid };
}
