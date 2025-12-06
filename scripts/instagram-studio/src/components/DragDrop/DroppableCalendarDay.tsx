import { useDrop } from 'react-dnd';
import type { Project, ScheduleSlot, PostDraft } from '../../types';
import { CalendarDay } from '../Calendar/CalendarDay';
import { ITEM_TYPES } from './DraggableProjectCard';

interface ProjectDragItem {
  type: typeof ITEM_TYPES.PROJECT;
  project: Project;
}

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface ScheduledPostDragItem {
  type: typeof ITEM_TYPES.SCHEDULED_POST;
  post: ScheduledPost;
}

type DragItem = ProjectDragItem | ScheduledPostDragItem;

interface DroppableCalendarDayProps {
  date: Date | null;
  posts: ScheduledPost[];
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
  onPostClick?: (post: ScheduledPost) => void;
  onPostDoubleClick?: (post: ScheduledPost) => void;
  isWeekView?: boolean;
  onDropProject?: (project: Project, date: Date) => void;
  onReschedulePost?: (slotId: string, newDate: Date) => void;
  onDuplicatePost?: (slotId: string, newDate: Date) => void;
}

export function DroppableCalendarDay({
  date,
  posts,
  isToday,
  isSelected,
  onClick,
  onPostClick,
  onPostDoubleClick,
  isWeekView = false,
  onDropProject,
  onReschedulePost,
  onDuplicatePost,
}: DroppableCalendarDayProps) {
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: [ITEM_TYPES.PROJECT, ITEM_TYPES.SCHEDULED_POST],
    canDrop: (item) => {
      // Don't allow dropping on past dates
      if (date === null || date < new Date(new Date().setHours(0, 0, 0, 0))) {
        return false;
      }
      // Don't allow rescheduling published posts
      if (item.type === ITEM_TYPES.SCHEDULED_POST && item.post.scheduleSlot.status === 'published') {
        return false;
      }
      return true;
    },
    drop: (item, monitor) => {
      if (!date) return;
      
      if (item.type === ITEM_TYPES.PROJECT && onDropProject) {
        onDropProject(item.project, date);
      } else if (item.type === ITEM_TYPES.SCHEDULED_POST) {
        // Double-check: don't reschedule published posts
        if (item.post.scheduleSlot.status !== 'published') {
          // Check if Option key (macOS) / Alt key (Windows) is held for duplicate
          // monitor.getClientOffset() is a proxy to check if we have access to the event
          // We need to check the keyboard state at drop time
          const isOptionHeld = (window.event as KeyboardEvent | null)?.altKey ?? false;
          
          if (isOptionHeld && onDuplicatePost) {
            // Option+drag = duplicate
            onDuplicatePost(item.post.scheduleSlot.id, date);
          } else if (onReschedulePost) {
            // Normal drag = reschedule (move)
            onReschedulePost(item.post.scheduleSlot.id, date);
          }
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [date, onDropProject, onReschedulePost, onDuplicatePost]);

  if (!date) {
    return <CalendarDay date={null} posts={[]} isToday={false} isSelected={false} onClick={() => {}} />;
  }

  const dropStyle = {
    outline: isOver && canDrop ? '2px dashed #fcd34d' : undefined,
    backgroundColor: isOver && canDrop ? 'rgba(252, 211, 77, 0.1)' : undefined,
    transition: 'all 0.2s ease',
  };

  return (
    <div ref={drop} style={dropStyle}>
      <CalendarDay
        date={date}
        posts={posts}
        isToday={isToday}
        isSelected={isSelected}
        onClick={onClick}
        onPostClick={onPostClick}
        onPostDoubleClick={onPostDoubleClick}
        isWeekView={isWeekView}
      />
    </div>
  );
}
