import { useState } from 'react';
import { 
  publishSingleImage, 
  publishCarousel,
  getCredentialsLocally,
  isTokenExpired,
  canPublishPost,
  canMakeApiCall,
} from '../../services/instagramApi';
import { getInstagramPublishUrls } from '../../utils/imageUtils';
import type { PostDraft } from '../../types';
import type { PostPublishStatus, PublishResult } from '../../types/instagram';
import styles from './PublishButton.module.css';

interface PublishButtonProps {
  draft: PostDraft;
  onPublishSuccess?: (result: PublishResult) => void;
  onPublishError?: (error: string) => void;
  variant?: 'primary' | 'secondary' | 'small';
  disabled?: boolean;
  label?: string; // Custom button label (e.g., 'Retry Now' for failed posts)
}

export function PublishButton({ 
  draft, 
  onPublishSuccess, 
  onPublishError,
  variant = 'primary',
  disabled = false,
  label,
}: PublishButtonProps) {
  const [status, setStatus] = useState<PostPublishStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    // Check credentials
    const credentials = getCredentialsLocally();
    if (!credentials || !credentials.accessToken || !credentials.accountId) {
      const msg = 'Please connect your Instagram account in Settings first';
      setError(msg);
      onPublishError?.(msg);
      return;
    }

    if (isTokenExpired(credentials)) {
      const msg = 'Your Instagram token has expired. Please reconnect in Settings';
      setError(msg);
      onPublishError?.(msg);
      return;
    }

    if (!canMakeApiCall()) {
      const msg = 'API rate limit reached. Please try again later';
      setError(msg);
      onPublishError?.(msg);
      return;
    }

    if (!canPublishPost()) {
      const msg = 'Daily post limit reached (25/day). Please try again tomorrow';
      setError(msg);
      onPublishError?.(msg);
      return;
    }

    // Validate images
    if (!draft.selectedImages || draft.selectedImages.length === 0) {
      const msg = 'No images selected for this post';
      setError(msg);
      onPublishError?.(msg);
      return;
    }

    // Caption already includes hashtags (added during generation/editing)
    // No need to add them again
    const fullCaption = draft.caption;

    setStatus('creating');
    setError(null);

    try {
      // CRITICAL: Get ORIGINAL quality Cloudinary URLs for Instagram publishing
      // - Airtable URLs expire after a few hours
      // - Instagram API needs permanent, publicly accessible URLs
      // - imageMode: 'fill' = crop to fill, 'fit' = letterbox with bars
      const instagramUrls = await getInstagramPublishUrls(draft.selectedImages, draft.projectId, draft.imageMode || 'fill');
      
      // Check if any URLs failed to convert (still contain airtable)
      const failedUrls = instagramUrls.filter(url => 
        url.includes('airtable.com') || url.includes('airtableusercontent.com')
      );
      if (failedUrls.length > 0) {
        console.warn('Some URLs could not be converted to Cloudinary:', failedUrls);
      }
      
      console.log('📸 Publishing to Instagram with original quality URLs:', instagramUrls);
      
      let result: PublishResult;

      if (instagramUrls.length === 1) {
        // Single image post
        setStatus('publishing');
        result = await publishSingleImage(
          instagramUrls[0],
          fullCaption,
          credentials.accessToken,
          credentials.accountId
        );
      } else {
        // Carousel post
        setStatus('publishing');
        result = await publishCarousel(
          instagramUrls,
          fullCaption,
          credentials.accessToken,
          credentials.accountId
        );
      }

      if (result.success) {
        setStatus('success');
        onPublishSuccess?.(result);
      } else {
        throw new Error(result.error || 'Publishing failed');
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide user-friendly messages for common Instagram API errors
      let msg = rawMsg;
      if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('request limit')) {
        msg = '⏳ Instagram rate limit reached. Please wait about an hour and try again.';
      } else if (rawMsg.toLowerCase().includes('token') && rawMsg.toLowerCase().includes('expired')) {
        msg = '🔑 Your Instagram token has expired. Please reconnect in Settings.';
      } else if (rawMsg.toLowerCase().includes('invalid') && rawMsg.toLowerCase().includes('token')) {
        msg = '🔑 Invalid Instagram token. Please reconnect in Settings.';
      } else if (rawMsg.toLowerCase().includes('permission')) {
        msg = '🚫 Permission denied. Make sure your Instagram account has the required permissions.';
      }
      
      setStatus('error');
      setError(msg);
      onPublishError?.(msg);
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'creating':
        return 'Creating...';
      case 'publishing':
        return 'Publishing...';
      case 'success':
        return '✓ Published!';
      case 'error':
        return 'Try Again';
      default:
        return label || 'Publish Now';
    }
  };

  const isDisabled = disabled || status === 'creating' || status === 'publishing';

  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${styles[variant]} ${status === 'success' ? styles.success : ''} ${status === 'error' ? styles.error : ''}`}
        onClick={handlePublish}
        disabled={isDisabled}
      >
        {(status === 'creating' || status === 'publishing') && (
          <span className={styles.spinner}></span>
        )}
        {getButtonText()}
      </button>
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
}
