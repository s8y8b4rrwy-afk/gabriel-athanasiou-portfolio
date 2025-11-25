

// Enum for filtering
export enum ProjectType {
  ALL = 'All',
  NARRATIVE = 'Narrative',
  COMMERCIAL = 'Commercial',
  MUSIC_VIDEO = 'Music Video',
  DOCUMENTARY = 'Documentary'
}

export interface Credit {
  role: string;
  name: string;
}

export interface ExternalLink {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  title: string;
  slug?: string;
  type: ProjectType | string;
  genre?: string[]; // e.g. ["Sci-Fi", "Drama"]
  client: string; // This maps to Production Company usually
  brand?: string; // Optional Brand field
  year: string;
  description: string;
  isFeatured: boolean;
  
  // Media
  heroImage: string; // URL
  videoUrl?: string; // Main Hero Video (YouTube/Vimeo)
  additionalVideos?: string[]; // Videos found in external links
  gallery: string[]; // Array of image URLs
  
  // Metadata
  awards?: string[];
  externalLinks?: ExternalLink[];
  relatedArticleId?: string; // Link to a blog post

  // Credits
  credits: Credit[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug?: string;
  date: string;
  readingTime?: string; // e.g. "4 min read"
  content: string; // HTML or Markdown string
  imageUrl?: string;
  tags: string[];
  relatedProjectId?: string; // If this post is about a specific film
  
  // New fields for Instagram integration
  source?: 'local' | 'instagram';
  externalUrl?: string; // The main source link (e.g. Instagram permalink)
  
  // New field for Airtable Links column
  relatedLinks?: string[]; 
}

export interface HomeConfig {
  showreel?: {
    enabled: boolean;
    videoUrl: string;
    placeholderImage?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    repUK?: string;
    repUSA?: string;
    instagram?: string;
    vimeo?: string;
    linkedin?: string;
  };
  about?: {
    bio?: string;
    profileImage?: string;
  };
  allowedRoles?: string[];
  defaultOgImage?: string;
}

export enum ViewState {
  HOME = 'home',
  INDEX = 'index',
  PROJECT = 'project',
  ABOUT = 'about',
  BLOG = 'blog',
  BLOG_POST = 'blog_post'
}