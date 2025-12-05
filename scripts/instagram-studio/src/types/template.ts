import type { Project } from './project';

/**
 * Recurring post template configuration
 */
export interface RecurringTemplate {
  id: string;
  name: string;
  description: string;
  
  // Caption template with placeholders
  captionTemplate: string;
  
  // Default hashtag groups to include
  hashtagGroups: string[];
  
  // Schedule pattern
  schedule: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    daysOfWeek?: number[]; // 0 = Sunday, 6 = Saturday
    timeSlots: string[]; // ['11:00', '19:00']
    startDate?: string;
    endDate?: string;
  };
  
  // Filters to auto-select projects
  projectFilters?: {
    types?: string[];
    kinds?: string[];
    years?: string[];
    excludePosted?: boolean; // Exclude already posted projects
  };
  
  // Image selection
  imageSelection: 'hero' | 'first' | 'all' | 'random';
  maxImages: number;
  
  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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
 * Default template for new recurring templates
 */
export const DEFAULT_RECURRING_TEMPLATE: Omit<RecurringTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'New Template',
  description: '',
  captionTemplate: CAPTION_TEMPLATES.standard,
  hashtagGroups: ['base'],
  schedule: {
    frequency: 'weekly',
    daysOfWeek: [2, 4], // Tuesday, Thursday
    timeSlots: ['11:00'],
  },
  projectFilters: {
    excludePosted: true,
  },
  imageSelection: 'hero',
  maxImages: 1,
  isActive: false,
};
