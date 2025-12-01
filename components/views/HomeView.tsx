
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { saveScrollPosition } from '../../utils/scrollRestoration';
import { Project, BlogPost, HomeConfig } from '../../types';
import { VideoEmbed } from '../VideoEmbed';
import { THEME } from '../../theme';
import { OptimizedImage } from '../common/OptimizedImage';
import { getSessionPreset, upgradePreset } from '../../utils/imageOptimization';

interface HomeViewProps { 
    projects: Project[]; 
    posts: BlogPost[];
    config: HomeConfig;
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
export const HomeView: React.FC<HomeViewProps> = ({ projects, posts, config }) => {
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

    const showShowreel = config.showreel?.enabled && config.showreel.videoUrl;
    const featuredProjects = projects.filter(p => p.isFeatured);
    
    const heroProject = showShowreel ? null : featuredProjects[0];
    const gridProjects = showShowreel ? featuredProjects : featuredProjects.slice(1);
    
    const featuredPost = posts[0];

    return (
        <section className={`w-full transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'}`}>
            {/* HERO SECTION */}
            <div className={`relative w-full ${THEME.hero.height} cursor-pointer group overflow-hidden bg-bg-main`}>
                {showShowreel ? (
                     <div className="w-full h-full relative">
                        <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.8 }}>
                            <VideoEmbed url={config.showreel!.videoUrl} autoplay={true} muted={THEME.hero.showreel.muted} />
                        </div>
                        <div className="absolute inset-0 z-10 bg-black/10"></div>
                        <div className={`absolute z-20 mix-blend-difference text-white ${THEME.hero.textPosition} ${THEME.hero.textAlignment} ${THEME.hero.textMaxWidth}`}>
                             <h1 className={THEME.typography.h1}>{THEME.hero.showreel.title}</h1>
                        </div>
                     </div>
                ) : heroProject ? (
                    <div onClick={() => {
                        navigate(`/work/${heroProject.slug || heroProject.id}`, { state: { from: location.pathname + location.search } });
                    }} className="w-full h-full relative">
                        <div 
                            className={`absolute inset-0 bg-black z-10 transition ${THEME.animation.medium}`}
                            style={{ opacity: THEME.hero.overlayOpacity }}
                        ></div>
                        {/* Hover Clear Overlay */}
                        <div className={`absolute inset-0 bg-black z-10 group-hover:opacity-0 transition ${THEME.animation.medium}`} style={{ opacity: THEME.hero.overlayOpacity }}></div>
                        
                        <OptimizedImage
                            recordId={heroProject.id}
                            fallbackUrl={heroProject.heroImage}
                            type="project"
                            index={0}
                            totalImages={heroProject.gallery?.length || 0}
                            alt={heroProject.title}
                            loading="eager"
                            preset={upgradePreset(getSessionPreset())}
                            skipDowngrade={true}
                            className="w-full h-full object-cover transform-gpu scale-100 group-hover:scale-[1.02] transition-transform duration-[1200ms] ease-out"
                        />
                        <div className={`absolute z-20 mix-blend-difference text-white ${THEME.hero.textPosition} ${THEME.hero.textAlignment} ${THEME.hero.textMaxWidth}`}>
                            <span className={`block ${THEME.typography.meta} mb-4 opacity-0 animate-fade-in-up`} style={{ animationDelay: '200ms' }}>Featured Work</span>
                            <h1 className={`${THEME.typography.h1} opacity-0 animate-fade-in-up`} style={{ animationDelay: '300ms' }}>
                                {heroProject.title}
                            </h1>
                        </div>
                    </div>
                ) : (
                    <div className={`absolute inset-0 flex items-center justify-center z-10`}>
                        <h1 className={`${THEME.typography.h1} text-white mix-blend-difference`}>GABRIEL ATHANASIOU</h1>
                    </div>
                )}
            </div>

            {/* FILMSTRIP SECTION */}
            <div className={`${THEME.filmography.paddingTop} ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} bg-bg-main relative z-10`}>
                <div className="flex justify-between items-end mb-16 border-b border-white/10 pb-4">
                    <span className={`${THEME.typography.meta} text-text-muted`}>Featured Work</span>
                    <span className={`${THEME.typography.meta} text-text-muted hidden md:inline-block`}>2021 — 2024</span>
                </div>

