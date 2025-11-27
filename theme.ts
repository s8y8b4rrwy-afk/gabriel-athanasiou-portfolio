
/**
 * ==============================================================================
 *  THEME & CONFIGURATION CONTROL PANEL
 * ==============================================================================
 * 
 *  This file controls the global styling, layout, animations, and behavior of the website.
 *  Adjusting values here will propagate across the entire application.
 * 
 *  NOTE: Many values are Tailwind CSS classes (e.g., "text-4xl", "md:w-1/2").
 *  You can use arbitrary values like "h-[500px]" or "text-[#ff0000]" if needed.
 */

export const THEME = {
  
    // --------------------------------------------------------------------------
    // 1. GLOBAL COLORS & FONTS
    // --------------------------------------------------------------------------
    colors: {
      // The main background color of the site (usually dark/black)
      background: "#050505",
      
      // Primary text color (usually white)
      textMain: "#ffffff",
      
      // Secondary text color (meta information, dates, roles)
      textMuted: "#a3a3a3",
      
      // Accent color used for hover states, active tabs, etc.
      accent: "#ffffff",
      
      // Selection color (when highlighting text)
      selectionBg: "rgba(255, 255, 255, 0.2)",
    },
  
    fonts: {
      // Must match Google Fonts loaded in index.html
      sans: "Inter",             // Clean, modern font for body text
      serif: "Playfair Display", // Elegant font for titles
    },
  
    // --------------------------------------------------------------------------
    // 2. TYPOGRAPHY SCALES
    // --------------------------------------------------------------------------
    typography: {
      // Hero Titles (Home & Project Detail)
      h1: "text-4xl md:text-6xl lg:text-7xl font-serif italic",
      
      // Section Headers / Project Titles in lists
      h2: "text-2xl md:text-4xl font-serif italic",
      
      // Subheaders
      h3: "text-xl md:text-2xl font-serif italic",
      
      // Standard Body Text
      body: "text-sm md:text-base font-sans leading-relaxed",
      
      // Small Meta Text (Dates, Tags, Credits)
      meta: "text-[10px] uppercase tracking-[0.2em] font-sans font-bold",
      
      // Navigation Links
      nav: "text-[10px] font-bold tracking-[0.2em] uppercase",
    },
  
    // --------------------------------------------------------------------------
    // 3. NAVIGATION & HEADER
    // --------------------------------------------------------------------------
    header: {
      // Height of the nav area (used for padding page content)
      height: "h-24 md:h-32",
      
      // Vertical padding inside the nav bar
      paddingY: "py-6 md:py-8",
      
      // Horizontal padding
      paddingX: "px-6 md:px-12",
      
      // Background style (e.g., "bg-transparent", "bg-black/50 backdrop-blur-md")
      background: "bg-gradient-to-b from-black/60 to-transparent",
      
      // Logo / Name styling
      logoText: "font-black tracking-[0.25em] uppercase text-xs",
      
      // Space between logo and links on desktop
      gap: "justify-between",
    },
  
    // --------------------------------------------------------------------------
    // 4. HERO SECTION (Global Defaults)
    // --------------------------------------------------------------------------
    hero: {
      // Height of the hero section on Home and Project pages
      // Options: "h-screen", "h-[80vh]", "min-h-[600px]"
      height: "h-screen",
      
      // Opacity of the black overlay on top of hero images (0.0 to 1.0)
      overlayOpacity: 0.1,
      overlayHoverOpacity: 0.0, // Opacity when hovering
      
      // Text Alignment: "text-left", "text-center", "text-right"
      textAlignment: "text-left",
      
      // Position of text container: 
      // "bottom-12 left-6 md:left-12" (Bottom Left)
      // "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" (Center)
      textPosition: "bottom-12 left-6 md:left-12",
      
      // Max width of the hero text
      textMaxWidth: "max-w-4xl",
      
      // Showreel Specifics
      showreel: {
        title: "Showreel 2025",
        muted: true,
        loop: true,
      }
    },
  
    // --------------------------------------------------------------------------
    // 5. INDEX / FILMOGRAPHY VIEW
    // --------------------------------------------------------------------------
    filmography: {
      // --- General ---
      paddingTop: "pt-32 md:pt-40",
      paddingBottom: "pb-20",
      
      // --- Tabs ---
      defaultTab: "Narrative", // "All", "Narrative", "Commercial", etc.
      hideEmptyTabs: true,     // If true, tabs with no projects won't show
      
      // --- Grid View (Filmstrip) ---
      grid: {
        // Number of columns at different breakpoints
        columns: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        
        // Spacing between grid items
        gapX: "gap-x-8",
        gapY: "gap-y-16",
        
        // Aspect ratio of thumbnails: "aspect-video", "aspect-[4/3]", "aspect-square"
        aspectRatio: "aspect-[16/9]",
        
        // Hover Effect
        hoverScale: "scale-[1.02]", // Zoom amount
        showYear: false,            // Show year on grid thumbnail?
      },
      
      // --- List View (Table) ---
      list: {
        // Height of each row
        rowPadding: "py-5",
        
        // Font sizes
        projectTitleSize: "text-lg md:text-xl",
        
        // Toggle Columns (true = visible, false = hidden)
        showThumbnailMobile: false,
        showYear: true,
        showClient: true,
        showGenre: true,
        showType: true,
        
        // Column Widths (Total 12 cols)
        cols: {
          year: "col-span-1",
          image: "col-span-0 md:col-span-1", // Mobile vs Desktop
          title: "col-span-9 md:col-span-4",
          client: "col-span-3",
          genre: "col-span-2",
          type: "col-span-2 md:col-span-2",
        }
      }
    },
  
    // --------------------------------------------------------------------------
    // 6. PROJECT DETAIL PAGE
    // --------------------------------------------------------------------------
    projectDetail: {
      // --- Hero Override ---
      // If you want Project Detail pages to have a shorter hero than Home
      heroHeight: "h-[60vh] md:h-[70vh]",
      
      // --- Layout ---
      // Max width of the content container
      contentMaxWidth: "max-w-7xl",
      
      // Gap between Sidebar and Main Content
      gridGap: "gap-12 md:gap-16",
      
      // --- Sidebar (Info) ---
      // Sticky Position: How far from top?
      sidebarStickyTop: "md:top-32",
      
      // Order of info blocks in sidebar
      showBrand: true,
      showClient: true,
      showGenre: true,
      showAwards: true,
      
      // --- Credits ---
      credits: {
        initialVisibleCount: 3, // How many credits to show before "See More"
        enableExpand: true,     // Allow expanding?
      },
      
      // --- Next Project Preview ---
      nextProject: {
        height: "h-[40vh]",
        overlayOpacity: 0.2, // Decreased from 0.3 for brightness
        hoverOverlayOpacity: 0.0,
      }
    },
  
    // --------------------------------------------------------------------------
    // 7. BLOG / JOURNAL
    // --------------------------------------------------------------------------
    blog: {
      grid: {
        columns: "grid-cols-1 md:grid-cols-2", // For Featured section styling
        gap: "gap-12",
      },
      post: {
        // Max width of text content in a single post
        contentWidth: "max-w-3xl",
        heroHeight: "h-[50vh] md:h-[70vh]",
      }
    },
  
    // --------------------------------------------------------------------------
    // 8. ANIMATIONS & TRANSITIONS
    // --------------------------------------------------------------------------
    animation: {
      // Transition Durations
      fast: "duration-300",
      medium: "duration-700",
      slow: "duration-[1500ms]",
      superSlow: "duration-[2000ms]",
      
      // Easing Function (Tailwind class)
      // Custom ease defined in index.html is 'ease-expo'
      ease: "ease-expo",
      
      // Fade In Up Stagger Delay
      staggerDelay: 100, // ms
    },
  
    // --------------------------------------------------------------------------
    // 9. UI ELEMENTS
    // --------------------------------------------------------------------------
    ui: {
      // Buttons (e.g., "Watch Film")
      button: {
        radius: "rounded-full",
        backdrop: "backdrop-blur-sm",
        border: "border border-white/30",
      },
      
      // Close Button (Project/Post views)
      closeButton: {
        position: "fixed top-24 right-6 md:top-24 md:right-12",
        size: "w-10 h-10 md:w-12 md:h-12",
      },
      
    // Custom Cursor (Desktop only)
    cursor: {
      size: "w-[300px]",
      radius: "rounded-none", // or "rounded-lg"
      fadeOutDuration: "duration-300", // Fade in/out animation speed
    }
  },

  // --------------------------------------------------------------------------
  // 10. PAGE TRANSITIONS & LOADING
  // --------------------------------------------------------------------------
  pageTransitions: {
    // Global fade-in effect when pages load
    enabled: true,                    // Toggle fade-in globally
    duration: "duration-200",         // Fade-in speed: "duration-300", "duration-500", "duration-700", "duration-1000"
    delay: 100,                        // Delay in ms before fade starts (prevents flash)
    
    // Initial app loading screen
    loading: {
      showText: false,                // Show "Loading..." text?
      showGradient: true,             // Show animated gradient background?
      gradientColors: [               // Gradient color stops (if showGradient = true)
        "rgba(255, 255, 255, 0.02)",
        "rgba(255, 255, 255, 0.06)",
        "rgba(255, 255, 255, 0.02)"
      ],
      animationDuration: "4s",        // Speed of gradient animation
      animationEasing: "ease-in-out", // Easing function: "linear", "ease-in-out", "ease-out"
    }
  }
};