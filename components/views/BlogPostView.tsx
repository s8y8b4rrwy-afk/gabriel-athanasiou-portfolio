
import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { BlogPost, Project } from '../../types';
import { CloseButton } from '../common/CloseButton';
import { SocialShare } from '../SocialShare';
import { parseMarkdown } from '../../utils/markdown';
import { THEME } from '../../theme';
import { SEO } from '../SEO';
import { analyticsService } from '../../services/analyticsService';
import { getOptimizedImageUrl } from '../../utils/imageOptimization';
import { OptimizedImage } from '../common/OptimizedImage';
import { saveScrollPosition } from '../../utils/scrollRestoration';

interface BlogPostViewProps { 
    allPosts: BlogPost[]; 
    allProjects: Project[];
}

export const BlogPostView: React.FC<BlogPostViewProps> = ({ allPosts, allProjects }) => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const post = allPosts.find(p => (p.slug ? p.slug === slug : p.id === slug));

    // Scroll to top on slug change (browser back/forward)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    // Track blog post view on load
    useEffect(() => {
        if (post) {
            analyticsService.trackBlogPostView(post.id, post.title);
        }
    }, [post]);

    if (!post) return null; // Or 404

    const currentIndex = allPosts.findIndex(p => p.id === post.id);
    const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
    const nextPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

    const relatedProject = post.relatedProjectId ? allProjects.find(p => p.id === post.relatedProjectId) : null;
    const isInstagram = post.source === 'instagram';

    // Helper to determine link label
    const getLinkLabel = (url: string) => {
        const lower = url.toLowerCase();
        if (lower.includes('instagram.com')) return 'View on Instagram';
        if (lower.includes('linkedin.com')) return 'View on LinkedIn';
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'View on YouTube';
        if (lower.includes('vimeo.com')) return 'View on Vimeo';
        if (lower.includes('twitter.com') || lower.includes('x.com')) return 'View on X';
        return 'View Link';
    }

    return (
        <article className="bg-bg-main min-h-screen">
            <SEO 
                title={post.title} 
                description={post.content.substring(0, 150)} 
                image={post.imageUrl ? (() => {
                    const imageUrls = getOptimizedImageUrl(post.id, post.imageUrl, 'journal', 0);
                    return imageUrls.useCloudinary ? imageUrls.cloudinaryUrl : imageUrls.fallbackUrl;
                })() : post.imageUrl}
                type="article"
                post={post}
            />
            <CloseButton onClick={() => {
                // Save current page scroll position before navigating back
                saveScrollPosition(location.pathname);
                
                const from = (location.state as any)?.from as string | undefined;
                if (from) {
                    navigate(-1);
                } else {
                    navigate('/journal');
                }
            }} />

            <div className={`w-full ${THEME.blog.post.heroHeight} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/40 z-10"></div>
                {post.imageUrl && (
                    <OptimizedImage
                        recordId={post.id}
                        fallbackUrl={post.imageUrl}
                        type="journal"
                        alt={post.title}
                        loading="eager"
                        className="w-full h-full object-cover animate-reveal will-change-transform"
                    />
                )}
                <div className={`absolute bottom-12 left-6 md:left-12 z-20 max-w-4xl mix-blend-difference text-white`}>
                     <div className={`flex gap-4 ${THEME.typography.meta} mb-6 opacity-80`}>
                         <span>{post.date}</span>
                         {post.readingTime && <span>• {post.readingTime}</span>}
                         {isInstagram && <span className="text-white font-bold bg-white/20 px-2 rounded-sm backdrop-blur-md">INSTAGRAM</span>}
                     </div>
                     <h1 className={`${THEME.typography.h1} leading-tight line-clamp-3`}>{post.title}</h1>
                </div>
            </div>

            <div className={`${THEME.blog.post.contentWidth} mx-auto px-6 py-20`}>
                <div className="blog-content text-lg leading-relaxed text-gray-300 font-light space-y-6 [&>p]:mb-6 [&>h1]:text-3xl [&>h1]:font-serif [&>h1]:italic [&>h1]:mt-12 [&>h1]:mb-6 [&>h2]:text-2xl [&>h2]:font-serif [&>h2]:italic [&>h2]:mt-10 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-medium [&>h3]:mt-8 [&>h3]:mb-3 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:space-y-2 [&>blockquote]:border-l-2 [&>blockquote]:border-white/30 [&>blockquote]:pl-6 [&>blockquote]:italic [&>blockquote]:text-gray-400">
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }} />
                </div>
                
                {/* External Links Section */}
                {(post.externalUrl || (post.relatedLinks && post.relatedLinks.length > 0)) && (
                    <div className="mt-12 flex flex-col items-start gap-4">
                        
                        {/* Primary Source Link (Instagram integration) */}
                        {isInstagram && post.externalUrl && (
                             <a 
                                href={post.externalUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-3 px-8 py-3 rounded-full border border-white/30 text-white hover:bg-white hover:text-black transition duration-300 uppercase tracking-widest text-xs font-bold"
                            >
                                View on Instagram
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                            </a>
                        )}

                        {/* Airtable Links */}
                        {post.relatedLinks?.map((link, i) => (
                             <a 
                                key={i}
                                href={link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-3 px-8 py-3 rounded-full border border-white/30 text-white hover:bg-white hover:text-black transition duration-300 uppercase tracking-widest text-xs font-bold"
                            >
                                {getLinkLabel(link)}
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                            </a>
                        ))}
                    </div>
                )}
                
                {relatedProject && (
                    <div className="my-16 border-t border-b border-white/10 py-8">
                        <span className={`${THEME.typography.meta} text-text-muted mb-4 block`}>Associated Project</span>
                        <div 
                            onClick={() => navigate(`/work/${relatedProject.slug || relatedProject.id}`, { state: { from: location.pathname + location.search } })}
                            className="group cursor-pointer flex gap-6 items-center"
                        >
                            <div className="w-24 h-16 bg-gray-900 overflow-hidden shrink-0">
                                <OptimizedImage
                                    recordId={relatedProject.id}
                                    fallbackUrl={relatedProject.heroImage}
                                    type="project"
                                    alt={relatedProject.title}
                                    loading="lazy"
                                    className={`w-full h-full object-cover group-hover:scale-[1.05] transition-transform ${THEME.animation.medium} ${THEME.animation.ease}`}
                                />
                            </div>
                            <div>
                                <h3 className={`${THEME.typography.h3} text-white transition-colors ${THEME.animation.fast}`}>{relatedProject.title}</h3>
                                <span className={`${THEME.typography.meta} text-gray-500 group-hover:text-white transition-colors ${THEME.animation.fast}`}>View Project &rarr;</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="border-t border-white/10 mt-20 pt-12 mb-12">
                    <SocialShare 
                        url={typeof window !== 'undefined' ? window.location.href : ''}
                        title={post.title}
                        description={post.content.substring(0, 150)}
                        className="mb-12"
                    />
                </div>

                <div className="border-t border-white/10 pt-12 flex justify-between items-center">
                    {prevPost ? (
                        <button onClick={() => { navigate(`/journal/${prevPost.slug || prevPost.id}`); }} className="text-left group w-1/2">
                            <span className={`block ${THEME.typography.meta} text-text-muted mb-1`}>Previous</span>
                            <span className={`${THEME.typography.h3} text-white group-hover:opacity-70 transition line-clamp-1`}>{prevPost.title}</span>
                        </button>
                    ) : <div></div>}

                    {nextPost ? (
                        <button onClick={() => { navigate(`/journal/${nextPost.slug || nextPost.id}`); }} className="text-right group w-1/2 flex flex-col items-end">
                            <span className={`block ${THEME.typography.meta} text-text-muted mb-1`}>Next</span>
                            <span className={`${THEME.typography.h3} text-white group-hover:opacity-70 transition line-clamp-1`}>{nextPost.title}</span>
                        </button>
                    ) : <div></div>}
                </div>
            </div>
        </article>
    );
};