                <div className={`grid grid-cols-1 ${THEME.filmography.grid.columns} ${THEME.filmography.grid.gapX} ${THEME.filmography.grid.gapY} mb-40`}>
                    {gridProjects.map((p, i) => (
                        <div 
                            key={p.id} 
                            onClick={() => {
                                navigate(`/work/${p.slug || p.id}`, { state: { from: location.pathname + location.search } });
                            }}
                            className="group block cursor-pointer"
                            style={{ animationDelay: `${i * THEME.animation.staggerDelay}ms` }}
                        >
                            <div className={`w-full ${THEME.filmography.grid.aspectRatio} bg-[#111] overflow-hidden mb-4 relative`}>
                                <OptimizedImage
                                    recordId={p.id}
                                    fallbackUrl={p.heroImage}
                                    type="project"
                                    index={0}
                                    totalImages={p.gallery?.length || 0}
                                    alt={p.title}
                                    loading="lazy"
                                    className="w-full h-full object-cover transform-gpu scale-100 opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
                                />
                            </div>
                            <div className="flex justify-between items-baseline text-white">
                                <h2 className={`${THEME.typography.h3} opacity-90 group-hover:opacity-100 transition tracking-tight`}>{p.title}</h2>
                                <span className="text-[10px] tracking-[0.15em] uppercase text-gray-500 group-hover:text-gray-400 transition shrink-0 ml-4">{p.type === 'Uncategorized' ? '' : p.type}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* FEATURED JOURNAL */}
                {featuredPost && (
                    <div className="border-t border-white/10 pt-16 mb-40">
                        <div className="flex justify-between items-end mb-12">
                            <span className={`${THEME.typography.meta} text-text-muted`}>Featured Journal</span>
                            <button onClick={() => {
                                navigate('/journal', { state: { from: location.pathname + location.search } });
                            }} className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>All Entries</button>
                        </div>
                        <div 
                            onClick={() => {
                                navigate(`/journal/${featuredPost.slug || featuredPost.id}`, { state: { from: location.pathname + location.search } });
                            }}
                            className={`group cursor-pointer grid grid-cols-1 ${THEME.blog.grid.columns} ${THEME.blog.grid.gap} items-center`}
                        >
                            <div className="aspect-[3/2] overflow-hidden bg-gray-900">
                                {featuredPost.imageUrl && (
                                    <OptimizedImage
                                        recordId={featuredPost.id}
                                        fallbackUrl={featuredPost.imageUrl}
                                        type="journal"
                                        index={0}
                                        totalImages={1}
                                        alt={featuredPost.title}
                                        loading="lazy"
                                        className="w-full h-full object-cover transform-gpu grayscale group-hover:grayscale-0 group-hover:scale-[1.02] transition-all duration-700 ease-out"
                                    />
                                )}
                            </div>
                            <div>
                                <div className={`flex gap-4 ${THEME.typography.meta} text-text-muted mb-6 mix-blend-difference text-white`}>
                                    <span>{featuredPost.date}</span>
                                    {featuredPost.readingTime && (
                                        <>
                                            <span>—</span>
                                            <span>{featuredPost.readingTime}</span>
                                        </>
                                    )}
                                </div>
                                <h3 className={`${THEME.typography.h2} mb-6 group-hover:text-white/80 transition mix-blend-difference text-white`}>{featuredPost.title}</h3>
                                <p className="text-gray-400 font-light leading-loose text-sm line-clamp-2 mb-8">{featuredPost.content.replace(/[*_#]/g, '')}</p>
                                <span className={`${THEME.typography.meta} underline underline-offset-4 decoration-white/30 group-hover:decoration-white transition`}>Read Article</span>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="pt-16 border-t border-white/10 flex flex-col items-center">
                    <button 
                        onClick={() => {
                            navigate('/about');
                        }} 
                        className="text-xl md:text-2xl font-serif italic text-white hover:text-white/60 transition duration-500 ease-out"
                    >
                        Get in Touch
                    </button>
                </div>
            </div>
        </section>
    );
};