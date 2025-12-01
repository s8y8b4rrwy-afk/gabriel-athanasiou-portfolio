
import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { BlogPost, Project, HomeConfig } from '../../types';
import { CloseButton } from '../common/CloseButton';
import { SocialShare } from '../SocialShare';
import { parseMarkdown } from '../../utils/markdown';
import { THEME } from '../../theme';
import { SEO } from '../SEO';
import { analyticsService } from '../../services/analyticsService';
import { getOptimizedImageUrl, getSessionPreset } from '../../utils/imageOptimization';
import { OptimizedImage } from '../common/OptimizedImage';
import { saveScrollPosition } from '../../utils/scrollRestoration';

interface BlogPostViewProps { 
    allPosts: BlogPost[]; 
    allProjects: Project[];
    config: HomeConfig;
}

export const BlogPostView: React.FC<BlogPostViewProps> = ({ allPosts, allProjects, config }) => {
    const { slug } = useParams<{ slug: string }>();
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

    const post = allPosts.find(p => (p.slug ? p.slug === slug : p.id === slug));

    // Redirect to journal index if post is not published
    useEffect(() => {
        if (post && post.status && post.status !== 'Published' && post.status !== 'Public') {
            navigate('/journal', { replace: true });
        }
    }, [post, navigate]);

    // Scroll to top on slug change (browser back/forward)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    // Track blog post view on load
    useEffect(() => {
        if (post && (post.status === 'Published' || post.status === 'Public' || !post.status)) {
            analyticsService.trackBlogPostView(post.id, post.title);
        }
    }, [post]);

    if (!post) return null; // Or 404
    if (post.status && post.status !== 'Published' && post.status !== 'Public') return null; // Don't render unpublished posts

    // Filter to only published posts for navigation
    const publishedPosts = allPosts.filter(p => p.status === 'Published' || p.status === 'Public' || !p.status);
    const currentIndex = publishedPosts.findIndex(p => p.id === post.id);
    const prevPost = currentIndex > 0 ? publishedPosts[currentIndex - 1] : null;
    const nextPost = currentIndex < publishedPosts.length - 1 ? publishedPosts[currentIndex + 1] : null;

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
        <article className={`bg-bg-main min-h-screen transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'}`}>
            <SEO 
                title={post.title} 
                description={post.content.substring(0, 150)} 
                image={post.imageUrl ? (() => {
                    const imageUrls = getOptimizedImageUrl(post.id, post.imageUrl, 'journal', 0, 1, getSessionPreset());
                    return imageUrls.useCloudinary ? imageUrls.cloudinaryUrl : imageUrls.fallbackUrl;
                })() : post.imageUrl}
                type="article"
                post={post}
                defaultOgImage={config.defaultOgImage}
            />
            <CloseButton onClick={() => {
                // Save current page scroll position before navigating back
                saveScrollPosition(location.pathname);
                
                const state = location.state as { from?: string; page?: number; filter?: string } | undefined;
                if (state?.from === '/journal' && state?.page && state.page > 1) {
                    // Navigate back to the correct page in journal
                    navigate(`/journal?page=${state.page}`);
                } else if (state?.from) {
                    navigate(-1);
                } else {
                    navigate('/journal');
                }
            }} />

            <div className={`w-full ${THEME.blog.post.heroHeight} relative overflow-hidden`}>
                {/* Subtle gradient - only at the very bottom for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent via-25% to-transparent z-10"></div>
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
                <div className={`absolute inset-0 ${THEME.projectDetail.contentMaxWidth} mx-auto ${THEME.header.paddingX} flex flex-col justify-end pb-12`}>
                    <div className="z-20 max-w-3xl">
                         <div className={`flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/70 mb-4`}>
                             <span>{post.date}</span>
                             {post.readingTime && (
                                <>
                                    <span className="text-white/40">·</span>
                                    <span>{post.readingTime}</span>
                                </>
                             )}
                             {isInstagram && <span className="text-white font-bold bg-white/20 px-2 py-0.5 rounded-sm backdrop-blur-md ml-2">INSTAGRAM</span>}
                         </div>
                         <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif italic leading-tight text-white">{post.title}</h1>
                    </div>
                </div>
            </div>

            <div className={`${THEME.blog.post.contentWidth} mx-auto px-6 py-10 md:py-20`}>
                <div className="blog-content text-sm md:text-base leading-relaxed text-gray-400 font-light space-y-5 [&>p]:mb-5 [&>h1]:text-2xl [&>h1]:font-serif [&>h1]:italic [&>h1]:mt-10 [&>h1]:mb-5 [&>h1]:text-white [&>h2]:text-xl [&>h2]:font-serif [&>h2]:italic [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:text-white [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mt-6 [&>h3]:mb-3 [&>h3]:text-white [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:space-y-2 [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:space-y-2 [&>blockquote]:border-l-2 [&>blockquote]:border-white/20 [&>blockquote]:pl-6 [&>blockquote]:italic [&>blockquote]:text-gray-500">
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