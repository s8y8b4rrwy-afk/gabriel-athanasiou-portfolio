
/**
 * GameView - "Guess the Project" Interactive Trivia Game
 * 
 * An interactive trivia game where users guess which project a random still image
 * belongs to. Features a Pokémon-inspired trading card design with hidden details
 * that reveal upon answering.
 * 
 * @module components/views/GameView
 * 
 * ## Features
 * - Random image selection from project galleries
 * - Weighted project selection ensuring fair image cycling
 * - Score tracking with localStorage persistence for high scores
 * - Sound effects via Web Audio API (see utils/gameSounds.ts)
 * - Confetti animation on correct answers
 * - Trading card with 3D hover effect and holographic shimmer
 * - Responsive layout (mobile-first, side-by-side on desktop)
 * 
 * ## Game Flow
 * 1. PAGE LOAD → Filter projects with gallery images (min 3 required)
 * 2. SHUFFLING → Card shuffle animation (~1.5s)
 * 3. PLAYING → Show mystery image, 3 answer buttons (1 correct, 2 random)
 * 4. REVEALED → Show project details, update score, show Next button
 * 5. Repeat from step 2
 * 
 * ## Scoring
 * - Correct answer: +1 point
 * - Wrong answer: No penalty
 * - High score persists in localStorage
 * 
 * ## Image Cycling
 * Uses a weighted selection algorithm:
 * - Projects with more unused images are more likely to be selected
 * - Tracks used images to avoid repetition
 * - Resets used images set when all have been shown
 * 
 * @see GAME_IMPLEMENTATION_PLAN.md for detailed architecture
 * @see TradingCard.tsx for the card component
 * @see utils/gameSounds.ts for sound effects
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../../types';
import { THEME } from '../../theme';
import { TradingCard } from '../TradingCard';
import { SocialShare } from '../SocialShare';
import { gameSounds } from '../../utils/gameSounds';
import { analyticsService } from '../../services/analyticsService';

/**
 * Props for the GameView component
 */
interface GameViewProps {
    /** Array of all projects from CMS - will be filtered for those with gallery images */
    projects: Project[];
}

/**
 * Game state machine states
 * - shuffling: Card shuffle animation playing, selecting next round
 * - playing: Mystery image displayed, waiting for user answer
 * - revealed: Answer submitted, showing project details
 */
type GameState = 'shuffling' | 'playing' | 'revealed';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Pick a random element from an array (generic version)
 * @param array - Source array
 * @returns Random element from the array
 */
const pickRandom = <T,>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

/**
 * Pick N random elements from an array without replacement
 * @param array - Source array
 * @param n - Number of elements to pick
 * @returns Array of n random elements
 */
const pickRandomN = <T,>(array: T[], n: number): T[] => {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
};

/**
 * Shuffle an array using Fisher-Yates-like algorithm
 * @param array - Source array
 * @returns New shuffled array
 */
const shuffle = <T,>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

/**
 * Pick a random project from an array (type-safe version)
 * @param array - Array of projects
 * @returns Random project
 */
const pickRandomProject = (array: Project[]): Project => array[Math.floor(Math.random() * array.length)];

/**
 * Pick a random image URL from an array (type-safe version)
 * @param array - Array of image URLs
 * @returns Random image URL
 */
const pickRandomImage = (array: string[]): string => array[Math.floor(Math.random() * array.length)];

// ============================================================================
// Main Component
// ============================================================================

/**
 * GameView Component - Interactive "Guess the Project" trivia game
 * 
 * @param props - Component props
 * @param props.projects - Array of all projects from CMS
 * @returns React component
 * 
 * @example
 * ```tsx
 * <GameView projects={data.projects} />
 * ```
 */
