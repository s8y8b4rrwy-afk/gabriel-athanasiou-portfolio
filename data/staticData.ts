
import { Project, BlogPost, HomeConfig, ProjectType } from '../types';

/**
 * STATIC SNAPSHOT
 * This data serves as a permanent backup. If Airtable fails, keys expire, 
 * or the service is unreachable, the site will load this content.
 * 
 * Update this file manually if you want to change the "Safe Mode" content.
 */

export const STATIC_CONFIG: HomeConfig = {
    showreel: {
        enabled: true,
        videoUrl: "https://vimeo.com/451664653", // Placeholder aesthetic video
        placeholderImage: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1920"
    },
    contact: {
        email: "gabriel@example.com",
        instagram: "https://instagram.com",
        vimeo: "https://vimeo.com",
        repUK: "Independent",
        repUSA: "Independent"
    },
    about: {
        bio: "Gabriel Athanasiou is a director and visual artist based between London and Athens. With a background in fine art photography, his work is characterized by a rigorous attention to composition and an emotive, textural approach to light.\n\n(This is a static backup loaded because the live connection is unavailable.)",
        profileImage: "https://res.cloudinary.com/date24ay6/image/upload/f_webp,q_90,w_1600,c_limit/v1764382938/ZAF08121_nagmpv.jpg"
    },
    allowedRoles: ["Director"]
};

export const STATIC_PROJECTS: Project[] = [
    {
        id: "backup-1",
        title: "Eternal Return",
        type: ProjectType.NARRATIVE,
        productionCompany: "Independent",
        year: "2024",
        description: "A study of memory and temporal distortion in a near-future metropolis. The protagonist navigates a labyrinth of recurring dreams.",
        isFeatured: true,
        heroImage: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1920",
        videoUrl: "https://vimeo.com/451664653",
        gallery: [
            "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1920",
            "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1920"
        ],
        credits: [
            { role: "Director", name: "Gabriel Athanasiou" },
            { role: "Cinematographer", name: "Sarah Jenkins" }
        ],
        awards: ["Best Cinematography - Raindance 2024"]
    },
    {
        id: "backup-2",
        title: "Vogue / Night",
        type: ProjectType.COMMERCIAL,
        productionCompany: "",
        client: "Vogue",
        year: "2023",
        description: "High fashion nocturne. A campaign exploring the texture of the city at night.",
        isFeatured: true,
        heroImage: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1920",
        videoUrl: "https://vimeo.com/451664653",
        gallery: [],
        credits: [
            { role: "Director", name: "Gabriel Athanasiou" }
        ]
    },
    {
        id: "backup-3",
        title: "Echoes",
        type: ProjectType.MUSIC_VIDEO,
        productionCompany: "Sony Music",
        year: "2023",
        description: "Music video for The Midnight.",
        isFeatured: false,
        heroImage: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=1920",
        videoUrl: "https://vimeo.com/451664653",
        gallery: [],
        credits: [
            { role: "Director", name: "Gabriel Athanasiou" }
        ]
    }
];

export const STATIC_POSTS: BlogPost[] = [
    {
        id: "backup-post-1",
        title: "Notes on Color Theory",
        date: "2024-01-15",
        content: "When the API is down, we reflect on the basics. This is static content serving as a placeholder to ensure the site structure remains intact.",
        tags: ["Process"],
        imageUrl: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?q=80&w=1000",
        readingTime: "1 min read"
    }
];
