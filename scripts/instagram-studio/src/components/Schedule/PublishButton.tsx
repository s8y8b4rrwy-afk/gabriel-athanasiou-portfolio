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
}

export function PublishButton({ 
  draft, 
  onPublishSuccess, 
  onPublishError,
  variant = 'primary',
  disabled = false,
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

    // Build full caption with hashtags
    const fullCaption = draft.hashtags.length > 0 
      ? `${draft.caption}\n\n${draft.hashtags.join(' ')}`
      : draft.caption;

    setStatus('creating');
    setError(null);

    try {
      // CRITICAL: Get ORIGINAL quality Cloudinary URLs for Instagram publishing
      // - Airtable URLs expire after a few hours
      // - Instagram API needs permanent, publicly accessible URLs
      // - We use original files (no transformations) for best quality on Instagram
      const instagramUrls = await getInstagramPublishUrls(draft.selectedImages, draft.projectId);
      
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
      const msg = err instanceof Error ? err.message : 'Unknown error';
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
        return 'Publish Now';
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
