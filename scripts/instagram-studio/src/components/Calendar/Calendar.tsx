import { useState, useMemo } from 'react';
import styles from './Calendar.module.css';
import { CalendarDay } from './CalendarDay';
import { DroppableCalendarDay } from '../DragDrop/DroppableCalendarDay';
import type { ScheduleSlot, PostDraft, Project } from '../../types';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface CalendarProps {
  scheduledPosts: ScheduledPost[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
  onPostClick?: (post: ScheduledPost) => void;
  onPostDoubleClick?: (post: ScheduledPost) => void;
  onDropProject?: (project: Project, date: Date) => void;
  onReschedulePost?: (slotId: string, newDate: Date) => void;
  onDuplicatePost?: (slotId: string, newDate: Date) => void;
  enableDragDrop?: boolean;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function Calendar({ 
  scheduledPosts, 
  onDateSelect, 
  selectedDate,
  onPostClick,
  onPostDoubleClick,
  onDropProject,
  onReschedulePost,
  onDuplicatePost,
  enableDragDrop = false,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    // Add empty cells to complete the last week
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        days.push(null);
      }
    }
    
    return days;
  }, [year, month]);

  // Generate week days for week view
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentDate]);

  // Create a map of date strings to posts
  const postsMap = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    scheduledPosts.forEach(post => {
      const dateKey = post.scheduleSlot.scheduledDate;
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, post]);
    });
    return map;
  }, [scheduledPosts]);

  const navigatePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 7);
      setCurrentDate(newDate);
    }
  };

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 7);
      setCurrentDate(newDate);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateKey = (date: Date): string => {
    // Use local date, not UTC, to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date): boolean => {
    return selectedDate?.toDateString() === date.toDateString();
  };

  const displayDays = viewMode === 'month' ? calendarDays : weekDays;

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <div className={styles.navigation}>
          <button onClick={navigatePrev} className={styles.navButton}>
            ←
          </button>
          <h2 className={styles.title}>
            {viewMode === 'month' 
              ? `${MONTHS[month]} ${year}`
              : `Week of ${weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
            }
          </h2>
          <button onClick={navigateNext} className={styles.navButton}>
            →
          </button>
        </div>
        <div className={styles.controls}>
          <button onClick={goToToday} className={styles.todayButton}>
            Today
          </button>
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.viewButton} ${viewMode === 'month' ? styles.active : ''}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button 
              className={`${styles.viewButton} ${viewMode === 'week' ? styles.active : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className={styles.weekHeader}>
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className={styles.weekDay}>
            {day}
          </div>
        ))}
      </div>

      <div className={`${styles.grid} ${viewMode === 'week' ? styles.weekGrid : ''}`}>
        {displayDays.map((date, index) => 
          enableDragDrop ? (
            <DroppableCalendarDay
              key={date ? date.toISOString() : `empty-${index}`}
              date={date}
              posts={date ? postsMap.get(formatDateKey(date)) || [] : []}
              isToday={date ? isToday(date) : false}
              isSelected={date ? isSelected(date) : false}
              onClick={() => date && onDateSelect(date)}
              onPostClick={onPostClick}
              onPostDoubleClick={onPostDoubleClick}
              isWeekView={viewMode === 'week'}
              onDropProject={onDropProject}
              onReschedulePost={onReschedulePost}
              onDuplicatePost={onDuplicatePost}
            />
          ) : (
            <CalendarDay
              key={date ? date.toISOString() : `empty-${index}`}
              date={date}
              posts={date ? postsMap.get(formatDateKey(date)) || [] : []}
              isToday={date ? isToday(date) : false}
              isSelected={date ? isSelected(date) : false}
              onClick={() => date && onDateSelect(date)}
              onPostClick={onPostClick}
              onPostDoubleClick={onPostDoubleClick}
              isWeekView={viewMode === 'week'}
            />
          )
        )}
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.pending}`}></span>
          <span>Pending</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.published}`}></span>
          <span>Published</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.failed}`}></span>
          <span>Failed</span>
        </div>
      </div>
    </div>
  );
}
