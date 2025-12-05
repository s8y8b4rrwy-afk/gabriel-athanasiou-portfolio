import { useState } from 'react';
import styles from './Schedule.module.css';
import { Calendar, TimeSlotPicker } from '../Calendar';
import { ScheduleQueue } from './ScheduleQueue';
import type { ScheduleSlot, PostDraft, ScheduleSettings, Project } from '../../types';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface SchedulePanelProps {
  scheduledPosts: ScheduledPost[];
  settings: ScheduleSettings;
  onSchedulePost?: (date: Date, time: string) => void;
  onUnschedulePost: (slotId: string) => void;
  onReschedulePost: (slotId: string, newDate: Date, newTime: string) => void;
  onEditPost: (post: ScheduledPost) => void;
  currentDraft?: { project: Project; caption: string; hashtags: string[]; selectedImages: string[] } | null;
  onClearDraft?: () => void;
  onDropProject?: (project: Project, date: Date) => void;
  enableDragDrop?: boolean;
}

type ViewMode = 'calendar' | 'queue';

export function SchedulePanel({
  scheduledPosts,
  settings,
  onSchedulePost,
  onUnschedulePost,
  onReschedulePost,
  onEditPost,
  currentDraft,
  onClearDraft,
  onDropProject,
  enableDragDrop = false,
}: SchedulePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>(settings.defaultTimes[0] || '11:00');
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledPost | null>(null);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSchedule = () => {
    if (selectedDate && selectedTime && onSchedulePost) {
      onSchedulePost(selectedDate, selectedTime);
      setSelectedDate(null);
    }
  };

  const handleReschedule = (post: ScheduledPost) => {
    setRescheduleTarget(post);
    setSelectedDate(new Date(post.scheduleSlot.scheduledDate));
    setSelectedTime(post.scheduleSlot.scheduledTime);
    // Switch to calendar view so user can pick a new date
    setViewMode('calendar');
  };

  // Handle drag-drop reschedule (keeps the original time)
  const handleDragReschedule = (slotId: string, newDate: Date) => {
    const post = scheduledPosts.find(p => p.scheduleSlot.id === slotId);
    if (post) {
      onReschedulePost(slotId, newDate, post.scheduleSlot.scheduledTime);
    }
  };

  const confirmReschedule = () => {
    if (rescheduleTarget && selectedDate && selectedTime) {
      onReschedulePost(rescheduleTarget.scheduleSlot.id, selectedDate, selectedTime);
      setRescheduleTarget(null);
      setSelectedDate(null);
    }
  };

  const cancelReschedule = () => {
    setRescheduleTarget(null);
    setSelectedDate(null);
  };

  const getPostsForSelectedDate = () => {
    if (!selectedDate) return [];
    const dateKey = selectedDate.toISOString().split('T')[0];
    return scheduledPosts.filter(p => p.scheduleSlot.scheduledDate === dateKey);
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    return selectedDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const canSchedule = selectedDate && selectedTime && currentDraft && !rescheduleTarget;
  const existingPostsOnDate = getPostsForSelectedDate();
  const isOverLimit = existingPostsOnDate.length >= settings.maxPostsPerDay;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>📅 Schedule</h2>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.toggleButton} ${viewMode === 'calendar' ? styles.active : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            Calendar
          </button>
          <button
            className={`${styles.toggleButton} ${viewMode === 'queue' ? styles.active : ''}`}
            onClick={() => setViewMode('queue')}
          >
            Queue ({scheduledPosts.filter(p => p.scheduleSlot.status === 'pending').length})
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className={styles.calendarView}>
          {enableDragDrop && (
            <div className={styles.dragDropHint}>
              💡 Drag projects or scheduled posts to reschedule them
            </div>
          )}
          <Calendar
            scheduledPosts={scheduledPosts}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onPostClick={(post) => {
              handleReschedule(post);
            }}
            onDropProject={onDropProject}
            onReschedulePost={handleDragReschedule}
            enableDragDrop={enableDragDrop}
          />

          {selectedDate && (
            <div className={styles.selectedDatePanel}>
              <div className={styles.selectedDateHeader}>
                <h3>{formatSelectedDate()}</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => {
                    setSelectedDate(null);
                    setRescheduleTarget(null);
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Show existing posts for this date */}
              {existingPostsOnDate.length > 0 && (
                <div className={styles.existingPosts}>
                  <h4>Scheduled for this day:</h4>
                  {existingPostsOnDate.map(post => (
                    <div key={post.scheduleSlot.id} className={styles.existingPost}>
                      <span className={styles.existingPostTime}>
                        {post.scheduleSlot.scheduledTime}
                      </span>
                      <span 
                        className={styles.existingPostTitle}
                        onClick={() => onEditPost(post)}
                        title="Click to edit"
                      >
                        {post.project.title}
                      </span>
                      <button
                        className={styles.deletePostButton}
                        onClick={() => onUnschedulePost(post.scheduleSlot.id)}
                        title="Remove from schedule"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isOverLimit && !rescheduleTarget && (
                <div className={styles.limitWarning}>
                  ⚠️ Maximum {settings.maxPostsPerDay} posts per day reached
                </div>
              )}

              {/* Only show time picker when scheduling or rescheduling */}
              {(currentDraft || rescheduleTarget) && (
                <TimeSlotPicker
                  selectedTime={selectedTime}
                  onTimeSelect={setSelectedTime}
                  defaultTimes={settings.defaultTimes}
                />
              )}

              {rescheduleTarget ? (
                <div className={styles.rescheduleInfo}>
                  <p>Rescheduling: <strong>{rescheduleTarget.project.title}</strong></p>
                  <div className={styles.rescheduleActions}>
                    <button 
                      onClick={confirmReschedule}
                      className={styles.confirmButton}
                    >
                      Confirm Reschedule
                    </button>
                    <button 
                      onClick={cancelReschedule}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : currentDraft ? (
                <div className={styles.scheduleAction}>
                  <div className={styles.draftPreview}>
                    <strong>Ready to schedule:</strong>
                    <p>{currentDraft.project.title}</p>
                    <span className={styles.imageCount}>
                      {currentDraft.selectedImages.length} images
                    </span>
                  </div>
                  <button
                    onClick={handleSchedule}
                    className={styles.scheduleButton}
                    disabled={!canSchedule || isOverLimit}
                  >
                    📅 Schedule Post
                  </button>
                  <button
                    onClick={onClearDraft}
                    className={styles.clearButton}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className={styles.noDraft}>
                  <p>Select a project and create a caption to schedule</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <ScheduleQueue
          posts={scheduledPosts}
          onEditPost={onEditPost}
          onUnschedulePost={onUnschedulePost}
          onReschedulePost={handleReschedule}
          showTitle={false}
        />
      )}
    </div>
  );
}
