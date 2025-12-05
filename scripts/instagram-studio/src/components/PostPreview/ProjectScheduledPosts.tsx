import type { PostDraft, ScheduleSlot } from '../../types';
import './PostPreview.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface ProjectScheduledPostsProps {
  posts: ScheduledPost[];
  onEditPost: (post: ScheduledPost) => void;
  onUnschedulePost: (slotId: string) => void;
}

// Sub-component for rendering a scheduled post item
function ScheduledPostItem({ 
  post, 
  onEditPost, 
  onUnschedulePost,
  getStatusClass,
  getStatusLabel,
  formatDate,
  formatTime
}: {
  post: ScheduledPost;
  onEditPost: (post: ScheduledPost) => void;
  onUnschedulePost: (slotId: string) => void;
  getStatusClass: (status: ScheduleSlot['status']) => string;
  getStatusLabel: (status: ScheduleSlot['status']) => string;
  formatDate: (dateStr: string) => string;
  formatTime: (timeStr: string) => string;
}) {
  const thumbnailUrl = post.selectedImages[0] || '';

  return (
    <div 
      className={`scheduled-post-item ${getStatusClass(post.scheduleSlot.status)}`}
    >
      <div className="scheduled-post-thumbnail">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Post thumbnail" />
        ) : (
          <span className="scheduled-post-no-image">📷</span>
        )}
      </div>
      <div className="scheduled-post-info">
        <div className="scheduled-post-datetime">
          <span className="scheduled-post-date">
            {formatDate(post.scheduleSlot.scheduledDate)}
          </span>
          <span className="scheduled-post-time">
            {formatTime(post.scheduleSlot.scheduledTime)}
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
            className="scheduled-post-action scheduled-post-action--edit"
            onClick={() => onEditPost(post)}
            title="Edit post"
          >
            ✏️
          </button>
          <button 
            className="scheduled-post-action scheduled-post-action--remove"
            onClick={() => onUnschedulePost(post.scheduleSlot.id)}
            title="Remove from schedule"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function ProjectScheduledPosts({ 
  posts, 
  onEditPost, 
  onUnschedulePost 
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

  // Sort by date/time
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
        {sortedPosts.map((post) => (
          <ScheduledPostItem
            key={post.scheduleSlot.id}
            post={post}
            onEditPost={onEditPost}
            onUnschedulePost={onUnschedulePost}
            getStatusClass={getStatusClass}
            getStatusLabel={getStatusLabel}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        ))}
      </div>
    </div>
  );
}
