

// Window type extensions for feature flags and environment variables
declare global {
  interface Window {
    USE_CLOUDINARY?: string | boolean;
    CLOUDINARY_CLOUD_NAME?: string;
  }
}

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
  kinds?: string[]; // Raw project kinds from Airtable (e.g. ["Commercial", "TVC"])
  genre?: string[]; // e.g. ["Sci-Fi", "Drama"]
  productionCompany: string; // Production company that produced the work
  client?: string; // Optional client/brand field
  year: string;
  releaseDate?: string; // Full release date from Airtable (YYYY-MM-DD)
  workDate?: string; // Full work/production date from Airtable (YYYY-MM-DD)
  description: string;
  isFeatured: boolean; // Appears on front page (Display Status = "Featured" or "Hero")
  isHero?: boolean; // Eligible to be hero on front page (Display Status = "Hero")
  
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
  status?: 'Public' | 'Scheduled' | 'Draft'; // Publication status from Airtable
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
  // Portfolio identification
  portfolioId?: string; // 'directing' or 'postproduction'
  
  // Branding
  siteTitle?: string; // Browser tab title, footer text
  navTitle?: string; // Text shown in navigation bar
  logo?: string; // Portfolio logo image URL
  favicon?: string; // Browser favicon URL
  fontFamily?: string; // Google Font name (e.g., 'Space Grotesk')
  
  // SEO
  seoTitle?: string; // Meta title for search engines
  seoDescription?: string; // Meta description for search engines
  domain?: string; // For canonical URLs
  
  // Feature flags
  workSectionLabel?: string; // 'Filmography' or 'All Work'
  hasJournal?: boolean; // Whether to show journal section
  showRoleFilter?: boolean; // Whether to show role-based filter on work page
  
  // Cross-portfolio linking
  showOtherPortfolioLink?: boolean;
  otherPortfolioUrl?: string;
  otherPortfolioLabel?: string;
  
  // Layout options
  aboutLayout?: string; // 'standard' for now
  
  // Existing fields
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
    imdb?: string;
  };
  about?: {
    bio?: string;
    profileImage?: string;
  };
  allowedRoles?: string[];
  defaultOgImage?: string;
  portfolioOwnerName?: string;
  lastModified?: string;
  themeMode?: 'dark' | 'light';
}

export enum ViewState {
  HOME = 'home',
  INDEX = 'index',
  PROJECT = 'project',
  ABOUT = 'about',
  BLOG = 'blog',
  BLOG_POST = 'blog_post'
}