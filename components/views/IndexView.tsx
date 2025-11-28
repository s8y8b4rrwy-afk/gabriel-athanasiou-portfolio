
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { saveScrollPosition } from '../../utils/scrollRestoration';
import { Project, ProjectType } from '../../types';
import { THEME } from '../../theme';
import { getOptimizedImageUrl } from '../../utils/imageOptimization';
import { ProceduralThumbnail } from '../ProceduralThumbnail';
import { OptimizedImage } from '../common/OptimizedImage';

interface IndexViewProps { 
    projects: Project[]; 
    onHover: (image: { url: string | null; fallback: string | null }) => void;
}

/**
 * ⚠️ HOVER ANIMATIONS: All thumbnail hover effects use:
 *   - transform-gpu (hardware acceleration)
 *   - transition-all duration-700 ease-out (smooth, consistent timing)
 *   - scale-100 group-hover:scale-[1.02] (subtle zoom)
 *   - opacity-80/90 group-hover:opacity-100 (brightness lift)
 * 
 * DO NOT use will-change-transform or long durations (2000ms+) as they cause jitter.
 */
export const IndexView: React.FC<IndexViewProps> = ({ projects, onHover }) => {
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

    // Session Storage Persistence
    const [filter, setFilter] = useState<string>(() => sessionStorage.getItem('filmographyFilter') || THEME.filmography.defaultTab);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (sessionStorage.getItem('filmographyView') as 'list' | 'grid') || 'grid');

    // Adaptive stagger state
    const [staggerDelay, setStaggerDelay] = useState<number>(THEME.animation.staggerDelay || 60);

    useEffect(() => {
        sessionStorage.setItem('filmographyFilter', filter);
    }, [filter]);

    useEffect(() => {
        sessionStorage.setItem('filmographyView', viewMode);
    }, [viewMode]);

    // Listen for scroll and adjust stagger
    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY || window.pageYOffset;
            // If scrolled past 800px, reduce stagger to 10ms
            if (scrollY > 800) {
                setStaggerDelay(10);
            } else {
                setStaggerDelay(THEME.animation.staggerDelay || 60);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Tab Visibility Logic
    const availableTypes = Object.values(ProjectType).filter(type => {
        if (!THEME.filmography.hideEmptyTabs) return true;
        if (type === ProjectType.ALL) return true;
        return projects.some(p => p.type === type);
    });

    const displayProjects = filter === ProjectType.ALL 
        ? projects 
        : projects.filter(p => p.type === filter);

    const cols = THEME.filmography.list.cols;
    const showCols = THEME.filmography.list;

    return (
        <section className={`${THEME.filmography.paddingTop} ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} min-h-screen transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'}`}>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center md:items-center mb-20 gap-8">
                    {/* Category Filter */}
                    <div className="relative flex-1 w-full md:w-auto">
                        <div className={`flex gap-8 ${THEME.typography.meta} text-white overflow-x-auto pb-4 no-scrollbar relative z-10 pr-12 justify-center md:justify-start`}>
                            {availableTypes.map((type) => (
                                <button 
                                    key={type}
                                    onClick={() => setFilter(type)} 
                                    className={`transition-all ${THEME.animation.fast} whitespace-nowrap ${filter === type ? 'opacity-100 border-b border-white pb-1' : 'opacity-60 hover:opacity-100'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-bg-main to-transparent pointer-events-none z-20 md:hidden"></div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-4 items-center shrink-0 border border-white/10 rounded-full px-4 py-2 bg-white/5 backdrop-blur-sm mx-auto md:mx-0">
                         <button 
                            onClick={() => setViewMode('grid')}
                            className={`text-[9px] uppercase tracking-[0.2em] transition-opacity ${THEME.animation.fast} ${viewMode === 'grid' ? 'opacity-100 text-white' : 'opacity-60 text-text-muted hover:opacity-100'}`}
                         >
                            Filmstrip
                         </button>
                         <div className="w-[1px] h-3 bg-white/20"></div>
                         <button 
                            onClick={() => setViewMode('list')}
                            className={`text-[9px] uppercase tracking-[0.2em] transition-opacity ${THEME.animation.fast} ${viewMode === 'list' ? 'opacity-100 text-white' : 'opacity-60 text-text-muted hover:opacity-100'}`}
                         >
                            List
                         </button>
                    </div>
                </div>

                {viewMode === 'list' ? (
                    // TABLE VIEW
                    <>
                        {/* Desktop Headers */}
                        <div className={`hidden md:grid grid-cols-12 border-b border-white/20 pb-4 ${THEME.typography.meta} text-text-muted mb-2 animate-fade-in-up`}>
                            {showCols.showYear && <div className={cols.year}>Year</div>}
                            <div className={cols.title}>Project</div>
                            {showCols.showClient && <div className={cols.client}>Client</div>}
                            {showCols.showGenre && <div className={cols.genre}>Genre</div>}
                            {showCols.showType && <div className={`${cols.type} text-right`}>Type</div>}
                        </div>

                        {/* Mobile Headers */}
                         <div className={`md:hidden grid grid-cols-12 border-b border-white/20 pb-4 ${THEME.typography.meta} text-text-muted mb-2 animate-fade-in-up`}>
                            {(showCols.showThumbnailMobile || showCols.showYear) && <div className={cols.image}></div>}
                            <div className={cols.title}>Project</div>
                            <div className={`${cols.type} text-right`}>Type</div>
                        </div>

                        <div key={filter}>
                            {displayProjects.map((p, i) => (
                                <div 
                                    key={p.id}
                                    onClick={() => {
                                        navigate(`/work/${p.slug || p.id}`, { state: { from: location.pathname + location.search } });
                                    }}
                                    onMouseEnter={() => {
                                        if (p.videoUrl) {
                                            const imageUrls = getOptimizedImageUrl(p.id, p.heroImage, 'project', 0);
                                            const primaryUrl = imageUrls.useCloudinary ? imageUrls.cloudinaryUrl : imageUrls.localUrl;
                                            onHover({ url: primaryUrl, fallback: p.heroImage });
                                        } else {
                                            onHover({ url: p.heroImage, fallback: null });
                                        }
                                    }}
                                    onMouseLeave={() => onHover({ url: null, fallback: null })}
                                    className={`group grid grid-cols-12 ${THEME.filmography.list.rowPadding} border-b border-white/10 items-center hover:bg-white/5 transition relative cursor-pointer gap-2 md:gap-0 animate-fade-in-up opacity-0`}
                                    style={{ animationDelay: `${i * staggerDelay}ms`, animationFillMode: 'forwards' }}
                                >
                                    {/* ...existing code... */}
                                    {(showCols.showThumbnailMobile || showCols.showYear) && (
                                        <div className={`${cols.image} text-text-muted text-[11px] font-mono flex items-center text-white`}>
                                            {/* ...existing code... */}
                                            {showCols.showThumbnailMobile && (
                                                <div className="md:hidden w-12 h-8 bg-gray-800 overflow-hidden shrink-0 mr-3">
                                                    {!p.videoUrl ? (
                                                        <ProceduralThumbnail
                                                            title={p.title}
                                                            year={p.year}
                                                            type={p.type}
                                                            width={480}
                                                            height={270}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <OptimizedImage
                                                            recordId={p.id}
                                                            fallbackUrl={p.heroImage}
                                                            type="project"
                                                            index={0}
                                                            totalImages={p.gallery?.length || 0}
                                                            alt="Thumbnail"
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                            width={800}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            {showCols.showYear && (
                                                <span className="hidden md:block opacity-60 group-hover:opacity-100 transition">{p.year}</span>
                                            )}
                                        </div>
                                    )}
                                    {/* ...existing code... */}
                                    <div className={`${cols.title} flex flex-col justify-center text-white`}>
                                        <span className={`${THEME.filmography.list.projectTitleSize} font-serif italic font-normal md:group-hover:translate-x-4 transition-transform ${THEME.animation.medium} ${THEME.animation.ease} opacity-60 group-hover:opacity-100 block`}>
                                            {p.title}
                                        </span>
                                        <span className="md:hidden text-[9px] text-text-muted font-mono mt-1 opacity-60">{p.year}</span>
                                    </div>
                                    {/* ...existing code... */}
                                    {showCols.showClient && (
                                        <div className={`hidden md:block ${cols.client} text-[11px] font-normal text-white opacity-40 group-hover:opacity-80 transition uppercase tracking-wider`}>
                                            {p.type === 'Narrative' ? '–' : (p.client ? p.client : p.productionCompany)}
                                        </div>
                                    )}
                                    {/* ...existing code... */}
                                    {showCols.showGenre && (
                                        <div className={`hidden md:flex ${cols.genre} flex-wrap gap-2 items-center text-white`}>
                                            {(p.type === 'Commercial' || p.type === 'Music Video') ? (
                                                <span className="text-[9px] opacity-40">–</span>
                                            ) : (
                                                p.genre && p.genre.slice(0, 2).map(g => (
                                                    <span key={g} className="text-[9px] uppercase tracking-wider opacity-40 group-hover:opacity-80 transition">{g}</span>
                                                ))
                                            )}
                                        </div>
                                    )}
                                    {/* ...existing code... */}
                                    {showCols.showType && (
                                        <div className={`${cols.type} text-right text-[9px] uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 text-white`}>
                                            {p.type === 'Uncategorized' ? '-' : p.type}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    // FILMSTRIP VIEW
                    <div className={`grid grid-cols-1 ${THEME.filmography.grid.columns} ${THEME.filmography.grid.gapX} ${THEME.filmography.grid.gapY} px-2`} key={filter}>
                        {displayProjects.map((p, i) => (
                            <div 
                                key={p.id} 
                                onClick={() => {
                                    navigate(`/work/${p.slug || p.id}`, { state: { from: location.pathname + location.search } });
                                }}
                                className="group cursor-pointer flex flex-col animate-fade-in-up opacity-0"
                                style={{ animationDelay: `${i * staggerDelay}ms`, animationFillMode: 'forwards' }}
                            >
                                {/* ...existing code... */}
                                <div className={`w-full ${THEME.filmography.grid.aspectRatio} overflow-hidden relative bg-[#111] mb-4`}>
                                    {p.videoUrl ? (
                                        <OptimizedImage
                                            recordId={p.id}
                                            fallbackUrl={p.heroImage}
                                            type="project"
                                            index={0}
                                            totalImages={p.gallery?.length || 0}
                                            alt={p.title}
                                            loading="lazy"
                                            className="w-full h-full object-cover transform-gpu scale-100 opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
                                            width={800}
                                        />
                                    ) : p.gallery && p.gallery.length > 0 ? (
                                        <OptimizedImage
                                            recordId={p.id}
                                            fallbackUrl={p.gallery[0]}
                                            type="project"
                                            index={0}
                                            totalImages={p.gallery.length}
                                            alt={p.title}
                                            loading="lazy"
                                            className="w-full h-full object-cover transform-gpu scale-100 opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
                                            width={800}
                                        />
                                    ) : (
                                        <ProceduralThumbnail
                                            title={p.title}
                                            year={p.year}
                                            type={p.type}
                                            className="w-full h-full object-cover transform-gpu scale-100 opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                                {/* ...existing code... */}
                                <div className="flex justify-between items-start text-white">
                                    <div>
                                        <h2 className={`${THEME.typography.h3} opacity-90 group-hover:opacity-100 transition mb-1 tracking-tight`}>{p.title}</h2>
                                        <div className="text-[10px] font-medium tracking-widest uppercase opacity-70">
                                            {p.client ? p.client : p.productionCompany}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {THEME.filmography.grid.showYear ? (
                                             <span className="block text-[9px] tracking-[0.2em] uppercase opacity-60 mb-1">{p.year}</span>
                                        ) : (
                                             <span className="block text-[9px] tracking-[0.2em] uppercase opacity-60 mb-1">{p.type === 'Uncategorized' ? '' : p.type}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};