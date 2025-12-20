import type { PostDraft } from './post';
import type { Project } from './project';

export interface ScheduleSlot {
  id: string;
  postDraftId: string;
  scheduledDate: string; // ISO date string (YYYY-MM-DD)
  scheduledTime: string; // HH:mm format
  scheduledTimezone?: string; // Timezone when scheduled (e.g., 'Europe/London')
  status: 'pending' | 'published' | 'failed';
  instagramPostId?: string; // Instagram media ID when published
  instagramPermalink?: string; // Direct link to Instagram post
  publishedAt?: string; // ISO date string when published
  updatedAt?: string; // ISO date string - used for smart merge
  createdAt?: string; // ISO date string - used for smart merge
  error?: string; // Error message if failed
}

/**
 * A scheduled post with guaranteed project data.
 * Used after App.tsx enhances rawScheduledPosts with project lookup.
 * This type guarantees `project` is always present (either from lookup or stub).
 */
export interface ScheduledPost extends Omit<PostDraft, 'project'> {
  scheduleSlot: ScheduleSlot;
  project: Project; // Guaranteed to exist after enhancement in App.tsx
}

export interface ScheduleSettings {
  defaultTimes: string[]; // Default posting times ['11:00', '19:00']
  timezone: string; // Display timezone for viewing schedules
  maxPostsPerDay: number;
}
