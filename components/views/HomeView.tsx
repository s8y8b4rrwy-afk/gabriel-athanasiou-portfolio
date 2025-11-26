
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, BlogPost, HomeConfig } from '../../types';
import { VideoEmbed } from '../VideoEmbed';
import { THEME } from '../../theme';
import { getOptimizedImageUrl } from '../../utils/imageOptimization';

interface HomeViewProps { 
    projects: Project[]; 
    posts: BlogPost[];
    config: HomeConfig;
}

export const HomeView: React.FC<HomeViewProps> = ({ projects, posts, config }) => {
    const navigate = useNavigate();

    const showShowreel = config.showreel?.enabled && config.showreel.videoUrl;
    const featuredProjects = projects.filter(p => p.isFeatured);
    
    const heroProject = showShowreel ? null : featuredProjects[0];
    const gridProjects = showShowreel ? featuredProjects : featuredProjects.slice(1);
    
    const featuredPost = posts[0];

    return (
        <section className="animate-view-enter w-full">
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
                    <div onClick={() => navigate(`/work/${heroProject.slug || heroProject.id}`)} className="w-full h-full relative">
                        <div 
                            className={`absolute inset-0 bg-black z-10 transition ${THEME.animation.medium}`}
                            style={{ opacity: THEME.hero.overlayOpacity }}
                        ></div>
                        {/* Hover Clear Overlay */}
                        <div className={`absolute inset-0 bg-black z-10 group-hover:opacity-0 transition ${THEME.animation.medium}`} style={{ opacity: THEME.hero.overlayOpacity }}></div>
                        
                        <img 
                            src={getOptimizedImageUrl(heroProject.id, heroProject.heroImage, 'project', 0)}
                            onError={(e) => { e.currentTarget.src = heroProject.heroImage; }}
                            alt={heroProject.title}
                            className={`w-full h-full object-cover transform scale-[1.01] group-hover:scale-[1.03] transition ${THEME.animation.superSlow} ${THEME.animation.ease} will-change-transform`}
                        />
                        <div className={`absolute z-20 mix-blend-difference text-white ${THEME.hero.textPosition} ${THEME.hero.textAlignment} ${THEME.hero.textMaxWidth}`}>
                            <span className={`block ${THEME.typography.meta} mb-4 opacity-0 animate-fade-in-up`} style={{ animationDelay: '200ms' }}>Featured Work</span>
                            <h1 className={`${THEME.typography.h1} opacity-0 animate-fade-in-up`} style={{ animationDelay: '300ms' }}>
                                {heroProject.title}
                            </h1>
                        </div>
                    </div>
                ) : null}
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
                            onClick={() => navigate(`/work/${p.slug || p.id}`)}
                            className="group block cursor-pointer animate-fade-in-up"
                            style={{ animationDelay: `${i * THEME.animation.staggerDelay}ms` }}
                        >
                            <div className={`w-full ${THEME.filmography.grid.aspectRatio} bg-[#111] overflow-hidden mb-6 relative`}>
                                <img 
                                    src={getOptimizedImageUrl(p.id, p.heroImage, 'project', 0)}
                                    onError={(e) => { e.currentTarget.src = p.heroImage; }}
                                    alt={p.title}
                                    loading="lazy"
                                    className={`w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:${THEME.filmography.grid.hoverScale} transition ${THEME.animation.slow} ${THEME.animation.ease} will-change-transform`} 
                                />
                            </div>
                            <div className="flex justify-between items-baseline pt-2 mix-blend-difference text-white">
                                <h2 className={`${THEME.typography.h3} opacity-90 group-hover:opacity-100 transition`}>{p.title}</h2>
                                <span className={`${THEME.typography.meta} opacity-60 group-hover:opacity-100 transition`}>{p.type}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* FEATURED JOURNAL */}
                {featuredPost && (
                    <div className="border-t border-white/10 pt-16 mb-40">
                        <div className="flex justify-between items-end mb-12">
                            <span className={`${THEME.typography.meta} text-text-muted`}>Featured Journal</span>
                            <button onClick={() => navigate('/journal')} className={`${THEME.typography.meta} text-text-muted hover:text-white transition`}>All Entries</button>
                        </div>
                        <div 
                            onClick={() => navigate(`/journal/${featuredPost.slug || featuredPost.id}`)}
                            className={`group cursor-pointer grid grid-cols-1 ${THEME.blog.grid.columns} ${THEME.blog.grid.gap} items-center`}
                        >
                            <div className="aspect-[3/2] overflow-hidden bg-gray-900">
                                {featuredPost.imageUrl && (
                                    <img 
                                        src={getOptimizedImageUrl(featuredPost.id, featuredPost.imageUrl, 'journal', 0)}
                                        onError={(e) => { e.currentTarget.src = featuredPost.imageUrl; }}
                                        loading="lazy" 
                                        className={`w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:${THEME.filmography.grid.hoverScale} transition ${THEME.animation.slow} ${THEME.animation.ease}`} 
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
                
                <div className="pt-12 border-t border-white/10 flex flex-col items-center">
                    <button 
                        onClick={() => navigate('/about')} 
                        className={`${THEME.typography.h2} hover:text-text-muted transition duration-500 ${THEME.animation.ease} mix-blend-difference text-white`}
                    >
                        About & Contact
                    </button>
                </div>
            </div>
        </section>
    );
};