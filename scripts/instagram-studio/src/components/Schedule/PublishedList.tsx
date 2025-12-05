import styles from './Schedule.module.css';
import { buildCloudinaryUrl, findImageIndex, getOptimizedCloudinaryUrl } from '../../utils/imageUtils';
import type { ScheduleSlot, PostDraft } from '../../types';
import { useMemo } from 'react';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface PublishedListProps {
  posts: ScheduledPost[];
}

export function PublishedList({ posts }: PublishedListProps) {
  // Sort by published date, most recent first
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      const dateA = a.scheduleSlot.publishedAt ? new Date(a.scheduleSlot.publishedAt) : new Date(0);
      const dateB = b.scheduleSlot.publishedAt ? new Date(b.scheduleSlot.publishedAt) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [posts]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInstagramUrl = (post: ScheduledPost) => {
    // Prefer the permalink if available (direct Instagram URL)
    if (post.scheduleSlot.instagramPermalink) {
      return post.scheduleSlot.instagramPermalink;
    }
    // Fallback: can't construct URL without permalink
    return null;
  };

  const getThumbnail = (post: ScheduledPost) => {
    const rawThumbnail = post.selectedImages[0] || post.project.gallery?.[0] || '';
    if (!rawThumbnail) return '';
    
    // If already Cloudinary, just optimize it
    if (rawThumbnail.includes('res.cloudinary.com')) {
      return getOptimizedCloudinaryUrl(rawThumbnail);
    }
    
    // Find the index in the gallery
    const allImages = post.project.gallery || [];
    const index = findImageIndex(rawThumbnail, allImages);
    if (index !== -1) {
      return buildCloudinaryUrl(post.projectId, index);
    }
    
    return rawThumbnail;
  };

  if (sortedPosts.length === 0) {
    return (
      <div className={styles.queue}>
        <div className={styles.emptyQueue}>
          <span className={styles.emptyIcon}>✅</span>
          <p>No published posts yet</p>
          <p className={styles.emptyHint}>
            Posts will appear here after you publish them to Instagram
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.queue}>
      <div className={styles.queueList}>
        {sortedPosts.map(post => {
          const thumbnail = getThumbnail(post);
          const instagramUrl = getInstagramUrl(post);
          
          return (
            <div key={post.scheduleSlot.id} className={`${styles.item} ${styles.published}`}>
              <div className={styles.itemHeader}>
                <div className={styles.datetime}>
                  <span className={styles.date}>{formatDate(post.scheduleSlot.publishedAt)}</span>
                </div>
                <span className={`${styles.badge} ${styles.published}`}>Published</span>
              </div>

              <div className={styles.itemContent}>
                {thumbnail && (
                  <img 
                    src={thumbnail} 
                    alt={post.project.title} 
                    className={styles.thumbnail} 
                  />
                )}
                <div className={styles.itemDetails}>
                  <h4 className={styles.projectTitle}>{post.project.title}</h4>
                  <p className={styles.projectYear}>{post.project.year}</p>
                  <div className={styles.imageCount}>
                    📷 {post.selectedImages.length || post.project.gallery?.length || 0} images
                  </div>
                </div>
              </div>

              <div className={styles.itemActions}>
                {instagramUrl ? (
                  <a 
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.instagramLink}
                  >
                    📸 View on Instagram
                  </a>
                ) : (
                  <span className={styles.noLinkHint}>
                    No Instagram link available
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
