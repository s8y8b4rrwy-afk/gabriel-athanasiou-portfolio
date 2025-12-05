export interface ScheduleSlot {
  id: string;
  postDraftId: string;
  scheduledDate: string; // ISO date string
  scheduledTime: string; // HH:mm format
  status: 'pending' | 'published' | 'failed';
  instagramPostId?: string; // Instagram media ID when published
  instagramPermalink?: string; // Direct link to Instagram post
  publishedAt?: string; // ISO date string when published
}

export interface ScheduleSettings {
  defaultTimes: string[]; // Default posting times ['11:00', '19:00']
  timezone: string;
  maxPostsPerDay: number;
}
