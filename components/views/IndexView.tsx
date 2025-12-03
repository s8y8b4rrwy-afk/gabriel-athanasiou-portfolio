
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
// import { saveScrollPosition } from '../../utils/scrollRestoration';
import { Project, ProjectType, HomeConfig } from '../../types';
import { THEME } from '../../theme';
import { getOptimizedImageUrl, getSessionPreset } from '../../utils/imageOptimization';
import { ProceduralThumbnail } from '../ProceduralThumbnail';
import { OptimizedImage } from '../common/OptimizedImage';

interface IndexViewProps { 
    projects: Project[]; 
    onHover: (image: { url: string | null; fallback: string | null }) => void;
    config?: HomeConfig;
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
export const IndexView: React.FC<IndexViewProps> = ({ projects, onHover, config }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

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

    // For post-production site (showRoleFilter=true), default to "All" for both filters
    const isPostProduction = config?.showRoleFilter === true;
    const defaultFilter = isPostProduction ? 'All' : THEME.filmography.defaultTab;
    const showRoleFilter = isPostProduction;
    
    // URL slug mappings for cleaner shareable URLs
    const roleToSlug: Record<string, string> = {
        'Colourist': 'colour',
        'Editor': 'edit',
        'Beauty Work': 'beauty',
        'VFX': 'vfx',
        'Sound Design': 'sound',
        'Motion Graphics': 'motion',
    };
    
    const slugToRole: Record<string, string> = {
        'colour': 'Colourist',
        'edit': 'Editor',
        'beauty': 'Beauty Work',
        'vfx': 'VFX',
        'sound': 'Sound Design',
        'motion': 'Motion Graphics',
    };
    
    const typeToSlug: Record<string, string> = {
        'Narrative': 'narrative',
        'Commercial': 'commercial',
        'Music Video': 'music',
        'Documentary': 'documentary',
    };
    
    const slugToType: Record<string, string> = {
        'narrative': 'Narrative',
        'commercial': 'Commercial',
        'music': 'Music Video',
        'documentary': 'Documentary',
    };
    
    // URL params take priority > session storage > defaults
    // This allows shareable filter links
    const getInitialFilter = () => {
        const urlType = searchParams.get('type');
        if (urlType) {
            // Convert slug to internal type name
            return slugToType[urlType.toLowerCase()] || urlType;
        }
        return sessionStorage.getItem('filmographyFilter') || defaultFilter;
    };
    
    const getInitialRoleFilter = () => {
        const urlRole = searchParams.get('role');
        if (urlRole) {
            // Convert slug to internal role name
            return slugToRole[urlRole.toLowerCase()] || urlRole;
        }
        return sessionStorage.getItem('filmographyRoleFilter') || 'All';
    };
    
    const [filter, setFilter] = useState<string>(getInitialFilter);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (sessionStorage.getItem('filmographyView') as 'list' | 'grid') || 'grid');
    const [roleFilter, setRoleFilter] = useState<string>(getInitialRoleFilter);
    const [searchQuery, setSearchQuery] = useState<string>(() => sessionStorage.getItem('filmographySearch') || '');
    
    // Update URL when filters change (for shareable links)
    // Use window.history directly to avoid React Router re-renders
    useEffect(() => {
        const newParams = new URLSearchParams();
        
        // Only add params if they're not the default "All"
        // Use slugs for cleaner URLs
        if (filter !== 'All') {
            const slug = typeToSlug[filter] || filter.toLowerCase();
            newParams.set('type', slug);
        }
        if (showRoleFilter && roleFilter !== 'All') {
            const slug = roleToSlug[roleFilter] || roleFilter.toLowerCase();
            newParams.set('role', slug);
        }
        
        // Update URL using window.history to avoid React Router navigation
        const newSearch = newParams.toString();
        const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
        window.history.replaceState(null, '', newUrl);
    }, [filter, roleFilter, showRoleFilter]);
    
