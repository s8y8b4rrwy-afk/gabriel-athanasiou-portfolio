
import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Project, BlogPost, HomeConfig } from './types';
import { cmsService } from './services/cmsService';
import { analyticsService } from './services/analyticsService';
import { Navigation } from './components/Navigation';
import { Cursor } from './components/Cursor';
import { GlobalStyles } from './components/GlobalStyles';
import { SEO } from './components/SEO';

// View Components
import { HomeView } from './components/views/HomeView';
import { IndexView } from './components/views/IndexView';
import { ProjectDetailView } from './components/views/ProjectDetailView';
import { BlogView } from './components/views/BlogView';
import { BlogPostView } from './components/views/BlogPostView';
import { AboutView } from './components/views/AboutView';

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
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  
  const location = useLocation();

  useEffect(() => {
    const init = async () => {
      const result = await cmsService.fetchAll();
      setData(result);
      setLoading(false);
      
      // Initialize analytics with your Measurement ID
      analyticsService.init('G-EJ62G0X6Q5');
    };
    init();
  }, []);

  // Scroll to top on route change and track page view
  useEffect(() => {
    window.scrollTo(0, 0);
    setHoveredImage(null);
    
    // Track page view for analytics
    const pageTitle = getPageTitle(location.pathname);
    analyticsService.trackPageView(location.pathname, pageTitle);
  }, [location.pathname]);

  if (loading) return <div className="h-screen w-full bg-bg-main flex items-center justify-center text-white/20 tracking-widest text-xs uppercase animate-pulse">Loading...</div>;

  return (
    <div className="bg-bg-main min-h-screen text-text-main font-sans selection:bg-white/20">
      <GlobalStyles />
      <Cursor activeImageUrl={hoveredImage} />
      
      <Navigation showLinks={true} />

      <main>
        <Routes>
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
            
            <Route path="/work" element={
                <>
                    <SEO title="Filmography" />
                    <IndexView 
                        projects={data.projects} 
                        onHover={setHoveredImage}
                    />
                </>
            } />
            
            <Route path="/work/:slug" element={
                <ProjectDetailView 
                    allProjects={data.projects}
                    allPosts={data.posts}
                />
            } />
            
            <Route path="/journal" element={
                <>
                    <SEO title="Journal" />
                    <BlogView posts={data.posts} />
                </>
            } />
            
            <Route path="/journal/:slug" element={
                <BlogPostView 
                    allPosts={data.posts}
                    allProjects={data.projects}
                />
            } />
            
            <Route path="/about" element={
                 <>
                    <SEO title="About" />
                    <AboutView config={data.config} />
                </>
            } />

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
      </main>
    </div>
  );
}