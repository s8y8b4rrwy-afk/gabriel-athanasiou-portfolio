/**
 * Google Analytics 4 Service
 * 
 * Initialize once in App.tsx:
 *   analyticsService.init('G-XXXXXXXXXX');
 * 
 * Track events:
 *   analyticsService.trackEvent('video_play', { project_id: 'abc123' });
 */

interface GtagConfig {
  page_path?: string;
  page_title?: string;
  [key: string]: any;
}

interface AnalyticsEvent {
  [key: string]: string | number | boolean | string[];
}

class AnalyticsService {
  private measurementId: string = '';
  private isInitialized: boolean = false;

  /**
   * Initialize Google Analytics
   * Call this once on app load with your Measurement ID
   * @param measurementId - Your GA4 measurement ID (G-XXXXXXXXXX)
   */
  public init(measurementId: string): void {
    if (this.isInitialized) return;
    
    this.measurementId = measurementId;

    // Load the gtag script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize dataLayer
    (window as any).dataLayer = (window as any).dataLayer || [];
    
    function gtag(this: any, ...args: any[]) {
      (window as any).dataLayer.push(arguments);
    }
    
    (window as any).gtag = gtag;
    (window as any).gtag('js', new Date());
    (window as any).gtag('config', measurementId, {
      'anonymize_ip': true,  // Privacy-friendly: don't store full IPs
      'allow_google_signals': false,  // Don't use Google Signals for remarketing
      'allow_ad_personalization_signals': false
    });

    this.isInitialized = true;
    console.log('✅ Analytics initialized with ID:', measurementId);
  }

  /**
   * Track a page view (called on route change)
   * @param path - Current page path (e.g., '/work/my-project')
   * @param title - Page title (e.g., 'My Project')
   */
  public trackPageView(path: string, title: string): void {
    if (!this.isInitialized) return;

    (window as any).gtag('config', this.measurementId, {
      page_path: path,
      page_title: title,
    });
  }

  /**
   * Track a custom event
   * Common events:
   * - 'video_play' | 'social_share' | 'external_link_click' | 'contact_form'
   * 
   * @param eventName - Name of the event
   * @param eventData - Additional data about the event
   */
  public trackEvent(eventName: string, eventData: AnalyticsEvent = {}): void {
    if (!this.isInitialized) {
      console.warn('Analytics not initialized. Call init() first.');
      return;
    }

    (window as any).gtag('event', eventName, eventData);
    
    // Log to console for debugging (remove in production if verbose)
    console.log(`📊 Event tracked: ${eventName}`, eventData);
  }

  /**
   * Track video play event
   * Call when user clicks play on a project video
   */
  public trackVideoPlay(projectId: string, projectTitle: string): void {
    this.trackEvent('video_play', {
      project_id: projectId,
      project_title: projectTitle,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track social share event
   * Call when user clicks share button
   */
  public trackSocialShare(platform: 'twitter' | 'linkedin' | 'facebook' | 'copy', title: string, url: string): void {
    this.trackEvent('social_share', {
      platform: platform,
      title: title,
      url: url,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track external link click
   * Call when user clicks external links (IMDb, LinkedIn, etc.)
   */
  public trackExternalLink(label: string, url: string): void {
    this.trackEvent('external_link_click', {
      label: label,
      url: url,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track project view
   * Call when user navigates to project detail page
   */
  public trackProjectView(projectId: string, projectTitle: string, projectType: string): void {
    this.trackEvent('project_view', {
      project_id: projectId,
      project_title: projectTitle,
      project_type: projectType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track blog post view
   * Call when user navigates to blog post
   */
  public trackBlogPostView(postId: string, postTitle: string): void {
    this.trackEvent('blog_post_view', {
      post_id: postId,
      post_title: postTitle,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track form submission
   * Call when user submits contact form
   */
  public trackFormSubmission(formName: string, success: boolean, errorMessage?: string): void {
    this.trackEvent('form_submission', {
      form_name: formName,
      success: success,
      error_message: errorMessage || '',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Set user ID for tracking specific users
   * Optional: use if you have user login
   */
  public setUserId(userId: string): void {
    if (!this.isInitialized) return;
    (window as any).gtag('config', this.measurementId, {
      'user_id': userId
    });
  }

  /**
   * Set user properties (custom dimensions)
   * Useful for tracking user segments
   */
  public setUserProperties(properties: { [key: string]: string | number }): void {
    if (!this.isInitialized) return;
    (window as any).gtag('set', { 'user_properties': properties });
  }

  /**
   * Check if analytics is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
