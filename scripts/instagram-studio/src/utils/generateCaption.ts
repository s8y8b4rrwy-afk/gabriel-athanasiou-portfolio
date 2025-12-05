import type { Project } from '../types';
import { formatCredits } from './formatCredits';
import { generateHashtags, formatHashtagsForCaption } from './generateHashtags';

const MAX_DESCRIPTION_LENGTH = 150;

// Main caption template
const CAPTION_TEMPLATE = `🎬 {title} ({year})

{description}

{awards}
—
{credits}

{clientLine}
Production: {productionCompany}

—
Lemon Post is a post-production studio specialising in colour grading and editing for film, commercials, and branded content.

🔗 lemonpost.studio | Link in bio

{hashtags}`;

function truncateDescription(description: string, maxLength: number = MAX_DESCRIPTION_LENGTH): string {
  if (!description) return '';
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength - 3).trim() + '...';
}

function formatAwards(awards: string[]): string {
  if (awards.length === 0) return '';
  return '🏆 ' + awards.join(' | ') + '\n';
}

function formatClientLine(client: string): string {
  if (!client) return '';
  return `Client: ${client}`;
}

export interface CaptionOptions {
  includeHashtags?: boolean;
  maxDescriptionLength?: number;
  customDescription?: string;
  customHashtags?: string[];
}

export function generateCaption(
  project: Project,
  options: CaptionOptions = {}
): string {
  const {
    includeHashtags = true,
    maxDescriptionLength = MAX_DESCRIPTION_LENGTH,
    customDescription,
    customHashtags,
  } = options;

  const description = truncateDescription(
    customDescription || project.description,
    maxDescriptionLength
  );

  const awards = formatAwards(project.awards);
  const credits = formatCredits(project.credits);
  const clientLine = formatClientLine(project.client);
  const hashtags = includeHashtags
    ? formatHashtagsForCaption(customHashtags || generateHashtags(project))
    : '';

  let caption = CAPTION_TEMPLATE
    .replace('{title}', project.title)
    .replace('{year}', project.year)
    .replace('{description}', description)
    .replace('{awards}', awards)
    .replace('{credits}', credits)
    .replace('{clientLine}', clientLine)
    .replace('{productionCompany}', project.productionCompany || 'Lemon Post')
    .replace('{hashtags}', hashtags);

  // Clean up empty lines
  caption = caption
    .split('\n')
    .filter((line, index, array) => {
      // Remove empty lines that are not intentional separators
      if (line.trim() === '' && index > 0 && array[index - 1].trim() === '') {
        return false;
      }
      return true;
    })
    .join('\n');

  // Clean up the caption
  caption = caption.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  
  // Remove empty client line if no client
  if (!project.client) {
    caption = caption.replace(/^Client: \n?/gm, '');
  }

  return caption.trim();
}

// Get caption character count (Instagram limit is 2,200)
export function getCaptionLength(caption: string): {
  length: number;
  isValid: boolean;
  remaining: number;
} {
  const INSTAGRAM_CAPTION_LIMIT = 2200;
  const length = caption.length;
  return {
    length,
    isValid: length <= INSTAGRAM_CAPTION_LIMIT,
    remaining: INSTAGRAM_CAPTION_LIMIT - length,
  };
}
