
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Project, BlogPost, HomeConfig } from '../../types';
import { VideoEmbed } from '../VideoEmbed';
import { CloseButton } from '../common/CloseButton';
import { SocialShare } from '../SocialShare';
import { THEME } from '../../theme';
import { SEO } from '../SEO';
import { analyticsService } from '../../services/analyticsService';
import { getOptimizedImageUrl, getSessionPreset } from '../../utils/imageOptimization';
import { ProceduralThumbnail, useProceduralThumbnail } from '../ProceduralThumbnail';
import { generateProceduralThumbnail } from '../../utils/thumbnailGenerator';
import { saveScrollPosition } from '../../utils/scrollRestoration';

interface ProjectDetailViewProps { 
    allProjects: Project[];
    allPosts: BlogPost[];
    config: HomeConfig;
}

// Helper function to group awards by festival
const groupAwardsByFestival = (awards: string[]): { festival: string; awards: string[] }[] => {
    const groups = new Map<string, string[]>();
    
    // Common award keywords that indicate "Award: Festival" format
    const awardKeywords = ['best', 'winner', 'award', 'prize', 'official selection', 'nominee', 'finalist', 'honorable mention', 'grand jury', 'audience', 'special mention'];
    
    awards.forEach(award => {
        let matched = false;
        
        // Try to parse "Award Name - Festival Name Year" format (with dash)
        const dashMatch = award.match(/^(.+?)\s*[-–—]\s*(.+?)(\s+\d{4})?$/);
        if (dashMatch) {
            const awardName = dashMatch[1].trim();
            const festivalWithYear = dashMatch[2].trim() + (dashMatch[3] || '');
            const festivalKey = festivalWithYear.trim();
            
            if (!groups.has(festivalKey)) {
                groups.set(festivalKey, []);
            }
            groups.get(festivalKey)!.push(awardName);
            matched = true;
        }
        
        // Try to parse "Award Name: Festival Name Year" format (with colon)
        // Only if the text before colon contains award keywords
        if (!matched && award.includes(':')) {
            const colonIndex = award.indexOf(':');
            const beforeColon = award.substring(0, colonIndex).trim().toLowerCase();
            
            // Check if it contains any award keywords
            const hasAwardKeyword = awardKeywords.some(keyword => beforeColon.includes(keyword));
            
            if (hasAwardKeyword) {
                const awardName = award.substring(0, colonIndex).trim();
                const festivalPart = award.substring(colonIndex + 1).trim();
                
                if (!groups.has(festivalPart)) {
                    groups.set(festivalPart, []);
                }
                groups.get(festivalPart)!.push(awardName);
                matched = true;
            }
        }
        
        // If format doesn't match, treat as standalone festival with "Official Selection"
        if (!matched) {
            groups.set(award, ['Official Selection']);
        }
    });
    
    return Array.from(groups.entries()).map(([festival, awards]) => ({
        festival,
        awards
    }));
};

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ allProjects, allPosts, config }) => {
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
    
    // Find project based on URL param
    const project = allProjects.find(p => (p.slug ? p.slug === slug : p.id === slug));

    const [isPlaying, setIsPlaying] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [creditsExpanded, setCreditsExpanded] = useState(false);
    const [isNextHovered, setIsNextHovered] = useState(false);
    
    // Track project view on load
    useEffect(() => {
        if (project) {
            analyticsService.trackProjectView(project.id, project.title, project.type);
        }
    }, [project]);
    
    if (!project) return null; // Or return a Not Found component

    // Prevent default anchor behavior and event bubbling
    const handleWatchClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsPlaying(true);
        setIsClosing(false);
        
        // Track video play event
        if (project.videoUrl) {
            analyticsService.trackVideoPlay(project.id, project.title);
        }
    };

    const handleCloseTheatre = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsClosing(true);
        setTimeout(() => {
            setIsPlaying(false);
            setIsClosing(false);
        }, 800);
    };
    
    const isLowRes = !project.gallery || project.gallery.length === 0;
    
    // Generate procedural thumbnail if no video and no gallery images
    const shouldUseProcedural = !project.videoUrl && (!project.gallery || project.gallery.length === 0);
    const proceduralUrl = useProceduralThumbnail(
        project.title,
        project.year,
        project.type,
        undefined,
        undefined,
        undefined,
        { showTitle: false, showMetadata: false }
    );
    
    // Get optimized image URLs for slideshow
    const rawSlides = project.gallery && project.gallery.length > 0 
        ? project.gallery 
        : shouldUseProcedural 
            ? [proceduralUrl]
            : [project.heroImage];
    
    const totalImages = rawSlides.length;
    const slides = rawSlides.map((url, index) => {
        if (shouldUseProcedural) {
            return {
                original: url,
                optimized: url,
                isProcedural: true
            };
        }
        const imageUrls = getOptimizedImageUrl(project.id, url, 'project', index, totalImages, getSessionPreset());
        const primaryUrl = imageUrls.useCloudinary ? imageUrls.cloudinaryUrl : imageUrls.localUrl;
        return {
            original: url,
            optimized: primaryUrl,
            fallbackUrl: imageUrls.fallbackUrl,
            secondaryUrl: imageUrls.useCloudinary ? imageUrls.localUrl : imageUrls.fallbackUrl,
            isProcedural: false
        };
    });

    useEffect(() => { 
        setIsPlaying(false);
        setIsClosing(false);
        setCurrentSlide(0);
        setCreditsExpanded(false);
        setIsNextHovered(false);
        window.scrollTo(0, 0);
    }, [slug]);

    useEffect(() => {
        if (slides.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 5000); 
        return () => clearInterval(interval);
    }, [slides.length]);

    const sameTypeProjects = allProjects.filter(p => p.type === project.type);
    const pool = sameTypeProjects.length > 1 ? sameTypeProjects : allProjects;
    let nextProject = pool.length > 1 
        ? pool[(pool.findIndex(p => p.id === project.id) + 1) % pool.length] 
        : null;

    const relatedPost = allPosts.find(p => 
        (project.relatedArticleId && (p.id === project.relatedArticleId || p.slug === project.relatedArticleId)) || 
        (p.relatedProjectId === project.id)
    );
    
    const hasHeroVideo = !!project.videoUrl;

    const formatDescription = (text: string) => {
        if (!text) return [];
        return text.replace(/\. /g, '.\n').split('\n').filter(s => s.trim()).filter(s => s.length > 0);
    };
    
    const isNarrative = project.type === 'Narrative';
    const showClient = THEME.projectDetail.showBrand && !isNarrative && project.client;
    const showProductionCompany = THEME.projectDetail.showClient && !!project.productionCompany;

    const hasCredits = project.credits && Array.isArray(project.credits) && project.credits.length > 0;
    const visibleCredits = hasCredits 
        ? (creditsExpanded ? project.credits : project.credits.slice(0, THEME.projectDetail.credits.initialVisibleCount))
        : [];

    return (
        <div className={`bg-bg-main pb-0 transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'}`}>
            <SEO 
                title={project.title} 
                description={project.description} 
                image={project.heroImage ? (() => {
                    const imageUrls = getOptimizedImageUrl(project.id, project.heroImage, 'project', 0, 1, getSessionPreset());
                    return imageUrls.useCloudinary ? imageUrls.cloudinaryUrl : imageUrls.fallbackUrl;
                })() : undefined}
                type={isNarrative ? 'video.movie' : 'video.other'}
                project={project}
                defaultOgImage={config.defaultOgImage}
            />
            
            {/* --- THEATRE MODE OVERLAY (PORTAL) --- */}
            {isPlaying && hasHeroVideo && createPortal(
                <div className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center ${isClosing ? 'animate-view-exit' : 'animate-view-enter'}`}>
                    
                    {/* Floating Close Button */}
                    <button 
                        onClick={handleCloseTheatre}
                        className={`absolute top-6 right-6 md:top-10 md:right-12 z-[1000] group outline-none mix-blend-difference text-white cursor-pointer`}
                        aria-label="Close Preview"
                    >
                         <div className="flex items-center gap-4">
                            <span className={`hidden md:block ${THEME.typography.meta} opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all ${THEME.animation.medium} ${THEME.animation.ease}`}>
                                Close Preview
                            </span>
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/40 backdrop-blur-[2px] flex items-center justify-center group-hover:bg-white group-hover:border-transparent group-hover:scale-110 transition-all ${THEME.animation.medium} ${THEME.animation.ease} text-white group-hover:text-black`}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-colors ${THEME.animation.medium} ${THEME.animation.ease}`}>
                                    <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="1.2"/>
                                </svg>
                            </div>
                        </div>
                    </button>

                    {/* Video Container */}
                    <div className="w-full h-full p-0 md:p-12 md:pb-20 flex items-center justify-center">
                        <div className="w-full h-full max-w-7xl aspect-video relative shadow-2xl bg-black">
                             <VideoEmbed url={project.videoUrl!} autoplay={true} muted={false} />
                        </div>
                    </div>

                    {/* Footer Title */}
                    <div className="absolute bottom-6 left-6 md:bottom-10 md:left-12 z-[1000] mix-blend-difference text-white pointer-events-none">
                        <h2 className={THEME.typography.h3}>{project.title}</h2>
                        <p className={`${THEME.typography.meta} mt-2 opacity-60`}>Now Playing</p>
                    </div>

                </div>,
                document.body
            )}

            {!isPlaying && <CloseButton onClick={() => {
                // Save current page scroll position before navigating back
                saveScrollPosition(location.pathname);
                
                const from = (location.state as any)?.from as string | undefined;
                if (from) {
                    navigate(-1);
                } else {
                    navigate('/');
                }
            }} />}

            {/* --- HERO SECTION --- */}
            <div className={`w-full ${THEME.projectDetail.heroHeight} relative bg-black overflow-hidden`}>
                {/* Updated Gradient: Fades only at the very bottom (25%) */}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-transparent via-25% to-transparent z-10 pointer-events-none"></div>
                {/* Animated overlay for procedural hero */}
                {shouldUseProcedural && <div className="hero-anim-gradient z-[5]"></div>}
                
                {/* Slideshow */}
                {slides.map((slide, index) => (
                    <div 
                        key={index}
                        className={`absolute inset-0 transition-opacity ${THEME.animation.superSlow} ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'} ${slide.isProcedural ? 'hero-anim' : ''}`}
                    >
                         <img 
                            src={slide.optimized}
                            onError={(e) => { 
                                // Don't fallback if it's procedural (data URL won't fail)
                                if (!slide.isProcedural) {
                                    // Try fallback URLs in sequence
                                    if (e.currentTarget.src === slide.optimized && slide.secondaryUrl) {
                                        e.currentTarget.src = slide.secondaryUrl;
                                    } else if (slide.fallbackUrl && e.currentTarget.src !== slide.fallbackUrl) {
                                        e.currentTarget.src = slide.fallbackUrl;
                                    } else {
                                        e.currentTarget.src = slide.original;
                                    }
                                }
                            }}
                            className={`w-full h-full object-cover ease-linear will-change-transform
                                ${isLowRes && !slide.isProcedural
                                    ? 'animate-slow-spin blur-[60px] md:blur-[60px] opacity-100 saturate-[2.0] brightness-325 contrast-125' 
                                    : `transition-transform duration-[6000ms] ${index === currentSlide ? 'scale-105' : 'scale-100'} ${slide.isProcedural ? 'opacity-100 saturate-[1.25] brightness-110 contrast-110' : 'opacity-80'}`
                                }
                            `} 
                            alt={`${project.title} - Image ${index + 1}`} 
                        />
                    </div>
                ))}
                
                <div className="absolute inset-0 flex items-center justify-center md:inset-auto md:flex-none md:block md:bottom-24 md:right-12 md:top-auto md:left-auto z-30">
                    {hasHeroVideo ? (
                        <button 
                            onClick={handleWatchClick}
                            className="group flex items-center gap-4 mix-blend-difference cursor-pointer outline-none"
                        >
                            <span className={`${THEME.typography.meta} text-white opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all ${THEME.animation.medium} ${THEME.animation.ease} hidden md:block`}>Watch Film</span>
                            <div className={`w-16 h-16 md:w-20 md:h-20 ${THEME.ui.button.radius} ${THEME.ui.button.border} flex items-center justify-center bg-black/20 ${THEME.ui.button.backdrop} group-hover:bg-white/10 group-hover:border-white transition-all ${THEME.animation.medium} ${THEME.animation.ease} group-hover:scale-105`}>
                                <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" className="text-white ml-1"><path d="M11.5 7L0.5 13.5L0.5 0.5L11.5 7Z"/></svg>
                            </div>
                        </button>
                    ) : (
                        <button 
                            onClick={() => {
                                analyticsService.trackEvent('contact_cta_click', { project_id: project.id, project_title: project.title });
                                navigate('/about');
                            }}
                            className={`group inline-flex items-center mix-blend-difference cursor-pointer outline-none`}
                            aria-label="Contact to request viewing link"
                        >
                            <div className={`px-5 py-3 ${THEME.ui.button.radius} ${THEME.ui.button.border} ${THEME.ui.button.backdrop} bg-black/30 text-white/90 hover:bg-white/10 hover:border-white transition ${THEME.animation.medium} ${THEME.animation.ease} group-hover:scale-[1.02]`}
                            >
                                <span className={`${THEME.typography.meta} tracking-[0.25em]`}>CONTACT TO REQUEST VIEWING LINK</span>
                            </div>
                        </button>
                    )}
                </div>
                
                <div className={`absolute z-20 animate-fade-in-up pointer-events-none mix-blend-difference text-white ${THEME.hero.textPosition} ${THEME.hero.textMaxWidth}`}>
                    <h1 className={`${THEME.typography.h1} mb-2 leading-tight break-words`}>{project.title}</h1>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-300 mt-2 ml-1">
                        {project.kinds && project.kinds.length > 0 ? project.kinds.join(' / ') : (project.type !== 'Uncategorized' ? project.type : 'Project')} — {project.year}
                    </p>
                </div>
            </div>

            {/* --- CONTENT --- */}
            <div className={`${THEME.projectDetail.contentMaxWidth} mx-auto ${THEME.header.paddingX} py-24 grid grid-cols-1 md:grid-cols-12 ${THEME.projectDetail.gridGap}`}>
                
                {/* Sidebar - Unified Scrolling */}
                <div 
                    className={`md:col-span-4 self-start md:sticky ${THEME.projectDetail.sidebarStickyTop} animate-fade-in-up pr-2`} 
                    style={{ animationDelay: '100ms' }}
                >
                    
                    {/* Client / Production Company Logic */}
                    <div className="mb-8 border-b border-white/10">
                        {showClient && (
                            <div className="mb-8">
                                <p className={`${THEME.typography.meta} text-text-muted mb-2`}>Client</p>
                                <p className={THEME.typography.h3}>{project.client}</p>
                            </div>
                        )}
                        
                        {showProductionCompany && (
                            <div className="mb-8">
                                <p className={`${THEME.typography.meta} text-text-muted mb-2`}>Production Company</p>
                                <p className={THEME.typography.h3}>{project.productionCompany}</p>
                            </div>
                        )}
                    </div>

                    <div className="text-lg text-gray-300 font-light mb-8 space-y-6">
                        {formatDescription(project.description).map((paragraph, i) => (
                             <p key={i}>{paragraph}</p>
                        ))}
                    </div>
                    
                    {THEME.projectDetail.showGenre && project.genre && project.genre.length > 0 && (
                        <div className="mb-8">
                             <p className={`${THEME.typography.meta} text-text-muted mb-2`}>Genre</p>
                             <div className="flex flex-wrap gap-2">
                                {project.genre.map(g => (
                                    <span key={g} className="text-xs text-white border border-white/20 px-2 py-1 rounded-sm opacity-80">{g}</span>
                                ))}
                             </div>
                        </div>
                    )}

                    {THEME.projectDetail.showAwards && project.awards && project.awards.length > 0 && (
                        <div className="mb-12">
                            <p className={`${THEME.typography.meta} text-text-muted mb-4 border-b border-white/10 pb-2`}>Recognition</p>
                            <div className="space-y-4">
                                {groupAwardsByFestival(project.awards).map((group, groupIdx) => (
                                    <div key={groupIdx}>
                                        {group.awards.length > 0 ? (
                                            // Festival with multiple awards - show grouped
                                            <div className="space-y-1.5">
                                                <p className="text-sm font-medium text-white flex items-start">
                                                    <span className="mr-2 text-white/20 select-none">✦</span>
                                                    <span>{group.festival}</span>
                                                </p>
                                                <ul className="space-y-1 pl-6">
                                                    {group.awards.map((award, awardIdx) => (
                                                        <li key={awardIdx} className="text-sm text-white/60 relative before:content-['•'] before:absolute before:-left-3 before:text-white/20">
                                                            {award}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            // Standalone festival/award - show as single line
                                            <p className="text-sm font-medium text-white flex items-start">
                                                <span className="mr-2 text-white/20 select-none">✦</span>
                                                <span>{group.festival}</span>
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {relatedPost && (
                        <div className="mb-12">
                            <p className={`${THEME.typography.meta} text-text-muted mb-4 border-b border-white/10 pb-2`}>Behind the Scenes</p>
                            <button 
                                onClick={() => navigate(`/journal/${relatedPost.slug || relatedPost.id}`, { state: { from: location.pathname + location.search } })}
                                className="text-left group w-full"
                            >
                                <span className={`block ${THEME.typography.h3} text-white group-hover:opacity-70 transition`}>{relatedPost.title} &rarr;</span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 block">Read Article</span>
                            </button>
                        </div>
                    )}

                    {project.externalLinks && project.externalLinks.length > 0 && (
                        <div className="mb-12 flex flex-col items-start gap-3">
                            {project.externalLinks.map((link, i) => (
                                <a 
                                    key={i} 
                                    href={link.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={() => analyticsService.trackExternalLink(link.label, link.url)}
                                    className={`${THEME.typography.meta} text-white hover:opacity-50 transition border-b border-white/30 pb-1`}
                                >
                                    {link.label} &rarr;
                                </a>
                            ))}
                        </div>
                    )}

                    <div className="mb-12">
                        <SocialShare 
                            url={typeof window !== 'undefined' ? window.location.href : ''}
                            title={project.title}
                            description={project.description}
                            layout="vertical"
                        />
                    </div>

                    {hasCredits && (
                        <div className="border-t border-white/10 pt-8">
                            <div className="grid grid-cols-2 md:grid-cols-1 gap-6">
                                {visibleCredits.map((c, i) => (
                                    <div key={i} className="animate-fade-in-up">
                                        <span className={`block ${THEME.typography.meta} text-gray-500 mb-1`}>{c.role}</span>
                                        <span className="text-sm font-medium">{c.name}</span>
                                    </div>
                                ))}
                            </div>
                            {THEME.projectDetail.credits.enableExpand && project.credits.length > THEME.projectDetail.credits.initialVisibleCount && (
                                <button 
                                    onClick={() => setCreditsExpanded(!creditsExpanded)}
                                    className={`mt-6 ${THEME.typography.meta} text-text-muted hover:text-white transition flex items-center gap-2`}
                                >
                                    {creditsExpanded ? 'See Less' : 'See More'}
                                    <svg width="8" height="8" viewBox="0 0 10 10" className={`transition-transform ${THEME.animation.fast} ${creditsExpanded ? 'rotate-180' : ''}`}>
                                        <path d="M1 3L5 7L9 3" stroke="currentColor" fill="none"/>
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Main Body */}
                <div className="md:col-span-8 space-y-24 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    
                    {project.videoUrl && (
                         <div className="w-full aspect-video bg-black shadow-lg">
                            <VideoEmbed url={project.videoUrl} autoplay={false} />
                        </div>
                    )}

                    {project.additionalVideos && project.additionalVideos.map((videoUrl, i) => (
                        <div key={`extra-video-${i}`} className="w-full aspect-video bg-black shadow-lg">
                            <VideoEmbed url={videoUrl} autoplay={false} />
                        </div>
                    ))}

                    {project.gallery && project.gallery.map((img, i) => {
                        const imageUrls = getOptimizedImageUrl(project.id, img, 'project', i, project.gallery!.length, getSessionPreset());
                        const primaryUrl = imageUrls.useCloudinary ? imageUrls.cloudinaryUrl : imageUrls.localUrl;
                        return (
                            <div key={i} className="w-full overflow-hidden">
                                <img 
                                    src={primaryUrl}
                                    onError={(e) => { 
                                        // Try fallback URLs in sequence
                                        if (e.currentTarget.src === primaryUrl) {
                                            e.currentTarget.src = imageUrls.useCloudinary ? imageUrls.localUrl : imageUrls.fallbackUrl;
                                        } else if (e.currentTarget.src !== imageUrls.fallbackUrl) {
                                            e.currentTarget.src = imageUrls.fallbackUrl;
                                        }
                                    }}
                                    loading="lazy"
                                    className={`w-full transition ${THEME.animation.superSlow} ${THEME.animation.ease} hover:scale-[1.01] will-change-transform`} 
                                    alt={`${project.title} - Behind the scenes image ${i + 1}`} 
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- NEXT PROJECT --- */}
            {nextProject && (
                <div 
                    onClick={() => {
                        navigate(`/work/${nextProject!.slug || nextProject!.id}`);
                    }}
                    onMouseEnter={() => setIsNextHovered(true)}
                    onMouseLeave={() => setIsNextHovered(false)}
                    className={`w-full ${THEME.projectDetail.nextProject.height} relative group cursor-pointer overflow-hidden border-t border-white/10`}
                >
                    <div 
                        className={`absolute inset-0 bg-black z-10 transition-opacity ${THEME.animation.medium}`} 
                        style={{ 
                            opacity: isNextHovered 
                                ? THEME.projectDetail.nextProject.hoverOverlayOpacity 
                                : THEME.projectDetail.nextProject.overlayOpacity 
                        }}
                    ></div>
                    {(() => {
                        const hasHero = !!nextProject.heroImage;
                        const shouldProcedural = !hasHero && (!nextProject.gallery || nextProject.gallery.length === 0) && !nextProject.videoUrl;
                        let src;
                        if (hasHero && nextProject.heroImage) {
                            const imageUrls = getOptimizedImageUrl(nextProject.id, nextProject.heroImage, 'project', 0, 1, getSessionPreset());
                            src = imageUrls.useCloudinary ? imageUrls.cloudinaryUrl : imageUrls.localUrl;
                        } else {
                            src = generateProceduralThumbnail({
                              title: nextProject.title,
                              year: nextProject.year,
                              type: nextProject.type,
                              width: 1600,
                              height: 900,
                              showTitle: false,
                              showMetadata: false
                            });
                        }
                        return (
                          <img 
                            src={src}
                            onError={(e) => { if (hasHero) e.currentTarget.src = nextProject.heroImage; }}
                            className={`w-full h-full object-cover transform scale-100 group-hover:scale-[1.02] transition ${THEME.animation.superSlow} ${THEME.animation.ease} will-change-transform ${!hasHero ? 'saturate-[1.2] brightness-110 contrast-110' : ''}`} 
                          />
                        );
                    })()}
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4 mix-blend-difference text-white">
                        <span className={`${THEME.typography.meta} mb-4 opacity-80`}>Next {nextProject.kinds && nextProject.kinds.length > 0 ? nextProject.kinds.join(' / ') : (nextProject.type !== 'Uncategorized' ? nextProject.type : 'Project')}</span>
                        <h2 className={`${THEME.typography.h1} group-hover:scale-105 transition duration-1000 ${THEME.animation.ease}`}>{nextProject.title}</h2>
                    </div>
                </div>
            )}
        </div>
    );
};