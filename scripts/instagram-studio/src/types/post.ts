import type { Project } from './project';

// Image display mode for Instagram posts
// - 'fill': Crop/punch in to fill the container (no letterbox bars)
// - 'fit': Keep original aspect ratio with letterbox bars (top/bottom for landscape)
export type ImageDisplayMode = 'fill' | 'fit';

export interface PostDraft {
  id: string;
  projectId: string;
  project: Project;
  caption: string;
  hashtags: string[];
  selectedImages: string[];
  imageMode?: ImageDisplayMode; // Default: 'fit' (preserve original with letterbox)
  createdAt: string;
  updatedAt: string;
}

export interface PostTemplate {
  id: string;
  name: string;
  template: string;
  isDefault?: boolean;
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface PublishedPost {
  id: string;
  projectId: string;
  instagramPostId?: string;
  caption: string;
  hashtags: string[];
  images: string[];
  status: PostStatus;
  publishedAt?: string;
  scheduledFor?: string;
  error?: string;
}
