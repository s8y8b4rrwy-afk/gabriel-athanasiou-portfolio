import { useState, useEffect } from 'react';
import { useDragLayer } from 'react-dnd';
import styles from './Schedule.module.css';
import { Calendar, TimeSlotPicker } from '../Calendar';
import { ScheduleQueue } from './ScheduleQueue';
import { PublishedList } from './PublishedList';
import { DeleteDropZone, ITEM_TYPES } from '../DragDrop';
import type { ScheduleSlot, PostDraft, ScheduleSettings, Project, RecurringTemplate } from '../../types';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface SchedulePanelProps {
  scheduledPosts: ScheduledPost[];
  settings: ScheduleSettings;
  onSchedulePost?: (date: Date, time: string) => void;
  onUnschedulePost: (slotId: string) => void;
  onReschedulePost: (slotId: string, newDate: Date, newTime: string) => void;
  onDuplicatePost?: (slotId: string, newDate: Date) => void;
  onEditPost: (post: ScheduledPost) => void;
  onPublishSuccess?: (slotId: string, instagramPostId?: string, permalink?: string) => void;
  onMarkAsPublished?: (slotId: string) => void;
  onRevertToScheduled?: (slotId: string) => void;
  currentDraft?: { project: Project; caption: string; hashtags: string[]; selectedImages: string[] } | null;
  onClearDraft?: () => void;
  onDropProject?: (project: Project, date: Date, time: string, template?: RecurringTemplate) => void;
  enableDragDrop?: boolean;
  templates?: RecurringTemplate[];
  defaultTemplate?: RecurringTemplate;
  subViewMode?: ScheduleViewMode;
  onSubViewModeChange?: (mode: ScheduleViewMode) => void;
  initialRescheduleTarget?: ScheduledPost | null;
  onRescheduleTargetConsumed?: () => void;
}

type ScheduleViewMode = 'calendar' | 'queue' | 'published';