    // Sorting state for table columns (Excel-like: null → asc → desc → null)
    type SortColumn = 'year' | 'title' | 'client' | 'genre' | 'type' | null;
    type SortDirection = 'asc' | 'desc' | null;
    const [sortColumn, setSortColumn] = useState<SortColumn>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    
    const handleSort = (column: SortColumn) => {
        if (sortColumn !== column) {
            // New column: start with ascending
            setSortColumn(column);
            setSortDirection('asc');
        } else if (sortDirection === 'asc') {
            // Same column, was asc: go to desc
            setSortDirection('desc');
        } else if (sortDirection === 'desc') {
            // Same column, was desc: clear sort
            setSortColumn(null);
            setSortDirection(null);
        }
    };
    
    const SortIndicator: React.FC<{ column: SortColumn }> = ({ column }) => {
        if (sortColumn !== column) {
            return <span className="ml-1 opacity-0 group-hover:opacity-30 transition-opacity">↕</span>;
        }
        return (
            <span className="ml-1 opacity-100">
                {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
        );
    };
    
    // Display labels for roles (role name → display label)
    const roleDisplayLabels: Record<string, string> = {
        'All': 'All',
        'Colourist': 'Colour Grading',
        'Editor': 'Editing',
        'Beauty Work': 'Beauty & VFX',
        'VFX': 'Visual Effects',
        'Sound Design': 'Sound Design',
        'Motion Graphics': 'Motion Graphics',
    };
    
    const getRoleDisplayLabel = (role: string) => roleDisplayLabels[role] || role;

    // Adaptive stagger state
    const [staggerDelay, setStaggerDelay] = useState<number>(THEME.animation.staggerDelay || 60);

    useEffect(() => {
        sessionStorage.setItem('filmographyFilter', filter);
    }, [filter]);
    
    useEffect(() => {
        sessionStorage.setItem('filmographyRoleFilter', roleFilter);
    }, [roleFilter]);
    
    useEffect(() => {
        sessionStorage.setItem('filmographySearch', searchQuery);
    }, [searchQuery]);
    
    // Get available roles from projects (for role filter)
    // Only include roles where the portfolio owner actually did the work
    const portfolioOwnerName = config?.portfolioOwnerName || '';
    const availableRoles = useMemo(() => {
        if (!showRoleFilter) return [];
        const rolesSet = new Set<string>();
        projects.forEach(p => {
            // Credits contain role/name pairs - extract unique roles that match allowedRoles
            // AND where the portfolio owner is credited
            const allowedRoles = config?.allowedRoles || [];
            p.credits?.forEach(credit => {
                if (allowedRoles.includes(credit.role) && credit.name === portfolioOwnerName) {
                    rolesSet.add(credit.role);
                }
            });
        });
        return ['All', ...Array.from(rolesSet).sort()];
    }, [projects, showRoleFilter, config?.allowedRoles, portfolioOwnerName]);

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

    // Filter projects by type first
    const typeFilteredProjects = filter === ProjectType.ALL 
        ? projects 
        : projects.filter(p => p.type === filter);
    
    // Then filter by role if role filter is active and set, then apply sorting
    const displayProjects = useMemo(() => {
        let filtered = typeFilteredProjects;
        
        // Apply role filter - only show projects where the portfolio owner did this role
        if (showRoleFilter && roleFilter !== 'All') {
            filtered = filtered.filter(p => 
                p.credits?.some(credit => credit.role === roleFilter && credit.name === portfolioOwnerName)
            );
        }
        
        // Apply search filter - search across multiple fields
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p => {
                // Search in title
                if (p.title?.toLowerCase().includes(query)) return true;
                // Search in client
                if (p.client?.toLowerCase().includes(query)) return true;
                // Search in production company
                if (p.productionCompany?.toLowerCase().includes(query)) return true;
                // Search in type (Narrative, Commercial, etc.)
                if (p.type?.toLowerCase().includes(query)) return true;
                // Search in kinds (TVC, Short Film, etc.)
                if (p.kinds?.some(k => k.toLowerCase().includes(query))) return true;
                // Search in genre
                if (p.genre?.some(g => g.toLowerCase().includes(query))) return true;
                // Search in keywords
                if (p.keywords?.some(k => k.toLowerCase().includes(query))) return true;
                // Search in credits (role names and people names)
                if (p.credits?.some(c => 
                    c.role?.toLowerCase().includes(query) || 
                    c.name?.toLowerCase().includes(query)
                )) return true;
                // Search in year
                if (p.year?.toLowerCase().includes(query)) return true;
                // Search in director
                if (p.director?.toLowerCase().includes(query)) return true;
                return false;
            });
        }
        
        // Apply sorting - default to year descending (newest first) when no column selected
        const effectiveSortColumn = sortColumn || 'year';
        const effectiveSortDirection = sortDirection || 'desc';
        
        filtered = [...filtered].sort((a, b) => {
            let aVal: string | undefined;
            let bVal: string | undefined;
            
            switch (effectiveSortColumn) {
                case 'year':
                    // Use workDate for precise sorting, fallback to releaseDate, then year
                    aVal = a.workDate || a.releaseDate || a.year || '';
                    bVal = b.workDate || b.releaseDate || b.year || '';
                    break;
                case 'title':
                    aVal = a.title?.toLowerCase() || '';
                    bVal = b.title?.toLowerCase() || '';
                    break;
                case 'client':
                    // Sort by the field that matches the current filter's column header
                    // Commercial/Documentary/Music Video show client, others show productionCompany
                    const aIsClientType = a.type === 'Commercial' || a.type === 'Documentary' || a.type === 'Music Video';
                    const bIsClientType = b.type === 'Commercial' || b.type === 'Documentary' || b.type === 'Music Video';
                    
                    aVal = (aIsClientType ? (a.client || '') : (a.productionCompany || '')).toLowerCase();
                    bVal = (bIsClientType ? (b.client || '') : (b.productionCompany || '')).toLowerCase();
                    break;
                case 'genre':
                    aVal = (a.genre && a.genre.length > 0 ? a.genre[0] : '').toLowerCase();
                    bVal = (b.genre && b.genre.length > 0 ? b.genre[0] : '').toLowerCase();
                    break;
                case 'type':
                    aVal = (a.kinds && a.kinds.length > 0 ? a.kinds.join(' / ') : '').toLowerCase();
                    bVal = (b.kinds && b.kinds.length > 0 ? b.kinds.join(' / ') : '').toLowerCase();
                    break;
                default:
                    return 0;
            }
            
            // Handle empty values - push them to the end
            if (!aVal && bVal) return effectiveSortDirection === 'asc' ? 1 : -1;
            if (aVal && !bVal) return effectiveSortDirection === 'asc' ? -1 : 1;
            if (!aVal && !bVal) return 0;
            
            const comparison = aVal.localeCompare(bVal);
            return effectiveSortDirection === 'asc' ? comparison : -comparison;
        });
        
        return filtered;
    }, [typeFilteredProjects, showRoleFilter, roleFilter, sortColumn, sortDirection, searchQuery, portfolioOwnerName]);

    const cols = THEME.filmography.list.cols;
    const showCols = THEME.filmography.list;

    return (
        <section className={`pt-32 md:pt-28 ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} min-h-screen transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'}`}>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col gap-4 md:gap-6 mb-12 md:mb-20 overflow-visible">
                    {/* Role Filter (Post-Production Only) - Above Category Filter */}
                    {showRoleFilter && availableRoles.length > 1 && (
                        <>
                            <div className="relative flex-1 w-full md:w-auto overflow-visible">
                                <div className={`flex gap-4 md:gap-8 text-[10px] md:text-[11px] uppercase tracking-[0.15em] md:tracking-[0.2em] text-white overflow-x-auto pb-3 md:pb-4 no-scrollbar relative z-10 pr-12 justify-center md:justify-start`}>
                                    {availableRoles.map((role) => (
                                        <button 
                                            key={role}
                                            onClick={() => setRoleFilter(role)}
                                            className={`transition-all ${THEME.animation.fast} whitespace-nowrap ${
                                                roleFilter === role 
                                                    ? 'opacity-100 border-b border-white pb-1' 
                                                    : 'opacity-60 hover:opacity-100'
                                            }`}
                                        >
                                            {getRoleDisplayLabel(role)}
                                        </button>
                                    ))}
                                </div>
                                <div className="absolute right-0 top-0 bottom-3 md:bottom-4 w-12 md:w-16 bg-gradient-to-l from-bg-main to-transparent pointer-events-none z-20"></div>
                            </div>
                            {/* Separator line between role and type filters */}
                            <div className="w-full h-px bg-white/10 filter-separator"></div>
                        </>
                    )}

                    {/* Filters Row */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-8 overflow-visible">
                        {/* Category Filter */}
                        <div className="relative flex-1 w-full md:w-auto flex items-center justify-center md:justify-start overflow-visible">
                            <div className={`flex gap-4 md:gap-8 text-[10px] md:text-[11px] uppercase tracking-[0.15em] md:tracking-[0.2em] text-white overflow-x-auto no-scrollbar relative z-10 pr-12`}>
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
                        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-16 bg-gradient-to-l from-bg-main to-transparent pointer-events-none z-20"></div>
                    </div>

                        {/* View Toggle + Search Container - side by side */}
                        <div className="flex flex-row gap-3 sm:gap-4 md:gap-6 items-center justify-center md:justify-end shrink-0 w-auto py-2">
                        {/* Search Input - Pill style matching View Toggle */}
                        <div className="relative flex items-center border border-white/20 rounded-full px-3 md:px-4 py-1.5 md:py-2 bg-white/5 backdrop-blur-sm">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchQuery(value);
                                    // Reset filters to "All" when searching
                                    if (value.trim()) {
                                        setFilter('All');
                                        if (showRoleFilter) setRoleFilter('All');
                                    }
                                }}
                                placeholder="Search All"
                                className={`bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[8px] md:text-[9px] uppercase tracking-[0.15em] md:tracking-[0.2em] text-white placeholder:text-text-muted placeholder:opacity-60 transition-all duration-300 ${
                                    searchQuery ? 'w-28 md:w-36 lg:w-40 xl:w-44' : 'w-20 md:w-24 lg:w-28 xl:w-32'
                                }`}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="ml-1 md:ml-2 text-text-muted opacity-60 hover:opacity-100 hover:text-white transition-all outline-none focus:outline-none"
                                >
                                    <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        
                        {/* View Toggle */}
                        <div className="flex gap-3 md:gap-4 items-center border border-white/20 rounded-full px-3 md:px-4 py-1.5 md:py-2 bg-white/5 backdrop-blur-sm shrink-0">
                             <button 
                                onClick={() => setViewMode('grid')}
                                className={`text-[8px] md:text-[9px] uppercase tracking-[0.15em] md:tracking-[0.2em] transition-opacity outline-none focus:outline-none ${THEME.animation.fast} ${viewMode === 'grid' ? 'opacity-100 text-white' : 'opacity-60 text-text-muted hover:opacity-100'}`}
                             >
                                Filmstrip
                             </button>
                             <div className="w-[1px] h-2.5 md:h-3 bg-white/20"></div>
                             <button 
                                onClick={() => setViewMode('list')}
                                className={`text-[8px] md:text-[9px] uppercase tracking-[0.15em] md:tracking-[0.2em] transition-opacity outline-none focus:outline-none ${THEME.animation.fast} ${viewMode === 'list' ? 'opacity-100 text-white' : 'opacity-60 text-text-muted hover:opacity-100'}`}
                             >
                                List
                             </button>
                        </div>
                    </div>
                </div>
                </div>

                {viewMode === 'list' ? (
                    // TABLE VIEW
                    <>
                        {/* Desktop Headers */}
                        <div className={`hidden md:grid grid-cols-12 border-b border-white/20 pb-4 ${THEME.typography.meta} text-text-muted mb-2`}>
                            {showCols.showYear && (
                                <button 
                                    className={`${cols.year} group flex items-center cursor-pointer hover:text-white transition-colors text-left`}
                                    onClick={() => handleSort('year')}
                                >
                                    Year<SortIndicator column="year" />
                                </button>
                            )}
                            <button 
                                className={`${cols.title} group flex items-center cursor-pointer hover:text-white transition-colors text-left`}
                                onClick={() => handleSort('title')}
                            >
                                Project<SortIndicator column="title" />
                            </button>
                            {showCols.showClient && (
                                <button 
                                    className={`${cols.client} group flex items-center cursor-pointer hover:text-white transition-colors text-left`}
                                    onClick={() => handleSort('client')}
                                >
                                    {filter === 'Commercial' || filter === 'Documentary' ? 'Client' : filter === 'Music Video' ? 'Artist' : 'Production Company'}<SortIndicator column="client" />
                                </button>
                            )}
                            {showCols.showGenre && (
                                <button 
                                    className={`${cols.genre} group flex items-center cursor-pointer hover:text-white transition-colors text-left`}
                                    onClick={() => handleSort('genre')}
                                >
                                    Genre<SortIndicator column="genre" />
                                </button>
                            )}
                            {showCols.showType && (
                                <button 
                                    className={`${cols.type} group flex items-center justify-end cursor-pointer hover:text-white transition-colors text-right`}
                                    onClick={() => handleSort('type')}
                                >
                                    Type<SortIndicator column="type" />
                                </button>
                            )}
                        </div>

                        {/* Mobile Headers */}
                         <div className={`md:hidden grid grid-cols-12 border-b border-white/20 pb-4 ${THEME.typography.meta} text-text-muted mb-2`}>
                            {(showCols.showThumbnailMobile || showCols.showYear) && <div className={cols.image}></div>}
                            <button 
                                className={`${cols.title} group flex items-center cursor-pointer hover:text-white transition-colors text-left`}
                                onClick={() => handleSort('title')}
                            >
                                Project<SortIndicator column="title" />
                            </button>
                            <button 
                                className={`${cols.type} group flex items-center justify-end cursor-pointer hover:text-white transition-colors text-right`}
                                onClick={() => handleSort('type')}
                            >
                                Type<SortIndicator column="type" />
                            </button>
                        </div>

                        <div>
                            {displayProjects.map((p, i) => (
                                <div 
                                    key={p.id}
                                    onClick={() => {
                                        navigate(`/work/${p.slug || p.id}`, { state: { from: location.pathname + location.search } });
                                    }}
                                    onMouseEnter={() => {
                                        if (p.videoUrl) {
                                            const imageUrls = getOptimizedImageUrl(p.id, p.heroImage, 'project', 0, 1, getSessionPreset());
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
                                    <div className={`${cols.title} flex flex-col justify-center text-white pr-4 md:pr-8`}>
                                        <span className={`${THEME.filmography.list.projectTitleSize} font-serif italic font-normal md:group-hover:translate-x-4 transition-transform ${THEME.animation.medium} ${THEME.animation.ease} opacity-60 group-hover:opacity-100 block leading-snug`}>
                                            {p.title}
                                        </span>
                                        <span className="md:hidden text-[9px] text-text-muted font-mono mt-1 opacity-60">{p.year}</span>
                                    </div>
                                    {/* ...existing code... */}
                                    {showCols.showClient && (
                                        <div className={`hidden md:block ${cols.client} text-[11px] font-normal text-white opacity-40 group-hover:opacity-80 transition uppercase tracking-wider`}>
                                            {(filter === 'Commercial' || filter === 'Documentary') 
                                                ? (p.client || p.productionCompany || '–')
                                                : filter === 'Music Video'
                                                ? (p.client || p.productionCompany || '–')
                                                : (p.productionCompany || '–')
                                            }
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
                                            {p.kinds && p.kinds.length > 0 ? p.kinds.join(' / ') : '-'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    // FILMSTRIP VIEW
                    <div className={`grid grid-cols-1 ${THEME.filmography.grid.columns} ${THEME.filmography.grid.gapX} ${THEME.filmography.grid.gapY} px-2`}>
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
                                <div className="flex justify-between items-baseline text-white">
                                    <div>
                                        <h2 className={`${THEME.typography.h3} opacity-90 group-hover:opacity-100 transition mb-1.5 tracking-tight`}>{p.title}</h2>
                                        <div className="text-[10px] tracking-[0.15em] uppercase text-gray-500 group-hover:text-gray-400 transition">
                                            {p.client ? p.client : p.productionCompany}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-4">
                                        {THEME.filmography.grid.showYear ? (
                                             <span className="block text-[10px] tracking-[0.15em] uppercase text-gray-500 group-hover:text-gray-400 transition">{p.year}</span>
                                        ) : (
                                             <span className="block text-[10px] tracking-[0.15em] uppercase text-gray-500 group-hover:text-gray-400 transition">{p.type === 'Uncategorized' ? '' : p.type}</span>
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