/**
 * TradingCard - Pokémon-inspired Trading Card Component for the Game
 * 
 * A visually rich card component that displays a mystery project image with
 * hidden details that reveal upon answer. Features 3D tilt effect on hover
 * and holographic shimmer animation.
 * 
 * @module components/TradingCard
 * 
 * ## Features
 * - 3D perspective tilt effect following mouse position
 * - Holographic shimmer overlay on reveal
 * - Blurred skeleton placeholder for hidden details
 * - Smooth reveal animation with fade and slide
 * - Green glow effect for correct answers
 * - Loading state with shuffle animation
 * - Responsive sizing (mobile to desktop)
 * - "Learn More" link opens project in new tab
 * 
 * ## Layout
 * - 60% height: Project image
 * - 40% height: Details section (title, genre, year, description)
 * - 3:4 aspect ratio maintained across all sizes
 * 
 * @see GameView.tsx for usage context
 * @see GlobalStyles.tsx for animation keyframes
 */

import React, { useState, useRef } from 'react';
import { Project } from '../types';

/**
 * Props for the TradingCard component
 */
interface TradingCardProps {
    /** Project data to display (null during shuffle) */
    project: Project | null;
    /** URL of the mystery image to display */
    imageUrl: string;
    /** Whether the card details should be revealed */
    revealed: boolean;
    /** Whether the shuffle animation is playing */
    isShuffling: boolean;
    /** Whether the user's answer was correct (for green glow effect) */
    isCorrect?: boolean;
    /** Click handler (active only when revealed) */
    onClick?: () => void;
}

/**
 * TradingCard Component
 * 
 * @param props - Component props
 * @returns React component
 * 
 * @example
 * ```tsx
 * <TradingCard
 *     project={currentProject}
 *     imageUrl={currentImageUrl}
 *     revealed={gameState === 'revealed'}
 *     isShuffling={gameState === 'shuffling'}
 *     isCorrect={selectedAnswer === currentProject?.id}
 *     onClick={handleCardClick}
 * />
 * ```
 */
