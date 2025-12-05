// Hashtag library organized by category

export const hashtagLibrary = {
  // Base hashtags - always included
  base: [
    '#postproduction',
    '#colorgrading',
    '#colourgrading',
    '#filmmaker',
    '#cinematography',
    '#davinciresolve',
  ],

  // By project type
  byType: {
    Narrative: ['#shortfilm', '#indiefilm', '#filmmaking', '#director', '#cinema'],
    Commercial: ['#commercial', '#brandfilm', '#advertising', '#corporatevideo', '#branded'],
    'Music Video': ['#musicvideo', '#musicvideomaker', '#musicvisuals', '#mvp'],
    Documentary: ['#documentary', '#documentaryfilm', '#docfilm', '#storytelling'],
  },

  // By project kind
  byKind: {
    'Short Film': ['#shortfilm', '#shortfilmmaker', '#filmfestival'],
    'Feature Film': ['#featurefilm', '#movie', '#cinema'],
    'Fashion Film': ['#fashionfilm', '#fashionvideo', '#editorial', '#fashion'],
    Corporate: ['#corporatevideo', '#brandvideo', '#businessvideo'],
    Campaign: ['#campaign', '#digitalcampaign', '#marketing'],
    'Music Video': ['#musicvideo', '#musicvisuals', '#musicproduction'],
    Documentary: ['#documentary', '#documentaryfilm', '#realstories'],
    'Branded Content': ['#brandedcontent', '#contentmarketing', '#sponsored'],
  },

  // By genre
  byGenre: {
    Drama: ['#drama', '#dramafilm', '#dramatic'],
    Comedy: ['#comedy', '#comedyfilm', '#funny'],
    Horror: ['#horror', '#horrorfilm', '#scary'],
    Thriller: ['#thriller', '#suspense', '#intense'],
    Period: ['#periodfilm', '#periodpiece', '#costume'],
    'Sci-Fi': ['#scifi', '#sciencefiction', '#futuristic'],
    Romance: ['#romance', '#romancefilm', '#love'],
    Action: ['#action', '#actionfilm', '#stunts'],
    Mystery: ['#mystery', '#mysteryfilm', '#whodunit'],
    Fantasy: ['#fantasy', '#fantasyfilm', '#magical'],
    Animation: ['#animation', '#animated', '#motiongraphics'],
  },

  // By credit role (when Lemon Post did the work)
  byCredit: {
    Colourist: ['#colorist', '#colourist', '#colorgrading', '#colourgrade', '#colorgrade'],
    Editor: ['#editor', '#filmeditor', '#videoediting', '#editing', '#postproduction'],
    VFX: ['#vfx', '#visualeffects', '#cgi', '#compositing'],
    Sound: ['#sounddesign', '#audiopost', '#soundmixing'],
    Animator: ['#animator', '#animation', '#motiongraphics', '#motiondesign'],
  },

  // Location/Industry hashtags
  location: [
    '#ukfilm',
    '#londonfilm',
    '#britishfilm',
    '#londoncreatives',
    '#ukproduction',
  ],

  // Engagement hashtags
  engagement: [
    '#videooftheday',
    '#filmcommunity',
    '#supportindiefilm',
    '#behindthescenes',
  ],
} as const;

// Helper to get all hashtags for a project
export function getHashtagsForProject(
  type: string,
  kinds: string[],
  genres: string[],
  creditRoles: string[]
): string[] {
  const hashtags = new Set<string>();

  // Add base hashtags
  hashtagLibrary.base.forEach(tag => hashtags.add(tag));

  // Add type-based hashtags
  const typeHashtags = hashtagLibrary.byType[type as keyof typeof hashtagLibrary.byType];
  if (typeHashtags) {
    typeHashtags.forEach(tag => hashtags.add(tag));
  }

  // Add kind-based hashtags
  kinds.forEach(kind => {
    const kindHashtags = hashtagLibrary.byKind[kind as keyof typeof hashtagLibrary.byKind];
    if (kindHashtags) {
      kindHashtags.forEach(tag => hashtags.add(tag));
    }
  });

  // Add genre-based hashtags
  genres.forEach(genre => {
    const genreHashtags = hashtagLibrary.byGenre[genre as keyof typeof hashtagLibrary.byGenre];
    if (genreHashtags) {
      genreHashtags.forEach(tag => hashtags.add(tag));
    }
  });

  // Add credit-based hashtags
  creditRoles.forEach(role => {
    const creditHashtags = hashtagLibrary.byCredit[role as keyof typeof hashtagLibrary.byCredit];
    if (creditHashtags) {
      creditHashtags.forEach(tag => hashtags.add(tag));
    }
  });

  // Add location hashtags
  hashtagLibrary.location.forEach(tag => hashtags.add(tag));

  return Array.from(hashtags);
}
