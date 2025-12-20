import { useDrag } from 'react-dnd';
import type { ScheduledPost } from '../../types';
import { ITEM_TYPES } from './DraggableProjectCard';
import styles from '../Calendar/Calendar.module.css';

interface DragItem {
  type: typeof ITEM_TYPES.SCHEDULED_POST;
  post: ScheduledPost;
}

interface DraggableMiniCardProps {
  post: ScheduledPost;
  displayTime?: string; // Time converted to display timezone (HH:mm format)
  onClick?: () => void;
  onDoubleClick?: () => void;
  statusClass: string;
  truncatedTitle: string;
}

export function DraggableMiniCard({
  post,
  displayTime,
  onClick,
  onDoubleClick,
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

  // Format time for display (convert HH:mm to 12-hour format)
  const formatTime = (time: string | undefined) => {
    if (!time) return '--:--';
    const parts = time.split(':');
    if (parts.length < 2) return time;
    const [hours, minutes] = parts;
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

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
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
      title={`${post.project?.title || 'Untitled'} at ${formatTime(displayTime)}${isPublished ? ' (Published)' : ''}\nDouble-click to edit • ⌥+drag to duplicate`}
    >
      <span className={styles.miniTitle}>{truncatedTitle}</span>
    </div>
  );
}
