
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, BlogPost } from '../../types';
import { VideoEmbed } from '../VideoEmbed';
import { CloseButton } from '../common/CloseButton';
import { SocialShare } from '../SocialShare';
import { THEME } from '../../theme';
import { SEO } from '../SEO';
import { analyticsService } from '../../services/analyticsService';
import { getOptimizedImageUrl } from '../../utils/imageOptimization';

interface ProjectDetailViewProps { 
    allProjects: Project[];
    allPosts: BlogPost[];
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ allProjects, allPosts }) => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    
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
    
    // Get optimized image URLs for slideshow
    const rawSlides = project.gallery && project.gallery.length > 0 ? project.gallery : [project.heroImage];
    const totalImages = rawSlides.length;
    const slides = rawSlides.map((url, index) => ({
        original: url,
        optimized: getOptimizedImageUrl(project.id, url, 'project', index, totalImages)
    }));

    useEffect(() => { 
        setIsPlaying(false);
        setIsClosing(false);
        setCurrentSlide(0);
        setCreditsExpanded(false);
        setIsNextHovered(false);
    }, [project?.id, project?.slug]);

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
    const showBrand = THEME.projectDetail.showBrand && !isNarrative && project.brand;
    const showClient = THEME.projectDetail.showClient && !!project.client;

    const visibleCredits = creditsExpanded ? project.credits : project.credits.slice(0, THEME.projectDetail.credits.initialVisibleCount);

    return (
        <div className="bg-bg-main animate-view-enter pb-0">
            <SEO title={project.title} description={project.description} image={project.heroImage} />
            
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

            {!isPlaying && <CloseButton onClick={() => navigate('/work')} />}

            {/* --- HERO SECTION --- */}
            <div className={`w-full ${THEME.projectDetail.heroHeight} relative bg-black overflow-hidden`}>
                {/* Updated Gradient: Fades only at the very bottom (25%) */}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-transparent via-25% to-transparent z-10 pointer-events-none"></div>
                
                {/* Slideshow */}
                {slides.map((slide, index) => (
                    <div 
                        key={index}
                        className={`absolute inset-0 transition-opacity ${THEME.animation.superSlow} ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                    >
                         <img 
                            src={slide.optimized}
                            onError={(e) => { e.currentTarget.src = slide.original; }}
                            className={`w-full h-full object-cover ease-linear will-change-transform
                                ${isLowRes 
                                    ? 'animate-slow-spin blur-[60px] md:blur-[60px] opacity-100 saturate-[2.0] brightness-325 contrast-125' 
                                    : `transition-transform duration-[6000ms] ${index === currentSlide ? 'scale-105' : 'scale-100'} opacity-80`
                                }
                            `} 
                            alt="" 
                        />
                    </div>
                ))}
                
                <div className="absolute bottom-12 md:bottom-24 right-6 md:right-12 z-30">
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
                        <div className="bg-black/40 backdrop-blur-md px-4 py-3 border border-white/10 rounded-md">
                                <span className={`${THEME.typography.meta} text-white/80`}>Contact to request viewing link</span>
                        </div>
                    )}
                </div>
                
                <div className={`absolute z-20 animate-fade-in-up pointer-events-none mix-blend-difference text-white ${THEME.hero.textPosition} ${THEME.hero.textMaxWidth}`}>
                    <h1 className={`${THEME.typography.h1} mb-2 leading-tight break-words`}>{project.title}</h1>
                    <div className={`flex flex-wrap gap-4 md:gap-6 ${THEME.typography.meta}`}>
                        <span>{project.type !== 'Uncategorized' ? project.type : 'Project'}</span>
                        <span>—</span>
                        <span>{project.year}</span>
                    </div>
                </div>
            </div>

            {/* --- CONTENT --- */}
            <div className={`${THEME.projectDetail.contentMaxWidth} mx-auto ${THEME.header.paddingX} py-24 grid grid-cols-1 md:grid-cols-12 ${THEME.projectDetail.gridGap}`}>
                
                {/* Sidebar - Unified Scrolling */}
                <div 
                    className={`md:col-span-4 self-start md:sticky ${THEME.projectDetail.sidebarStickyTop} animate-fade-in-up pr-2`} 
                    style={{ animationDelay: '100ms' }}
                >
                    
                    {/* Brand / Production Company Logic */}
                    <div className="mb-8 border-b border-white/10">
                        {showBrand && (
                            <div className="mb-8">
                                <p className={`${THEME.typography.meta} text-text-muted mb-2`}>Brand</p>
                                <p className={THEME.typography.h3}>{project.brand}</p>
                            </div>
                        )}
                        
                        {showClient && (
                            <div className="mb-8">
                                <p className={`${THEME.typography.meta} text-text-muted mb-2`}>Production Company</p>
                                <p className={THEME.typography.h3}>{project.client}</p>
                            </div>
                        )}
                    </div>

                    <div className={`${THEME.typography.body} text-gray-200 mb-12 space-y-6`}>
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
                            <ul className="space-y-2">
                                {project.awards.map((award, i) => (
                                    <li key={i} className="text-sm font-medium text-gray-300">{award}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {relatedPost && (
                        <div className="mb-12">
                            <p className={`${THEME.typography.meta} text-text-muted mb-4 border-b border-white/10 pb-2`}>Behind the Scenes</p>
                            <button 
                                onClick={() => navigate(`/journal/${relatedPost.slug || relatedPost.id}`)}
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
                        const optimizedUrl = getOptimizedImageUrl(project.id, img, 'project', i, project.gallery!.length);
                        return (
                            <div key={i} className="w-full overflow-hidden">
                                <img 
                                    src={optimizedUrl}
                                    onError={(e) => { e.currentTarget.src = img; }}
                                    loading="lazy"
                                    className={`w-full transition ${THEME.animation.superSlow} ${THEME.animation.ease} hover:scale-[1.01] will-change-transform`} 
                                    alt="Gallery" 
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
                    
                    <img 
                        src={getOptimizedImageUrl(nextProject.id, nextProject.heroImage, 'project', 0)}
                        onError={(e) => { e.currentTarget.src = nextProject.heroImage; }}
                        className={`w-full h-full object-cover transform scale-100 group-hover:scale-[1.02] transition ${THEME.animation.superSlow} ${THEME.animation.ease} will-change-transform`} 
                    />
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4 mix-blend-difference text-white">
                        <span className={`${THEME.typography.meta} mb-4 opacity-80`}>Next {nextProject.type !== 'Uncategorized' ? nextProject.type : 'Project'}</span>
                        <h2 className={`${THEME.typography.h1} group-hover:scale-105 transition duration-1000 ${THEME.animation.ease}`}>{nextProject.title}</h2>
                    </div>
                </div>
            )}
        </div>
    );
};