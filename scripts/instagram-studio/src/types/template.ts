import type { Project } from './project';

/**
 * Caption template - reusable caption format with placeholders
 */
export interface CaptionTemplate {
  id: string;
  name: string;
  description: string;
  
  // Caption template with placeholders like {title}, {year}, {description}, etc.
  captionTemplate: string;
  
  // Which hashtag groups to include
  hashtagGroups: HashtagGroupKey[];
  
  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Keep RecurringTemplate as alias for backwards compatibility
export type RecurringTemplate = CaptionTemplate;

/**
 * Predefined caption templates
 */
export const CAPTION_TEMPLATES = {
  standard: `🎬 {title} ({year})

{description}

{awards}

—
{credits}

{client}
Production: {productionCompany}

—
Lemon Post is a post-production studio specialising in 
colour grading and editing for film, commercials, and 
branded content.

🔗 lemonpost.studio | Link in bio

{hashtags}`,

  minimal: `🎬 {title}

{description}

{credits}

🔗 lemonpost.studio`,

  showcase: `✨ Project Spotlight ✨

{title} ({year})

{description}

{awards}

—
{credits}

🔗 Full project at lemonpost.studio

{hashtags}`,

  throwback: `#ThrowbackThursday 🎬

{title} ({year})

{description}

Still proud of this one!

{credits}

{hashtags}`,

  behindTheScenes: `🎬 Behind the Scenes

{title}

Here's a look at our colour grading process for this project.

{credits}

{hashtags}`,
} as const;

export type CaptionTemplateKey = keyof typeof CAPTION_TEMPLATES;

/**
 * Hashtag groups for easy selection
 */
export const HASHTAG_GROUPS = {
  base: ['#postproduction', '#colorgrading', '#colourgrading', '#filmmaker', '#cinematography', '#davinciresolve'],
  narrative: ['#shortfilm', '#indiefilm', '#filmmaking', '#director', '#cinema'],
  commercial: ['#commercial', '#brandfilm', '#advertising', '#corporatevideo', '#branded'],
  musicVideo: ['#musicvideo', '#musicvideomaker', '#musicvisuals', '#mvp'],
  documentary: ['#documentary', '#documentaryfilm', '#docfilm', '#storytelling'],
  london: ['#ukfilm', '#londonfilm', '#britishfilm', '#londoncreatives', '#ukproduction'],
  engagement: ['#linkinbio', '#newwork', '#projectspotlight', '#creativeprocess'],
} as const;

export type HashtagGroupKey = keyof typeof HASHTAG_GROUPS;

/**
 * Apply a caption template to a project
 */
export function applyTemplateToProject(template: string, project: Project): string {
  const awardsText = project.awards?.length 
    ? `🏆 ${project.awards.join(' | ')}` 
    : '';
  
  const creditsText = project.credits
    ?.filter(c => c.name && c.role)
    .map(c => `${c.role}: ${c.name}`)
    .join('\n') || '';

  return template
    .replace(/{title}/g, project.title || '')
    .replace(/{year}/g, project.year || '')
    .replace(/{description}/g, project.description || '')
    .replace(/{client}/g, project.client ? `Client: ${project.client}` : '')
    .replace(/{productionCompany}/g, project.productionCompany || 'Lemon Post')
    .replace(/{awards}/g, awardsText)
    .replace(/{credits}/g, creditsText)
    .replace(/{type}/g, project.type || '')
    .replace(/{genre}/g, project.genre?.join(', ') || '')
    .replace(/{hashtags}/g, '') // Hashtags added separately
    .replace(/\n{3,}/g, '\n\n') // Clean up extra newlines
    .trim();
}

/**
 * Get hashtags from selected groups
 */
export function getHashtagsFromGroups(groups: HashtagGroupKey[]): string[] {
  const hashtags = new Set<string>();
  groups.forEach(group => {
    if (HASHTAG_GROUPS[group]) {
      HASHTAG_GROUPS[group].forEach(tag => hashtags.add(tag));
    }
  });
  return Array.from(hashtags);
}

/**
 * Default template for new templates
 */
export const DEFAULT_TEMPLATE: Omit<CaptionTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'New Template',
  description: '',
  captionTemplate: CAPTION_TEMPLATES.standard,
  hashtagGroups: ['base'],
  isActive: true,
};

// Keep for backwards compatibility
export const DEFAULT_RECURRING_TEMPLATE = DEFAULT_TEMPLATE;
