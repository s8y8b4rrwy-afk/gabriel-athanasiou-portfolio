
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Project, BlogPost, HomeConfig } from './types';
import { cmsService } from './services/cmsService';
import { analyticsService } from './services/analyticsService';
import { useBackgroundDataSync } from './hooks/useBackgroundDataSync';
import { Navigation } from './components/Navigation';
import { Cursor } from './components/Cursor';
import { GlobalStyles } from './components/GlobalStyles';
import { SEO } from './components/SEO';
import { PageTransition } from './components/PageTransition';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { Footer } from './components/Footer';
import { THEME } from './theme';
// import { saveScrollPosition, restoreScrollPosition } from './utils/scrollRestoration';

// Lazy load view components for code splitting
const HomeView = lazy(() => import('./components/views/HomeView').then(m => ({ default: m.HomeView })));
const IndexView = lazy(() => import('./components/views/IndexView').then(m => ({ default: m.IndexView })));
const ProjectDetailView = lazy(() => import('./components/views/ProjectDetailView').then(m => ({ default: m.ProjectDetailView })));
const BlogView = lazy(() => import('./components/views/BlogView').then(m => ({ default: m.BlogView })));
const BlogPostView = lazy(() => import('./components/views/BlogPostView').then(m => ({ default: m.BlogPostView })));
const AboutView = lazy(() => import('./components/views/AboutView').then(m => ({ default: m.AboutView })));
const GameView = lazy(() => import('./components/views/GameView').then(m => ({ default: m.GameView })));

// Helper function to get page title from pathname
const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Home';
  if (pathname === '/work') return 'Filmography';
  if (pathname.startsWith('/work/')) return 'Project';
  if (pathname === '/journal') return 'Journal';
  if (pathname.startsWith('/journal/')) return 'Journal Post';
  if (pathname === '/about') return 'About';
  return 'Page';
};

export default function App() {
  const [data, setData] = useState<{ projects: Project[], posts: BlogPost[], config: HomeConfig }>({ projects: [], posts: [], config: {} });
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<{ url: string | null; fallback: string | null }>({ url: null, fallback: null });

  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);

  // Enable background sync to check for updates every 30 minutes
  // When updates are found, cache is invalidated and new data loads on next navigation
  useBackgroundDataSync(true, 30);

  useEffect(() => {
    const init = async () => {
      try {
        const result = await cmsService.fetchAll();
        setData(result);
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setLoading(false);
        setData({ projects: [], posts: [], config: {} });
      }
    };
    init();
  }, []);

  // Ensure fade-in classes are present before rendering, and only removed after animation starts
  useEffect(() => {
    if (!loading) {
      setShowContent(false);
      const timer = setTimeout(() => setShowContent(true), THEME.pageTransitions.delay);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [loading]);

  useEffect(() => {
    setHoveredImage({ url: null, fallback: null });
    window.scrollTo(0, 0);
    const pageTitle = getPageTitle(location.pathname);
    analyticsService.trackPageView(location.pathname, pageTitle);
  }, [location.pathname]);

  if (loading || !showContent) {
    return <LoadingSkeleton />;
  }

  return (
    <>
      <GlobalStyles config={data.config} />
      <Cursor activeImageUrl={hoveredImage.url} fallbackUrl={hoveredImage.fallback} />
      <Navigation showLinks={true} config={data.config} />
      
      <div className={`bg-bg-main min-h-screen text-text-main font-sans selection:bg-white/20 antialiased overflow-x-clip transition-opacity ${THEME.pageTransitions.duration} ${THEME.pageTransitions.enabled && showContent ? 'opacity-100' : 'opacity-0'} animate-fade-in-up`}>
        <main>
        <Suspense fallback={
          <div className="h-screen w-full bg-bg-main flex items-center justify-center overflow-hidden relative">
            {/* Temporarily commented out page transition loading gradient */}
            {/* {THEME.pageTransitions.loading.showText && (
              <div className="text-white/20 tracking-widest text-xs uppercase animate-pulse relative z-10">
                Loading...
              </div>
            )}
            {THEME.pageTransitions.loading.showGradient && (
              <div 
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(
                    90deg,
                    ${THEME.pageTransitions.loading.gradientColors.map((color, i) => 
                      `${color} ${(i / (THEME.pageTransitions.loading.gradientColors.length - 1) * 100).toFixed(1)}%`
                    ).join(', ')}
                  )`,
                  backgroundSize: '200% 100%',
                  animation: `loadingShimmer ${THEME.pageTransitions.loading.animationDuration} ${THEME.pageTransitions.loading.animationEasing} infinite`,
                  willChange: 'background-position',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                  WebkitFontSmoothing: 'antialiased',
                  imageRendering: 'smooth'
                }}
              />
            )} */}
          </div>
        }>
          <PageTransition>
            <Routes>
              {/* ...existing code... */}
              <Route path="/" element={
                  <>
                      <SEO config={data.config} />
                      <HomeView 
                          projects={data.projects} 
                          posts={data.posts}
                          config={data.config}
                      />
                  </>
              } />
              {/* ...existing code... */}
              <Route path="/work" element={
                  <>
                      <SEO title={data.config?.workSectionLabel || "Filmography"} config={data.config} />
                      <IndexView 
                          projects={data.projects} 
                          onHover={setHoveredImage}
                          config={data.config}
                      />
                  </>
              } />
              {/* ...existing code... */}
              <Route path="/work/:slug" element={
                  <ProjectDetailView 
                      allProjects={data.projects}
                      allPosts={data.posts}
                      config={data.config}
                  />
              } />
              {/* Journal routes - only render if hasJournal is true */}
              {data.config?.hasJournal !== false && (
                  <Route path="/journal" element={
                      <>
                          <SEO title="Journal" config={data.config} />
                          <BlogView posts={data.posts} />
                      </>
                  } />
              )}
              {data.config?.hasJournal !== false && (
                  <Route path="/journal/:slug" element={
                      <BlogPostView 
                          allPosts={data.posts}
                          allProjects={data.projects}
                          config={data.config}
                      />
                  } />
              )}
              {/* ...existing code... */}
              <Route path="/about" element={
                   <>
                      <SEO title="About" config={data.config} />
                      <AboutView config={data.config} />
                  </>
              } />
              <Route path="/game" element={
                  <>
                      <SEO 
                          title="Game" 
                          description="Test your knowledge of Gabriel's filmography in this interactive trivia game. Can you guess the project from a single frame?"
                          image="https://res.cloudinary.com/date24ay6/image/upload/v1764713493/Screenshot_2025-12-02_at_22.11.07_lwxwlh.jpg"
                          config={data.config}
                      />
                      <GameView projects={data.projects} />
                  </>
              } />
              {/* ...existing code... */}

              {/* Fallback to Home */}
              <Route path="*" element={
                  <>
                      <SEO config={data.config} />
                      <HomeView 
                          projects={data.projects} 
                          posts={data.posts}
                          config={data.config}
                      />
                  </>
              } />
            </Routes>
          </PageTransition>
        </Suspense>
        </main>
        {/* Footer - hidden on About page to avoid duplication */}
        {location.pathname !== '/about' && <Footer config={data.config} />}
      </div>
    </>
  );
}