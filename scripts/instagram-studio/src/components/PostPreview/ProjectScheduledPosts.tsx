import { useMemo, useState } from 'react';
import type { PostDraft, ScheduleSlot } from '../../types';
import { buildCloudinaryUrl, findImageIndex, getOptimizedCloudinaryUrl } from '../../utils/imageUtils';
import { convertSlotToDisplayTimezone } from '../../utils/timezone';
import './PostPreview.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface ProjectScheduledPostsProps {
  posts: ScheduledPost[];
  displayTimezone: string;
  onEditPost: (post: ScheduledPost) => void;
  onUnschedulePost: (slotId: string) => void;
  currentlyEditing?: string; // scheduledDate of the post being edited
}

// Confirmation dialog component
function DeleteConfirmDialog({
  onConfirm,
  onCancel,
  date,
  time
}: {
  onConfirm: () => void;
  onCancel: () => void;
  date: string;
  time: string;
}) {
  return (
    <div className="delete-confirm-overlay" onClick={onCancel}>
      <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <p>Remove scheduled post for <strong>{date}</strong> at <strong>{time}</strong>?</p>
        <div className="delete-confirm-actions">
          <button className="delete-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button className="delete-confirm-yes" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// Sub-component for rendering a scheduled post item
function ScheduledPostItem({ 
  post, 
  displayDate,
  displayTime,
  onEditPost, 
  onUnschedulePost,
  getStatusClass,
  getStatusLabel,
  formatDate,
  formatTime,
  isCurrentlyEditing
}: {
  post: ScheduledPost;
  displayDate: string;
  displayTime: string;
  onEditPost: (post: ScheduledPost) => void;
  onUnschedulePost: (slotId: string) => void;
  getStatusClass: (status: ScheduleSlot['status']) => string;
  getStatusLabel: (status: ScheduleSlot['status']) => string;
  formatDate: (dateStr: string) => string;
  formatTime: (timeStr: string) => string;
  isCurrentlyEditing?: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const cloudinaryThumbnail = useMemo(() => {
    const thumbnailUrl = post.selectedImages[0] || '';
    if (!thumbnailUrl) return '';
    
    // If already Cloudinary, just optimize
    if (thumbnailUrl.includes('res.cloudinary.com')) {
      return getOptimizedCloudinaryUrl(thumbnailUrl);
    }
    
    // Find the index in the project gallery
    const allImages = post.project?.gallery || [];
    const index = findImageIndex(thumbnailUrl, allImages);
    if (index !== -1) {
      return buildCloudinaryUrl(post.projectId, index);
    }
    
    // Fallback: assume first image
    return buildCloudinaryUrl(post.projectId, 0);
  }, [post.selectedImages, post.project?.gallery, post.projectId]);
  
  const hasThumbnail = post.selectedImages.length > 0;

  return (
    <div 
      className={`scheduled-post-item ${getStatusClass(post.scheduleSlot.status)} ${isCurrentlyEditing ? 'scheduled-post--editing' : ''}`}
      onClick={() => post.scheduleSlot.status === 'pending' && onEditPost(post)}
      style={{ cursor: post.scheduleSlot.status === 'pending' ? 'pointer' : 'default' }}
    >
      <div className="scheduled-post-thumbnail">
        {hasThumbnail ? (
          <img src={cloudinaryThumbnail} alt="Post thumbnail" />
        ) : (
          <span className="scheduled-post-no-image">📷</span>
        )}
      </div>
      <div className="scheduled-post-info">
        <div className="scheduled-post-datetime">
          <span className="scheduled-post-date">
            {formatDate(displayDate)}
          </span>
          <span className="scheduled-post-time">
            {formatTime(displayTime)}
          </span>
        </div>
        <div className="scheduled-post-meta">
          <span className={`scheduled-post-status ${getStatusClass(post.scheduleSlot.status)}`}>
            {getStatusLabel(post.scheduleSlot.status)}
          </span>
          <span className="scheduled-post-images">
            {post.selectedImages.length} images
          </span>
        </div>
      </div>
      {post.scheduleSlot.status === 'pending' && (
        <div className="scheduled-post-actions">
          <button 
            className="scheduled-post-action scheduled-post-action--remove"
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering edit when clicking remove
              setShowDeleteConfirm(true);
            }}
            title="Remove from schedule"
          >
            ✕
          </button>
        </div>
      )}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          date={formatDate(displayDate)}
          time={formatTime(displayTime)}
          onConfirm={() => {
            onUnschedulePost(post.scheduleSlot.id);
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

export function ProjectScheduledPosts({ 
  posts,
  displayTimezone,
  onEditPost, 
  onUnschedulePost,
  currentlyEditing 
}: ProjectScheduledPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusClass = (status: ScheduleSlot['status']) => {
    switch (status) {
      case 'published':
        return 'scheduled-post--published';
      case 'failed':
        return 'scheduled-post--failed';
      default:
        return 'scheduled-post--pending';
    }
  };

  const getStatusLabel = (status: ScheduleSlot['status']) => {
    switch (status) {
      case 'published':
        return 'Published';
      case 'failed':
        return 'Failed';
      default:
        return 'Scheduled';
    }
  };

  // Sort by date/time (using storage times for consistent ordering)
  const sortedPosts = [...posts].sort((a, b) => {
    const dateA = new Date(`${a.scheduleSlot.scheduledDate}T${a.scheduleSlot.scheduledTime}`);
    const dateB = new Date(`${b.scheduleSlot.scheduledDate}T${b.scheduleSlot.scheduledTime}`);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="project-scheduled-posts">
      <div className="project-scheduled-posts-header">
        <h3>📅 Scheduled Posts ({posts.length})</h3>
      </div>
      <div className="project-scheduled-posts-list">
        {sortedPosts.map((post) => {
          const displaySlot = convertSlotToDisplayTimezone(post.scheduleSlot, displayTimezone);
          return (
            <ScheduledPostItem
              key={post.scheduleSlot.id}
              post={post}
              displayDate={displaySlot.displayDate}
              displayTime={displaySlot.displayTime}
              onEditPost={onEditPost}
              onUnschedulePost={onUnschedulePost}
              getStatusClass={getStatusClass}
              getStatusLabel={getStatusLabel}
              formatDate={formatDate}
              formatTime={formatTime}
              isCurrentlyEditing={currentlyEditing === post.scheduleSlot.scheduledDate}
            />
          );
        })}
      </div>
    </div>
  );
}
