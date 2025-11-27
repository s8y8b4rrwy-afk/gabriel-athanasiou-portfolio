
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { saveScrollPosition } from '../../utils/scrollRestoration';
import { BlogPost } from '../../types';
import { THEME } from '../../theme';
import { OptimizedImage } from '../common/OptimizedImage';
import { parseMarkdown } from '../../utils/markdown';

interface BlogViewProps { 
    posts: BlogPost[]; 
}

/**
 * ⚠️ HOVER ANIMATIONS: All thumbnail hover effects use:
 *   - transform-gpu (hardware acceleration)
 *   - transition-all duration-700 ease-out (smooth, consistent timing)
 *   - scale-100 group-hover:scale-[1.02] (subtle zoom)
 *   - opacity-80 group-hover:opacity-100 (brightness lift)
 * 
 * DO NOT use will-change-transform or long durations (2000ms+) as they cause jitter.
 */
export const BlogView: React.FC<BlogViewProps> = ({ posts }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [showContent, setShowContent] = React.useState(false);
    React.useEffect(() => {
        if (THEME.pageTransitions.enabled) {
            setShowContent(false);
            const timer = setTimeout(() => setShowContent(true), THEME.pageTransitions.delay);
            return () => clearTimeout(timer);
        } else {
            setShowContent(true);
        }
    }, []);

    const [filter, setFilter] = useState<string>("All");
    
    // Sort "Instagram" to the end of the tags list if present, but keep "All" first
    const rawTags = Array.from(new Set(posts.flatMap(p => p.tags)));
    const sortedTags = rawTags.sort((a: string, b: string) => {
        if (a === 'Instagram') return 1;
        if (b === 'Instagram') return -1;
        return a.localeCompare(b);
    });
    const allTags = ["All", ...sortedTags];

    const displayPosts = filter === "All" ? posts : posts.filter(p => p.tags.includes(filter));

    return (
        <section className={`${THEME.filmography.paddingTop} ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} min-h-screen transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'}`}>
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-24">
                     <h1 className={`${THEME.typography.h1} mb-8 mix-blend-difference text-white`}>Journal</h1>
                     <div className={`flex justify-center gap-6 ${THEME.typography.meta} text-white flex-wrap mix-blend-difference`}>
                        {allTags.map(tag => (
                            <button 
                                key={tag}
                                onClick={() => setFilter(tag)}
                                className={`transition-all ${THEME.animation.fast} ${filter === tag ? 'opacity-100 border-b border-white pb-1' : 'opacity-60 hover:opacity-100'}`}
                            >
                                {tag}
                            </button>
                        ))}
                     </div>
                </div>

                <div className="space-y-20">
                    {displayPosts.map((post, i) => (
                        <article 
                            key={post.id} 
                            onClick={() => {
                                navigate(`/journal/${post.slug || post.id}`);
                            }}
                            className="group cursor-pointer border-b border-white/10 pb-16"
                            style={{ animationDelay: `${i * THEME.animation.staggerDelay}ms` }}
                        >
                             <div className="flex flex-col md:flex-row gap-12 items-start">
                                 {post.imageUrl && (
                                     <div className={`w-full md:w-5/12 ${post.source === 'instagram' ? 'aspect-[4/5]' : 'aspect-[3/2]'} overflow-hidden bg-gray-900 relative`}>
                                         <OptimizedImage
                                             recordId={post.id}
                                             fallbackUrl={post.imageUrl}
                                             type="journal"
                                             alt={post.title}
                                             loading="lazy"
                                             className="w-full h-full object-cover transform-gpu scale-100 opacity-80 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
                                        />
                                         {post.source === 'instagram' && (
                                             <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm p-1.5 rounded-full">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                                </svg>
                                             </div>
                                         )}
                                     </div>
                                 )}
                                 <div className="flex-1 pt-4">
                                     <div className={`flex gap-4 ${THEME.typography.meta} text-text-muted mb-6 mix-blend-difference text-white items-center`}>
                                         <span>{post.date}</span>
                                         {post.readingTime && (
                                            <>
                                                <span className="opacity-50">•</span>
                                                <span>{post.readingTime}</span>
                                            </>
                                         )}
                                         {post.source === 'instagram' && (
                                             <span className="opacity-50 tracking-wide"> / INSTAGRAM</span>
                                         )}
                                     </div>
                                     <h2 className={`${THEME.typography.h2} mb-6 group-hover:text-white/80 transition mix-blend-difference text-white`}>{post.title}</h2>
                                     <p className="text-gray-400 font-light leading-loose text-sm md:text-base line-clamp-3 mb-8">
                                        {parseMarkdown(post.content).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}
                                     </p>
                                     <div className={`${THEME.typography.meta} underline underline-offset-4 decoration-white/30 group-hover:decoration-white transition`}>Read</div>
                                 </div>
                             </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
};