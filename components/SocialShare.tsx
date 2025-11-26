import React, { useState } from 'react';
import { THEME } from '../theme';
import { analyticsService } from '../services/analyticsService';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  className?: string;
  layout?: 'horizontal' | 'vertical';
}

export const SocialShare: React.FC<SocialShareProps> = ({ 
  url, 
  title, 
  description,
  className = '',
  layout = 'horizontal'
}) => {
  const [copied, setCopied] = useState(false);

  const shareMessage = `Check "${title}" out by Gabriel Athanasiou.`;

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareMessage)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(shareMessage)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareMessage)}`,
  };

  const handleCopyLink = async () => {
    const textToCopy = `${shareMessage}\n\n${url}`;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    
    // Track social share event
    analyticsService.trackSocialShare('copy', title, url);
    
    setTimeout(() => setCopied(false), 2500);
  };

  const ShareLink = ({ 
    icon, 
    label, 
    href, 
    onClick 
  }: { 
    icon: React.ReactNode; 
    label: string; 
    href?: string;
    onClick?: () => void;
  }) => {
    const baseClasses = "flex items-center gap-2 text-white/80 hover:text-white transition-colors duration-300 cursor-pointer whitespace-nowrap";

    const handleClick = () => {
      if (label === 'Twitter') {
        analyticsService.trackSocialShare('twitter', title, url);
      } else if (label === 'LinkedIn') {
        analyticsService.trackSocialShare('linkedin', title, url);
      } else if (label === 'Facebook') {
        analyticsService.trackSocialShare('facebook', title, url);
      }
      onClick?.();
    };

    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClasses}
          title={label}
          onClick={handleClick}
        >
          {icon}
          <span className={`uppercase tracking-widest font-medium ${layout === 'vertical' ? 'text-[10px] sm:text-xs' : 'text-xs'}`}>{label}</span>
        </a>
      );
    }

    return (
      <button
        onClick={handleClick}
        className={baseClasses}
        title={label}
      >
        {icon}
        <span className={`uppercase tracking-widest font-medium ${layout === 'vertical' ? 'text-[10px] sm:text-xs' : 'text-xs'}`}>
          {label}
        </span>
      </button>
    );
  };

  if (layout === 'vertical') {
    return (
      <div className={className}>
        <p className={`${THEME.typography.meta} text-text-muted mb-4`}>Share</p>
        <div className="flex flex-col gap-4 sm:gap-3">
          <ShareLink
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white flex-shrink-0">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7z"/>
              </svg>
            }
            label="Twitter"
            href={shareLinks.twitter}
          />

          <ShareLink
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white flex-shrink-0">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            }
            label="LinkedIn"
            href={shareLinks.linkedin}
          />

          <ShareLink
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white flex-shrink-0">
                <path d="M18 2h-3a6 6 0 00-6 6v3H7v4h2v8h4v-8h3l1-4h-4V8a2 2 0 012-2h3z"/>
              </svg>
            }
            label="Facebook"
            href={shareLinks.facebook}
          />

          <ShareLink
            icon={
              copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white flex-shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white flex-shrink-0">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )
            }
            label={copied ? 'Copied!' : 'Copy Link'}
            onClick={handleCopyLink}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <span className={`${THEME.typography.meta} text-white text-xs uppercase tracking-widest font-medium opacity-100`}>Share</span>
      
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6">
        <ShareLink
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white flex-shrink-0">
              <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7z"/>
            </svg>
          }
          label="Twitter"
          href={shareLinks.twitter}
        />

        <ShareLink
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white flex-shrink-0">
              <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
          }
          label="LinkedIn"
          href={shareLinks.linkedin}
        />

        <ShareLink
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white flex-shrink-0">
              <path d="M18 2h-3a6 6 0 00-6 6v3H7v4h2v8h4v-8h3l1-4h-4V8a2 2 0 012-2h3z"/>
            </svg>
          }
          label="Facebook"
          href={shareLinks.facebook}
        />

        <ShareLink
          icon={
            copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white flex-shrink-0">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white flex-shrink-0">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            )
          }
          label={copied ? 'Copied!' : 'Copy Link'}
          onClick={handleCopyLink}
        />
      </div>
    </div>
  );
};
