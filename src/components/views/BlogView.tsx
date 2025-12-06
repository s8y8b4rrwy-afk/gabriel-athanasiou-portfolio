
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
// import { saveScrollPosition } from '../../utils/scrollRestoration';
import { BlogPost } from '../../types';
import { THEME } from '../../theme';
import { OptimizedImage } from '../common/OptimizedImage';
import { parseMarkdown } from '../../utils/markdown';

export const POSTS_PER_PAGE = 10;

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

    const [searchParams, setSearchParams] = useSearchParams();
    const [filter, setFilter] = useState<string>("All");
    
    // Initialize page from URL or default to 1
    const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);
    const [currentPage, setCurrentPage] = useState(pageFromUrl);
    
    // Sync URL when page changes
    useEffect(() => {
        if (currentPage === 1) {
            // Remove page param if on page 1
            if (searchParams.has('page')) {
                searchParams.delete('page');
                setSearchParams(searchParams, { replace: true });
            }
        } else {
            setSearchParams({ page: currentPage.toString() }, { replace: true });
        }
    }, [currentPage, searchParams, setSearchParams]);
    
    // Filter to only show Published/Public posts (exclude Scheduled/Draft)
    const publicPosts = posts.filter(p => p.status === 'Published' || p.status === 'Public' || !p.status); // Default to showing if no status field
    
    // Sort "Instagram" to the end of the tags list if present, but keep "All" first
    const rawTags = Array.from(new Set(publicPosts.flatMap(p => p.tags)));
    const sortedTags = rawTags.sort((a: string, b: string) => {
        if (a === 'Instagram') return 1;
        if (b === 'Instagram') return -1;
        return a.localeCompare(b);
    });
    const allTags = ["All", ...sortedTags];

    const filteredPosts = filter === "All" ? publicPosts : publicPosts.filter(p => p.tags.includes(filter));
    
    // Pagination
    const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const displayPosts = filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
    
    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filter]);
    
    // Scroll to top when page changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

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
                                navigate(`/journal/${post.slug || post.id}`, { 
                                    state: { from: '/journal', page: currentPage, filter } 
                                });
                            }}
                            className="group cursor-pointer border-b border-white/10 pb-16"
                            style={{ animationDelay: `${i * THEME.animation.staggerDelay}ms` }}
                        >
                             <div className={`grid grid-cols-1 ${THEME.blog.grid.columns} ${THEME.blog.grid.gap} items-center`}>
                                 {post.imageUrl && (
                                     <div className={`w-full ${post.source === 'instagram' ? 'aspect-[4/5]' : 'aspect-[3/2]'} overflow-hidden bg-gray-900 relative`}>
                                         <OptimizedImage
                                             recordId={post.id}
                                             fallbackUrl={post.imageUrl}
                                             type="journal"
                                             alt={post.title}
                                             loading="lazy"
                                             className="w-full h-full object-cover transform-gpu grayscale group-hover:grayscale-0 group-hover:scale-[1.02] transition-all duration-700 ease-out"
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
                                 <div>
                                     <div className={`flex gap-4 ${THEME.typography.meta} text-text-muted mb-6 mix-blend-difference text-white items-center`}>
                                         <span>{post.date}</span>
                                         {post.readingTime && (
                                            <>
                                                <span>—</span>
                                                <span>{post.readingTime}</span>
                                            </>
                                         )}
                                         {post.source === 'instagram' && (
                                             <span className="opacity-50 tracking-wide"> / INSTAGRAM</span>
                                         )}
                                     </div>
                                     <h2 className={`${THEME.typography.h2} mb-6 group-hover:text-white/80 transition mix-blend-difference text-white`}>{post.title}</h2>
                                     <p className="text-gray-400 font-light leading-relaxed text-sm line-clamp-2 mb-8">
                                        {parseMarkdown(post.content).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}
                                     </p>
                                     <span className={`${THEME.typography.meta} underline underline-offset-4 decoration-white/30 group-hover:decoration-white transition`}>Read Article</span>
                                 </div>
                             </div>
                        </article>
                    ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-6 mt-20 pt-12 border-t border-white/10">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={`${THEME.typography.meta} transition ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            ← Previous
                        </button>
                        
                        <div className="flex items-center gap-2">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 text-xs transition ${
                                        currentPage === page 
                                            ? 'text-white border-b border-white' 
                                            : 'text-gray-500 hover:text-white'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className={`${THEME.typography.meta} transition ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
};