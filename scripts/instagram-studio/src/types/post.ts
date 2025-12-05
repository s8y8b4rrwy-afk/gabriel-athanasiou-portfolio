import type { Project } from './project';

export interface PostDraft {
  id: string;
  projectId: string;
  project: Project;
  caption: string;
  hashtags: string[];
  selectedImages: string[];
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