export function SchedulePanel({
  scheduledPosts,
  settings,
  onSchedulePost,
  onUnschedulePost,
  onReschedulePost,
  onDuplicatePost,
  onEditPost,
  onPublishSuccess,
  onMarkAsPublished,
  onRevertToScheduled,
  currentDraft,
  onClearDraft,
  onDropProject,
  enableDragDrop = false,
  templates = [],
  defaultTemplate,
  subViewMode: controlledViewMode,
  onSubViewModeChange,
  initialRescheduleTarget,
  onRescheduleTargetConsumed,
}: SchedulePanelProps) {
  // Use controlled mode if provided, otherwise use internal state
  const [internalViewMode, setInternalViewMode] = useState<ScheduleViewMode>('calendar');
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onSubViewModeChange ?? setInternalViewMode;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>(settings.defaultTimes[0] || '11:00');
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledPost | null>(null);
  
  // When an initial reschedule target is passed in (from edit view), use it
  useEffect(() => {
    if (initialRescheduleTarget) {
      setRescheduleTarget(initialRescheduleTarget);
      setSelectedDate(new Date(initialRescheduleTarget.scheduleSlot.scheduledDate));
      setSelectedTime(initialRescheduleTarget.scheduleSlot.scheduledTime);
      // Notify parent that we've consumed the target
      onRescheduleTargetConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRescheduleTarget]); // Only depend on the target, not the callback
  
  // Quick schedule defaults (applied when dragging projects to calendar)
  const [quickScheduleTime, setQuickScheduleTime] = useState<string>(settings.defaultTimes[0] || '11:00');
  const [quickScheduleTemplateId, setQuickScheduleTemplateId] = useState<string>('default');
  
  // Track if a scheduled post is being dragged (to show delete zone)
  const { isDraggingScheduledPost } = useDragLayer((monitor) => ({
    isDraggingScheduledPost: monitor.isDragging() && monitor.getItemType() === ITEM_TYPES.SCHEDULED_POST,
  }));
  
  // Get the selected template for quick scheduling
  const quickScheduleTemplate = quickScheduleTemplateId === 'default'
    ? defaultTemplate
    : templates.find(t => t.id === quickScheduleTemplateId) || defaultTemplate;
  
  // Handler for dropping projects that uses quick schedule settings
  const handleDropProjectWithSettings = (project: Project, date: Date) => {
    if (onDropProject) {
      onDropProject(project, date, quickScheduleTime, quickScheduleTemplate);
    }
  };

  const handleDateSelect = (date: Date) => {
    // If we're rescheduling, immediately reschedule to the clicked date
    if (rescheduleTarget) {
      // Use the original time from the post being rescheduled
      onReschedulePost(rescheduleTarget.scheduleSlot.id, date, rescheduleTarget.scheduleSlot.scheduledTime);
      setRescheduleTarget(null);
      setSelectedDate(null);
      return;
    }
    
    // If there's a draft ready, immediately schedule it
    if (currentDraft && onSchedulePost) {
      const dateKey = date.toISOString().split('T')[0];
      const postsOnDate = scheduledPosts.filter(p => p.scheduleSlot.scheduledDate === dateKey);
      
      // Check if we're at the limit
      if (postsOnDate.length >= settings.maxPostsPerDay) {
        // Still select the date to show the limit warning
        setSelectedDate(date);
        return;
      }
      
      // Schedule immediately with the quick schedule time
      onSchedulePost(date, quickScheduleTime);
      // Don't select the date since we've already scheduled
      return;
    }
    
    setSelectedDate(date);
  };

  const handleSchedule = () => {
    if (selectedDate && selectedTime && onSchedulePost) {
      onSchedulePost(selectedDate, selectedTime);
      setSelectedDate(null);
    }
  };

  const handleReschedule = (post: ScheduledPost) => {
    // Don't allow rescheduling published posts
    if (post.scheduleSlot.status === 'published') {
      return;
    }
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
  const publishedPosts = scheduledPosts.filter(p => p.scheduleSlot.status === 'published');

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
          <button
            className={`${styles.toggleButton} ${viewMode === 'published' ? styles.active : ''}`}
            onClick={() => setViewMode('published')}
          >
            Published ({publishedPosts.length})
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
          
          <div className={styles.calendarLayout}>
            {/* Calendar - main area */}
            <div className={styles.calendarMain}>
              <Calendar
                scheduledPosts={scheduledPosts}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onPostClick={(post) => {
                  handleReschedule(post);
                }}
                onPostDoubleClick={(post) => {
                  onEditPost(post);
                }}
                onDropProject={handleDropProjectWithSettings}
                onReschedulePost={handleDragReschedule}
                onDuplicatePost={onDuplicatePost}
                enableDragDrop={enableDragDrop}
              />
            </div>
          
            {/* Settings Panel - sidebar on large screens */}
            <div className={styles.settingsPanel}>
              {selectedDate ? (
                <>
                  {/* Date-specific header */}
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
                          {post.project?.title || 'Untitled'}
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

                {/* Time picker and action section - horizontal layout */}
                {(currentDraft || rescheduleTarget) ? (
                  <div className={styles.schedulingRow}>
                    <div className={styles.timePickerColumn}>
                      <TimeSlotPicker
                        selectedTime={selectedTime}
                        onTimeSelect={setSelectedTime}
                        defaultTimes={settings.defaultTimes}
                      />
                    </div>

                    <div className={styles.actionColumn}>
                      {rescheduleTarget ? (
                        <div className={styles.rescheduleInfo}>
                          <p>Rescheduling: <strong>{rescheduleTarget.project?.title || 'Untitled'}</strong></p>
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
                      ) : (
                        <div className={styles.scheduleAction}>
                          <div className={styles.draftPreview}>
                            <strong>READY TO SCHEDULE:</strong>
                            <p>{currentDraft!.project?.title || 'Untitled'}</p>
                            <span className={styles.imageCount}>
                              {currentDraft!.selectedImages.length} images
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
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.noDraft}>
                    <p>Select a project and create a caption to schedule</p>
                  </div>
                )}
              </>
            ) : enableDragDrop ? (
              <>
                {/* Quick Schedule Defaults - when no date selected */}
                <h4 className={styles.quickScheduleTitle}>
                  ⚡ Quick Schedule Defaults
                </h4>
                <p className={styles.quickScheduleDesc}>
                  These settings apply when you drag a project onto a day
                </p>
                
                <TimeSlotPicker
                  selectedTime={quickScheduleTime}
                  onTimeSelect={setQuickScheduleTime}
                  defaultTimes={settings.defaultTimes}
                />
                
                <div className={styles.templateSelector}>
                  <label className={styles.templateLabel}>Template:</label>
                  <div className={styles.templateButtons}>
                    <button
                      className={`${styles.templateButton} ${quickScheduleTemplateId === 'default' ? styles.selected : ''}`}
                      onClick={() => setQuickScheduleTemplateId('default')}
                    >
                      {defaultTemplate?.name || 'Default'}
                    </button>
                    {templates.map(t => (
                      <button
                        key={t.id}
                        className={`${styles.templateButton} ${quickScheduleTemplateId === t.id ? styles.selected : ''}`}
                        onClick={() => setQuickScheduleTemplateId(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          </div>
        </div>
      ) : viewMode === 'queue' ? (
        <ScheduleQueue
          posts={scheduledPosts}
          onEditPost={onEditPost}
          onUnschedulePost={onUnschedulePost}
          onReschedulePost={handleReschedule}
          onPublishSuccess={onPublishSuccess}
          onMarkAsPublished={onMarkAsPublished}
          showTitle={false}
        />
      ) : (
        <PublishedList posts={publishedPosts} onRevertToScheduled={onRevertToScheduled} />
      )}
      
      {/* Delete zone appears when dragging scheduled posts */}
      <DeleteDropZone
        onDelete={onUnschedulePost}
        isVisible={isDraggingScheduledPost && enableDragDrop}
      />
    </div>
  );
}