export const TradingCard: React.FC<TradingCardProps> = ({
    project,
    imageUrl,
    revealed,
    isShuffling,
    isCorrect,
    onClick
}) => {
    // ========================================================================
    // 3D Tilt Effect State
    // ========================================================================
    
    /** Ref to the card element for position calculations */
    const cardRef = useRef<HTMLDivElement>(null);
    
    /** Current 3D rotation transform values */
    const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 });
    
    /** Whether the mouse is currently over the card */
    const [isHovering, setIsHovering] = useState(false);

    // ========================================================================
    // Event Handlers
    // ========================================================================

    /**
     * Calculate and apply 3D tilt based on mouse position
     * Max rotation is 15 degrees in any direction
     */
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        
        const rect = cardRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Calculate rotation based on mouse position relative to card center
        // Max rotation of 15 degrees
        const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 15;
        const rotateX = ((centerY - e.clientY) / (rect.height / 2)) * 15;
        
        setTransform({ rotateX, rotateY });
    };

    /** Start hover state for scaling effect */
    const handleMouseEnter = () => {
        setIsHovering(true);
    };

    /** Reset transform and hover state when mouse leaves */
    const handleMouseLeave = () => {
        setIsHovering(false);
        setTransform({ rotateX: 0, rotateY: 0 });
    };

    // ========================================================================
    // Computed Values
    // ========================================================================

    /** Show loading/shuffle state when no project data or actively shuffling */
    const showLoadingState = !project || isShuffling;

    /** Format genre array as bullet-separated string (unused but available) */
    const genreDisplay = project?.genre?.join(' • ') || project?.type || '';

    /** Truncate description to fit card (max 100 chars) */
    const truncatedDescription = project?.description
        ? project.description.length > 100
            ? project.description.substring(0, 100) + '...'
            : project.description
        : '';

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div 
            className="perspective-1000"
            style={{ perspective: '1000px' }}
        >
            <div
                ref={cardRef}
                className={`
                    trading-card relative w-full aspect-[3/4] rounded-xl overflow-hidden
                    bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
                    border border-white/20 shadow-2xl
                    ${showLoadingState ? 'animate-card-shuffle' : ''}
                    ${revealed ? 'cursor-pointer' : ''}
                    ${revealed && isCorrect ? 'ring-2 ring-green-500/50 shadow-green-500/20' : ''}
                `}
                style={{
                    transform: `rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) ${isHovering ? 'scale(1.02)' : 'scale(1)'}`,
                    transition: isHovering ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out',
                    transformStyle: 'preserve-3d',
                }}
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={revealed ? onClick : undefined}
            >
            {/* Holographic shimmer overlay */}
            {revealed && (
                <div className="absolute inset-0 z-20 pointer-events-none animate-holo-shimmer opacity-30" />
            )}

            {/* Image Section */}
            <div className="relative h-[60%] overflow-hidden">
                {showLoadingState ? (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 animate-pulse flex items-center justify-center">
                        <div className="w-16 h-16 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    </div>
                ) : (
                    // Use img directly with the imageUrl to bypass OptimizedImage's index-based URL building
                    // The imageUrl already contains the correct Cloudinary URL for the specific gallery image
                    <img
                        src={imageUrl || project?.heroImage || ''}
                        alt={`Mystery project image`}
                        loading="eager"
                        className="w-full h-full object-cover"
                    />
                )}
                
                {/* Subtle gradient only at bottom to blend into details section */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900/80 to-transparent" />
            </div>

            {/* Details Section */}
            <div className="relative h-[40%] p-2 sm:p-3 md:p-4 flex flex-col justify-between">
                {showLoadingState ? (
                    // Loading state
                    <div className="space-y-2 sm:space-y-3">
                        <div className="h-5 sm:h-6 bg-white/10 rounded animate-pulse w-3/4" />
                        <div className="h-3 sm:h-4 bg-white/10 rounded animate-pulse w-1/2" />
                        <div className="h-10 sm:h-12 bg-white/10 rounded animate-pulse w-full" />
                    </div>
                ) : (
                    <>
                        {/* Blur overlay with skeleton placeholders when not revealed */}
                        <div 
                            className={`
                                absolute inset-0 bg-gray-900/80 backdrop-blur-lg p-2 sm:p-3 md:p-4
                                transition-all duration-700 ease-out flex flex-col justify-between
                                ${revealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                            `}
                        >
                            {/* Skeleton title */}
                            <div className="space-y-2 sm:space-y-3">
                                <div className="h-4 sm:h-5 bg-white/10 rounded w-3/4 animate-pulse" />
                                <div className="h-2.5 sm:h-3 bg-white/10 rounded w-1/2 animate-pulse" />
                                <div className="space-y-1.5 sm:space-y-2 mt-2 sm:mt-3">
                                    <div className="h-2.5 sm:h-3 bg-white/10 rounded w-full animate-pulse" />
                                    <div className="h-2.5 sm:h-3 bg-white/10 rounded w-5/6 animate-pulse" />
                                </div>
                            </div>
                            {/* Skeleton Learn More - aligned right */}
                            <div className="pt-1 sm:pt-2 border-t border-white/10 flex justify-end">
                                <div className="h-2.5 sm:h-3 bg-white/10 rounded w-16 sm:w-20 animate-pulse" />
                            </div>
                        </div>

                        {/* Actual content */}
                        <div className={`
                            transition-all duration-500 delay-200
                            ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                        `}>
                            <h3 className="text-sm sm:text-base md:text-lg font-serif italic text-white mb-0.5 sm:mb-1 line-clamp-1">
                                {project?.title}
                            </h3>
                            <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mb-1">
                                {project?.kinds?.join(' / ') || project?.type || ''} {(project?.kinds?.length || project?.type) && project?.year ? '•' : ''} {project?.year}
                            </p>
                            <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 leading-relaxed line-clamp-2">
                                {truncatedDescription}
                            </p>
                        </div>

                        {/* Learn More link - aligned right */}
                        <div className={`
                            mt-auto pt-1 border-t border-white/10 flex justify-end
                            transition-all duration-500 delay-300
                            ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                        `}>
                            <span className="text-[9px] sm:text-[10px] md:text-xs text-white/60 hover:text-white transition-colors flex items-center gap-0.5 sm:gap-1">
                                Learn More
                                <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </span>
                        </div>
                    </>
                )}
            </div>
            </div>
        </div>
    );
};
