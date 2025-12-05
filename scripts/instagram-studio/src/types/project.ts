// Project types matching portfolio-data-postproduction.json structure

export interface Credit {
  role: string;
  name: string;
  isCrossSite?: boolean;
  externalUrl?: string;
}

export interface ExternalLink {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  type: string; // 'Narrative' | 'Commercial' | 'Music Video' | 'Documentary'
  kinds: string[];
  genre: string[];
  productionCompany: string;
  client: string;
  year: string;
  releaseDate: string;
  workDate: string;
  description: string;
  isFeatured: boolean;
  isHero: boolean;
  heroImage: string;
  gallery: string[];
  videoUrl: string;
  additionalVideos: string[];
  awards: string[];
  credits: Credit[];
  externalLinks: ExternalLink[];
  relatedArticleId: string | null;
}

export interface PortfolioData {
  projects: Project[];
}
