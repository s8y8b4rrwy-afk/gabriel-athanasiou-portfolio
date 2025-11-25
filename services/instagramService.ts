
import { BlogPost } from '../types';
import { calculateReadingTime } from './cmsService';

// To use live data, you would generate a Long-Lived Access Token 
// via the Instagram Basic Display API and add it to your environment variables.
const INSTAGRAM_TOKEN = process.env.REACT_APP_INSTAGRAM_TOKEN || ""; 
const INSTAGRAM_USER_ID = "me"; // Or specific ID if known

// Mock data to simulate gab.ath feed structure immediately
const MOCK_INSTAGRAM_POSTS = [
    {
        id: "ig_001",
        caption: "Location scouting in the highlands. The light here hits differently at 4am. \n\n#director #filmmaking #scotland #locationscout",
        media_type: "IMAGE",
        media_url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200",
        permalink: "https://instagram.com",
        timestamp: "2024-02-14T10:30:00+0000"
    },
    {
        id: "ig_002",
        caption: "Frame from the archives. Developing 16mm test shots for the new project. \n\n#16mm #filmphotography #cinematography",
        media_type: "IMAGE", // Simplified for demo
        media_url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200",
        permalink: "https://instagram.com",
        timestamp: "2024-01-28T14:20:00+0000"
    },
    {
        id: "ig_003",
        caption: "Wrap day on 'Echoes'. Incredible team, incredible energy. Can't wait to share this one. \n\n#setlife #production #director",
        media_type: "CAROUSEL_ALBUM",
        media_url: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?q=80&w=1200",
        permalink: "https://instagram.com",
        timestamp: "2023-12-10T09:00:00+0000"
    }
];

export const instagramService = {
    
    fetchPosts: async (): Promise<BlogPost[]> => {
        try {
            let rawPosts = [];

            // 1. Try Live API if Token Exists
            if (INSTAGRAM_TOKEN) {
                const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";
                const response = await fetch(`https://graph.instagram.com/${INSTAGRAM_USER_ID}/media?fields=${fields}&access_token=${INSTAGRAM_TOKEN}&limit=6`);
                
                if (response.ok) {
                    const data = await response.json();
                    rawPosts = data.data;
                } else {
                    console.warn("Instagram API Error, falling back to mock.");
                    rawPosts = MOCK_INSTAGRAM_POSTS;
                }
            } else {
                // 2. Use Mock Data (Simulation)
                // console.log("No Instagram Token found. Using mock data.");
                rawPosts = MOCK_INSTAGRAM_POSTS;
            }

            // 3. Process & Map to BlogPost
            return rawPosts.map((post: any) => {
                // Clean Caption: Remove hashtags (#word) and trim
                const rawCaption = post.caption || "";
                
                // Regex to find hashtags
                const hashtagRegex = /#[a-z0-9_]+/gi;
                
                // Create a "Title" from the first sentence or first few words
                const cleanCaption = rawCaption.replace(hashtagRegex, '').trim();
                const title = cleanCaption.split('\n')[0].substring(0, 50) + (cleanCaption.length > 50 ? '...' : '');
                
                // Format content (newlines to <br>)
                const content = cleanCaption.replace(/\n/g, '<br/>');

                // Determine Date (YYYY-MM-DD)
                const date = new Date(post.timestamp).toISOString().split('T')[0];

                // Use media_url or thumbnail_url (for videos)
                const image = post.thumbnail_url || post.media_url || "";

                return {
                    id: `ig-${post.id}`,
                    title: title || "Untitled", // Instagram posts don't have titles, so we derive one
                    date: date,
                    readingTime: calculateReadingTime(cleanCaption), // Reusing utility
                    content: content,
                    imageUrl: image,
                    tags: ["Instagram"], // Auto-tag
                    relatedProjectId: undefined,
                    source: 'instagram',
                    externalUrl: post.permalink
                } as BlogPost;
            });

        } catch (error) {
            console.error("Failed to fetch Instagram posts", error);
            return [];
        }
    }
};
