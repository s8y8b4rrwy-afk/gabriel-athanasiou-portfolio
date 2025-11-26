
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Project, BlogPost, HomeConfig } from './types';
import { cmsService } from './services/cmsService';
import { analyticsService } from './services/analyticsService';
import { Navigation } from './components/Navigation';
import { Cursor } from './components/Cursor';
import { GlobalStyles } from './components/GlobalStyles';
import { SEO } from './components/SEO';
import { PageTransition } from './components/PageTransition';
// import { saveScrollPosition, restoreScrollPosition } from './utils/scrollRestoration';

// Lazy load view components for code splitting
const HomeView = lazy(() => import('./components/views/HomeView').then(m => ({ default: m.HomeView })));
const IndexView = lazy(() => import('./components/views/IndexView').then(m => ({ default: m.IndexView })));
const ProjectDetailView = lazy(() => import('./components/views/ProjectDetailView').then(m => ({ default: m.ProjectDetailView })));
const BlogView = lazy(() => import('./components/views/BlogView').then(m => ({ default: m.BlogView })));
const BlogPostView = lazy(() => import('./components/views/BlogPostView').then(m => ({ default: m.BlogPostView })));
const AboutView = lazy(() => import('./components/views/AboutView').then(m => ({ default: m.AboutView })));
const ThumbnailPreviewView = lazy(() => import('./components/views/ThumbnailPreviewView').then(m => ({ default: m.ThumbnailPreviewView })));
const ImageCompressionView = lazy(() => import('./components/views/ImageCompressionView').then(m => ({ default: m.ImageCompressionView })));

// Helper function to get page title from pathname
const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Home';
  if (pathname === '/work') return 'Filmography';
  if (pathname.startsWith('/work/')) return 'Project';
  if (pathname === '/journal') return 'Journal';
  if (pathname.startsWith('/journal/')) return 'Journal Post';
  if (pathname === '/about') return 'About';
  if (pathname === '/thumbnails') return 'Thumbnail Preview';
  if (pathname === '/compression') return 'Image Compression Comparison';
  return 'Page';
};

export default function App() {
  const [data, setData] = useState<{ projects: Project[], posts: BlogPost[], config: HomeConfig }>({ projects: [], posts: [], config: {} });
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<{ url: string | null; fallback: string | null }>({ url: null, fallback: null });

  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);

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
      const timer = setTimeout(() => setShowContent(true), 80); // 80ms delay
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

  if (loading || !showContent) return <div className="h-screen w-full bg-bg-main flex items-center justify-center text-white/20 tracking-widest text-xs uppercase animate-pulse">Loading...</div>;

  return (
    <div className={`bg-bg-main min-h-screen text-text-main font-sans selection:bg-white/20 antialiased transition-opacity duration-700 ${showContent ? 'opacity-100' : 'opacity-0'} animate-fade-in-up`}>
      <GlobalStyles />
      <Cursor activeImageUrl={hoveredImage.url} fallbackUrl={hoveredImage.fallback} />

      <Navigation showLinks={true} />

      <main>
        <Suspense fallback={
          <div className="h-screen w-full bg-bg-main flex items-center justify-center text-white/20 tracking-widest text-xs uppercase animate-pulse">
            Loading...
          </div>
        }>
          <PageTransition>
            <Routes>
              {/* ...existing code... */}
              <Route path="/" element={
                  <>
                      <SEO />
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
                      <SEO title="Filmography" />
                      <IndexView 
                          projects={data.projects} 
                          onHover={setHoveredImage}
                      />
                  </>
              } />
              {/* ...existing code... */}
              <Route path="/work/:slug" element={
                  <ProjectDetailView 
                      allProjects={data.projects}
                      allPosts={data.posts}
                  />
              } />
              {/* ...existing code... */}
              <Route path="/journal" element={
                  <>
                      <SEO title="Journal" />
                      <BlogView posts={data.posts} />
                  </>
              } />
              {/* ...existing code... */}
              <Route path="/journal/:slug" element={
                  <BlogPostView 
                      allPosts={data.posts}
                      allProjects={data.projects}
                  />
              } />
              {/* ...existing code... */}
              <Route path="/about" element={
                   <>
                      <SEO title="About" />
                      <AboutView config={data.config} />
                  </>
              } />
              {/* ...existing code... */}
              <Route path="/thumbnails" element={
                   <>
                      <SEO title="Thumbnail Preview" />
                      <ThumbnailPreviewView />
                  </>
              } />
              {/* Internal tools - only in development */}
              {import.meta.env.DEV && (
                <Route path="/compression" element={
                     <>
                        <SEO title="Image Compression Comparison" />
                        <ImageCompressionView />
                    </>
                } />
              )}

              {/* Fallback to Home */}
              <Route path="*" element={
                  <>
                      <SEO />
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
    </div>
  );
}