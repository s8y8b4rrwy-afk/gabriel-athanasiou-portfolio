import { useDrag } from 'react-dnd';
import type { ScheduleSlot, PostDraft } from '../../types';
import { ITEM_TYPES } from './DraggableProjectCard';
import styles from '../Calendar/Calendar.module.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface DragItem {
  type: typeof ITEM_TYPES.SCHEDULED_POST;
  post: ScheduledPost;
}

interface DraggableMiniCardProps {
  post: ScheduledPost;
  onClick?: () => void;
  statusClass: string;
  truncatedTitle: string;
}

export function DraggableMiniCard({
  post,
  onClick,
  statusClass,
  truncatedTitle,
}: DraggableMiniCardProps) {
  // Published posts should not be draggable
  const isPublished = post.scheduleSlot.status === 'published';
  
  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => ({
    type: ITEM_TYPES.SCHEDULED_POST,
    item: { type: ITEM_TYPES.SCHEDULED_POST, post },
    canDrag: !isPublished,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [post, isPublished]);

  return (
    <div
      ref={isPublished ? undefined : drag}
      className={`${styles.miniCard} ${statusClass} ${isPublished ? styles.notDraggable : ''}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isPublished ? 'default' : (isDragging ? 'grabbing' : 'grab'),
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`${post.project?.title || 'Untitled'} at ${post.scheduleSlot.scheduledTime}${isPublished ? ' (Published)' : ''}`}
    >
      <span className={styles.miniTitle}>{truncatedTitle}</span>
    </div>
  );
}