export const GameView: React.FC<GameViewProps> = ({ projects }) => {
    // ========================================================================
    // State Management
    // ========================================================================
    
    /** Controls page fade-in animation */
    const [showContent, setShowContent] = useState(false);
    
    /** Current score for this session (resets on page reload) */
    const [score, setScore] = useState(0);
    
    /** 
     * High score persisted in localStorage
     * Initialized from localStorage on mount, falls back to 0
     */
    const [highScore, setHighScore] = useState(() => {
        try {
            const saved = localStorage.getItem('game_highScore');
            return saved ? parseInt(saved, 10) : 0;
        } catch {
            return 0;
        }
    });
    
    /** Current game state (shuffling → playing → revealed) */
    const [gameState, setGameState] = useState<GameState>('shuffling');
    
    /** The project being shown in the current round */
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    
    /** URL of the current mystery image */
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    
    /** Array of 3 answer options (1 correct + 2 wrong) */
    const [answers, setAnswers] = useState<Project[]>([]);
    
    /** ID of the selected answer (null until user clicks) */
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    
    /** Whether to show confetti animation (on correct answer) */
    const [showConfetti, setShowConfetti] = useState(false);
    
    /** Whether the current score just became a new high score */
    const [isNewHighScore, setIsNewHighScore] = useState(false);
    
    /** Total number of rounds played in current session */
    const [roundsPlayed, setRoundsPlayed] = useState(0);
    
    /** Set of image URLs that have been shown (for cycling) */
    const [usedImages, setUsedImages] = useState<Set<string>>(new Set());
    
    /**
     * Ref to track used images without stale closure issues
     * Needed because startNewRound callback captures state at creation time
     */
    const usedImagesRef = useRef<Set<string>>(new Set());

    // ========================================================================
    // Computed Values
    // ========================================================================

    /**
     * Projects eligible for the game (must have gallery images)
     * Memoized to avoid recomputing on every render
     */
    const eligibleProjects = useMemo(() => 
        projects.filter(p => p.gallery && p.gallery.length > 0),
        [projects]
    );

    /**
     * Total number of images across all eligible projects
     * Used for debugging and potentially for progress display
     */
    const totalImages = useMemo(() => 
        eligibleProjects.reduce((sum, p) => sum + p.gallery.length, 0),
        [eligibleProjects]
    );

    // Debug: Log gallery counts on mount
    useEffect(() => {
        console.log('🎮 Game View - Gallery Stats:');
        console.log(`Total eligible projects: ${eligibleProjects.length}`);
        console.log(`Total images across all galleries: ${totalImages}`);
        eligibleProjects.forEach(p => {
            console.log(`  - "${p.title}": ${p.gallery.length} images`);
        });
    }, [eligibleProjects, totalImages]);

    /** Whether the game can be played (need at least 3 eligible projects) */
    const canPlay = eligibleProjects.length >= 3;

    // ========================================================================
    // Effects
    // ========================================================================

    /**
     * Page transition effect
     * Delays content visibility for smooth fade-in animation
     */
    useEffect(() => {
        if (THEME.pageTransitions.enabled) {
            setShowContent(false);
            const timer = setTimeout(() => setShowContent(true), THEME.pageTransitions.delay);
            return () => clearTimeout(timer);
        } else {
            setShowContent(true);
        }
    }, []);

    /**
     * Track game page view on mount
     */
    useEffect(() => {
        analyticsService.trackEvent('game_view', {
            eligible_projects: eligibleProjects.length,
            total_images: totalImages,
            timestamp: new Date().toISOString(),
        });
    }, [eligibleProjects.length, totalImages]);

    /**
     * High score persistence effect
     * Updates localStorage when a new high score is achieved
     */
    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            setIsNewHighScore(true);
            // Play high score celebration sound with slight delay
            setTimeout(() => gameSounds.playHighScore(), 200);
            
            // Track new high score event
            analyticsService.trackEvent('game_high_score', {
                new_high_score: score,
                previous_high_score: highScore,
                rounds_played: roundsPlayed,
                timestamp: new Date().toISOString(),
            });
            
            try {
                localStorage.setItem('game_highScore', score.toString());
            } catch {
                // localStorage not available (private browsing, etc.)
            }
        }
    }, [score, highScore, roundsPlayed]);

    // ========================================================================
    // Game Logic
    // ========================================================================

    /**
     * Start a new round of the game
     * 
     * Algorithm:
     * 1. Reset UI state (answer, confetti, etc.)
     * 2. Play shuffle sound and show shuffle animation
     * 3. After animation, select project using weighted random:
     *    - Projects with more unused images are more likely to be selected
     *    - This ensures fair cycling through all images
     * 4. Pick random unused image from selected project
     * 5. Generate 2 wrong answers from other projects
     * 6. Shuffle answer order and transition to 'playing' state
     */
    const startNewRound = useCallback(() => {
        if (!canPlay) return;

        setGameState('shuffling');
        setSelectedAnswer(null);
        setShowConfetti(false);
        setIsNewHighScore(false);
        
        // Play shuffle sound
        gameSounds.playShuffle();

        const timer = setTimeout(() => {
            // Use the ref to get the current used images (avoids stale closure)
            const currentUsedImages = usedImagesRef.current;
            
            console.log('🎮 Starting new round...');
            console.log('  Used images so far:', currentUsedImages.size, Array.from(currentUsedImages));
            
            // Get projects that still have unused images
            let projectsWithUnusedImages = eligibleProjects.filter(p => 
                p.gallery.some(img => !currentUsedImages.has(img))
            );
            
            console.log('  Projects with unused images:', projectsWithUnusedImages.length);
            
            // If all images have been used, reset the used images set
            if (projectsWithUnusedImages.length === 0) {
                console.log('  ⚠️ All images used, resetting...');
                usedImagesRef.current = new Set();
                setUsedImages(new Set());
                projectsWithUnusedImages = eligibleProjects;
            }
            
            // Weight selection by number of unused images - projects with more unused images
            // are more likely to be selected, ensuring we cycle through all images fairly
            const weightedProjects: Project[] = [];
            projectsWithUnusedImages.forEach(p => {
                const unusedCount = p.gallery.filter(img => !usedImagesRef.current.has(img)).length;
                // Add project multiple times based on unused image count
                for (let i = 0; i < unusedCount; i++) {
                    weightedProjects.push(p);
                }
            });
            
            // Pick a random project from the weighted list
            const correct = pickRandomProject(weightedProjects.length > 0 ? weightedProjects : projectsWithUnusedImages);
            
            console.log('  Selected project:', correct.title);
            console.log('  Project gallery:', correct.gallery);
            console.log('  Gallery length:', correct.gallery.length);
            
            // Get unused images from this project
            let availableImages = correct.gallery.filter(img => !usedImagesRef.current.has(img));
            console.log('  Available (unused) images:', availableImages.length, availableImages);
            
            // If somehow empty (after reset), use all images
            if (availableImages.length === 0) {
                console.log('  ⚠️ No available images, using all');
                availableImages = correct.gallery;
            }
            
            // Pick a random unused image
            const selectedImage = pickRandomImage(availableImages);
            console.log('  Selected image:', selectedImage);
            
            // Mark this image as used (update both ref and state)
            usedImagesRef.current = new Set([...usedImagesRef.current, selectedImage]);
            setUsedImages(new Set(usedImagesRef.current));
            
            console.log('  Updated used images count:', usedImagesRef.current.size);
            
            const wrongOptions = pickRandomN(
                eligibleProjects.filter(p => p.id !== correct.id),
                2
            );
            const shuffledAnswers = shuffle([correct, ...wrongOptions]);

            setCurrentProject(correct);
            setCurrentImageUrl(selectedImage);
            setAnswers(shuffledAnswers);
            setGameState('playing');
        }, 1500); // Shuffle animation duration

        return () => clearTimeout(timer);
    }, [eligibleProjects, canPlay]);

    /**
     * Start first round when component mounts and is ready
     */
    useEffect(() => {
        if (canPlay && showContent) {
            startNewRound();
        }
    }, [canPlay, showContent]);

    /**
     * Handle answer button click
     * 
     * @param projectId - ID of the project the user selected
     * 
     * Flow:
     * 1. Validate game state (must be 'playing' and no previous selection)
     * 2. Resume audio context (required by browsers for first interaction)
     * 3. Play click sound
     * 4. Update state to 'revealed'
     * 5. If correct: increment score, show confetti, play success sound
     * 6. If wrong: play error sound
     */
    const handleAnswer = (projectId: string) => {
        if (gameState !== 'playing' || selectedAnswer) return;

        // Resume audio context on first interaction
        gameSounds.resume();
        gameSounds.playClick();

        setSelectedAnswer(projectId);
        setGameState('revealed');

        // Increment rounds played
        setRoundsPlayed(r => r + 1);

        if (projectId === currentProject?.id) {
            setScore(s => s + 1);
            setShowConfetti(true);
            // Delay sound slightly to sync with visual feedback
            setTimeout(() => gameSounds.playCorrect(), 100);
            
            // Track correct answer
            analyticsService.trackEvent('game_correct_answer', {
                project_id: currentProject.id,
                project_title: currentProject.title,
                current_score: score + 1,
                timestamp: new Date().toISOString(),
            });
        } else {
            setTimeout(() => gameSounds.playWrong(), 100);
            
            // Track wrong answer
            analyticsService.trackEvent('game_wrong_answer', {
                correct_project: currentProject?.title,
                selected_project: answers.find(a => a.id === projectId)?.title,
                current_score: score,
                timestamp: new Date().toISOString(),
            });
        }
    };

    /**
     * Handle trading card click (opens project in new tab)
     * Only active when game state is 'revealed'
     */
    const handleCardClick = () => {
        if (gameState === 'revealed' && currentProject) {
            const slug = currentProject.slug || currentProject.id;
            window.open(`/work/${slug}`, '_blank');
        }
    };

    /**
     * Get CSS classes for answer buttons based on current state
     * 
     * @param project - The project this button represents
     * @returns Tailwind CSS class string
     * 
     * States:
     * - Default (playing): Subtle white border, hover effect
     * - Correct (revealed): Green glow with shadow
     * - Wrong & selected (revealed): Red tint
     * - Wrong & not selected (revealed): Muted gray
     */
    const getButtonClasses = (project: Project) => {
        const baseClasses = 'px-6 py-4 min-w-[140px] text-sm font-medium rounded-lg transition-all duration-300 border-2';
        
        if (gameState !== 'revealed') {
            return `${baseClasses} border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/40`;
        }

        const isCorrect = project.id === currentProject?.id;
        const isSelected = project.id === selectedAnswer;

        if (isCorrect) {
            return `${baseClasses} border-green-500/50 bg-green-500/20 text-green-400 shadow-lg shadow-green-500/20`;
        }

        if (isSelected && !isCorrect) {
            return `${baseClasses} border-red-500/30 bg-red-500/10 text-red-400/70`;
        }

        return `${baseClasses} border-white/10 bg-white/5 text-white/40`;
    };

    // ========================================================================
    // Render
    // ========================================================================

    // Not enough projects to play - show friendly message
    if (!canPlay) {
        return (
            <section className={`${THEME.filmography.paddingTop} ${THEME.filmography.paddingBottom} ${THEME.header.paddingX} min-h-screen flex flex-col items-center justify-center transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'} animate-fade-in-up`}>
                <div className="text-center max-w-md">
                    <h1 className="text-3xl md:text-4xl font-serif italic mb-6 text-white">
                        Coming Soon
                    </h1>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        The trivia game requires at least 3 projects with gallery images. 
                        Check back soon!
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className={`${THEME.filmography.paddingTop} pb-4 ${THEME.header.paddingX} min-h-screen flex flex-col transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'} animate-fade-in-up`}>
            {/* Scroll Top on Mount */}
            <span className="hidden" ref={() => window.scrollTo(0, 0)}></span>

            <div className="flex-1 flex flex-col items-center justify-start sm:justify-center max-w-5xl mx-auto w-full -mt-4 sm:-mt-8">
                {/* Page Heading */}
                <div className="text-center mb-2 sm:mb-3">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-serif italic text-white mb-1">
                        Guess the Project
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm">
                        How well do you know Gabriel's{' '}
                        <Link to="/work" className="text-white/70 hover:text-white underline underline-offset-2 transition-colors">
                            filmography
                        </Link>?
                    </p>
                </div>

                {/* Main Game Area - side by side on wider screens */}
                <div className="flex flex-col lg:flex-row items-center lg:items-center justify-center gap-4 sm:gap-6 lg:gap-8 w-full mt-2 sm:mt-8">
                    
                    {/* Trading Card */}
                    <div className="w-full max-w-[200px] sm:max-w-[240px] md:max-w-[260px] lg:max-w-[280px] xl:max-w-[300px] px-2 sm:px-0 flex-shrink-0">
                        <TradingCard
                            project={currentProject}
                            imageUrl={currentImageUrl}
                            revealed={gameState === 'revealed'}
                            isShuffling={gameState === 'shuffling'}
                            isCorrect={selectedAnswer === currentProject?.id}
                            onClick={handleCardClick}
                        />
                    </div>

                    {/* Score + Buttons - vertically centered with card */}
                    <div className="flex flex-col items-center lg:items-stretch justify-center w-full lg:w-auto lg:min-w-[220px] xl:min-w-[260px] overflow-visible">
                        {/* Score Display - above buttons */}
                        <div className="flex items-center justify-center gap-4 sm:gap-6 mb-3 lg:mb-6">
                            <div className="text-center">
                                <p className={`${THEME.typography.meta} text-text-muted mb-0.5`}>Score</p>
                                <p className={`text-lg sm:text-xl md:text-2xl font-serif text-white ${showConfetti ? 'animate-score-pop' : ''}`}>
                                    {score}
                                </p>
                            </div>
                            <div className="w-px h-6 sm:h-8 bg-white/20"></div>
                            <div className="text-center">
                                <p className={`${THEME.typography.meta} text-text-muted mb-0.5`}>High Score</p>
                                <p className={`text-lg sm:text-xl md:text-2xl font-serif ${isNewHighScore ? 'text-yellow-400 animate-high-score-glow' : 'text-white/60'}`}>
                                    {highScore}
                                </p>
                            </div>
                        </div>
                        {/* Answer Buttons - always rendered to prevent layout shift */}
                        <div className={`grid grid-cols-1 gap-2 sm:gap-3 mb-3 w-full max-w-[280px] sm:max-w-[320px] lg:max-w-none mx-auto lg:mx-0 px-0 transition-opacity duration-500 overflow-visible ${
                            gameState === 'shuffling' ? 'opacity-0 pointer-events-none' : 'opacity-100'
                        }`}>
                            {answers.length > 0 ? answers.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => handleAnswer(project.id)}
                                    disabled={gameState === 'revealed' || gameState === 'shuffling'}
                                    className={`${getButtonClasses(project)} w-full h-[40px] sm:h-[44px] text-[11px] sm:text-xs leading-tight py-2 relative flex items-center justify-center`}
                                >
                                    <span className="px-5 truncate max-w-[calc(100%-2rem)]">{project.title}</span>
                                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${
                                        gameState === 'revealed' && project.id === currentProject?.id ? 'opacity-100' : 'opacity-0'
                                    }`}>✓</span>
                                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${
                                        gameState === 'revealed' && project.id === selectedAnswer && project.id !== currentProject?.id ? 'opacity-100' : 'opacity-0'
                                    }`}>✗</span>
                                </button>
                            )) : (
                                // Placeholder buttons to maintain layout during initial load
                                <>
                                    <div className="w-full h-[40px] sm:h-[44px] rounded-lg border border-white/10 bg-white/5" />
                                    <div className="w-full h-[40px] sm:h-[44px] rounded-lg border border-white/10 bg-white/5" />
                                    <div className="w-full h-[40px] sm:h-[44px] rounded-lg border border-white/10 bg-white/5" />
                                </>
                            )}
                        </div>

                        {/* Next Button - fixed height container to prevent layout shift */}
                        <div className="h-[32px] sm:h-[36px] flex justify-center px-0">
                            <button
                                onClick={startNewRound}
                                disabled={gameState !== 'revealed'}
                                className={`px-6 py-2 h-full text-xs font-medium text-white border border-white/30 rounded-lg transition-all duration-300 ${
                                    gameState === 'revealed' 
                                        ? 'opacity-100 hover:bg-white/10 hover:border-white/50' 
                                        : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                Next Round →
                            </button>
                        </div>
                    </div>
                </div>

                {/* Confetti effect */}
                {showConfetti && (
                    <div className="fixed inset-0 pointer-events-none z-50 confetti-container">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="confetti-piece"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 0.5}s`,
                                    backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFFFFF'][Math.floor(Math.random() * 5)]
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Share Section */}
            <div className="max-w-md mx-auto mt-8 sm:mt-12">
                <div className="text-center mb-4">
                    <p className="text-gray-400 text-xs uppercase tracking-widest">
                        Challenge your friends
                    </p>
                </div>
                <SocialShare
                    url="https://directedbygabriel.com/game"
                    title={`I scored ${score} on Gabriel's filmography trivia game!`}
                    description="Can you beat my score? Test your knowledge of Gabriel Athanasiou's filmography."
                    layout="horizontal"
                    className="justify-center"
                />
            </div>

            {/* Explanation Section */}
            <div className="max-w-2xl mx-auto mt-12 sm:mt-16 text-center border-t border-white/10 pt-12">
                <h2 className="text-xl font-serif italic text-white mb-4">
                    What the f is this?
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                    Did you know? Gabriel is a big fan of video games and wanted to incorporate that passion 
                    into his portfolio. Tests your knowledge of his projects 
                    and filmography in a fun, interactive way!
                </p>
            </div>
        </section>
    );
};

export default GameView;
