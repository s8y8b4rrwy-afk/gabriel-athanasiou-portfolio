import { useState, useCallback, useMemo } from 'react';
import { Layout, ProjectList, PostPreview, SchedulePanel } from './components';
import { useProjects, useSchedule } from './hooks';
import type { Project, PostDraft, ScheduleSlot } from './types';
import './App.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

type ViewMode = 'create' | 'schedule';

interface EditingState {
  draftId: string;
  slotId: string;
  project: Project;
  caption: string;
  hashtags: string[];
  selectedImages: string[];
}

function App() {
  const { projects, isLoading, error, filters, refetch } = useProjects({
    showOnlyWithImages: true,
  });
  
  const {
    scheduledPosts,
    settings,
    schedulePost,
    unschedulePost,
    reschedulePost,
    saveDraft,
    updateDraft,
  } = useSchedule();
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('create');
  const [currentDraft, setCurrentDraft] = useState<{
    project: Project;
    caption: string;
    hashtags: string[];
    selectedImages: string[];
  } | null>(null);
  
  // Track if we're editing an existing scheduled post
  const [editingPost, setEditingPost] = useState<EditingState | null>(null);

  // Get scheduled posts for the selected project
  const scheduledPostsForProject = useMemo(() => {
    if (!selectedProject) return [];
    return scheduledPosts.filter(post => post.projectId === selectedProject.id);
  }, [selectedProject, scheduledPosts]);

  // Compute scheduled count by project for badges
  const scheduledCountByProject = useMemo(() => {
    return scheduledPosts.reduce((acc, post) => {
      if (post.scheduleSlot.status === 'pending') {
        acc[post.projectId] = (acc[post.projectId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [scheduledPosts]);

  // Compute published count by project
  const publishedCountByProject = useMemo(() => {
    return scheduledPosts.reduce((acc, post) => {
      if (post.scheduleSlot.status === 'published') {
        acc[post.projectId] = (acc[post.projectId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [scheduledPosts]);

  // Handle draft creation from PostPreview
  const handleSaveDraft = useCallback((draft: {
    caption: string;
    hashtags: string[];
    selectedImages: string[];
  }) => {
    if (selectedProject) {
      setCurrentDraft({
        project: selectedProject,
        ...draft,
      });
    }
  }, [selectedProject]);

  // Handle scheduling a post (new or update existing)
  const handleSchedulePost = useCallback((date: Date, time: string) => {
    if (editingPost) {
      // Update existing draft
      updateDraft(editingPost.draftId, {
        caption: currentDraft?.caption || editingPost.caption,
        hashtags: currentDraft?.hashtags || editingPost.hashtags,
        selectedImages: currentDraft?.selectedImages || editingPost.selectedImages,
      });
      // Reschedule to the new date/time
      reschedulePost(editingPost.slotId, date, time);
      setEditingPost(null);
      setCurrentDraft(null);
      setSelectedProject(null);
    } else if (currentDraft) {
      // Create new draft and schedule it
      const savedDraft = saveDraft(
        currentDraft.project,
        currentDraft.caption,
        currentDraft.hashtags,
        currentDraft.selectedImages
      );
      schedulePost(savedDraft, date, time);
      setCurrentDraft(null);
      setSelectedProject(null);
    }
  }, [currentDraft, editingPost, saveDraft, schedulePost, updateDraft, reschedulePost]);

  // Handle saving changes to an edited post (without rescheduling)
  const handleSaveEditedPost = useCallback(() => {
    if (editingPost && currentDraft) {
      updateDraft(editingPost.draftId, {
        caption: currentDraft.caption,
        hashtags: currentDraft.hashtags,
        selectedImages: currentDraft.selectedImages,
      });
      setEditingPost(null);
      setCurrentDraft(null);
      setSelectedProject(null);
      setViewMode('schedule');
    }
  }, [editingPost, currentDraft, updateDraft]);

  // Handle editing a scheduled post
  const handleEditPost = useCallback((post: ScheduledPost) => {
    setSelectedProject(post.project);
    setCurrentDraft({
      project: post.project,
      caption: post.caption,
      hashtags: post.hashtags,
      selectedImages: post.selectedImages,
    });
    setEditingPost({
      draftId: post.id,
      slotId: post.scheduleSlot.id,
      project: post.project,
      caption: post.caption,
      hashtags: post.hashtags,
      selectedImages: post.selectedImages,
    });
    setViewMode('create');
  }, []);

  // Handle rescheduling
  const handleReschedulePost = useCallback((slotId: string, newDate: Date, newTime: string) => {
    reschedulePost(slotId, newDate, newTime);
  }, [reschedulePost]);

  // Clear current draft and editing state
  const handleClearDraft = useCallback(() => {
    setCurrentDraft(null);
    setEditingPost(null);
  }, []);

  // Cancel editing and go back to schedule
  const handleCancelEdit = useCallback(() => {
    setEditingPost(null);
    setCurrentDraft(null);
    setSelectedProject(null);
    setViewMode('schedule');
  }, []);

  return (
    <Layout onRefresh={refetch}>
      <div className="app-sidebar">
        <div className="view-mode-toggle">
          <button 
            className={`view-mode-button ${viewMode === 'create' ? 'active' : ''}`}
            onClick={() => setViewMode('create')}
          >
            ✏️ Create
          </button>
          <button 
            className={`view-mode-button ${viewMode === 'schedule' ? 'active' : ''}`}
            onClick={() => setViewMode('schedule')}
          >
            📅 Schedule ({scheduledPosts.filter(p => p.scheduleSlot.status === 'pending').length})
          </button>
        </div>
        <ProjectList
          projects={projects}
          isLoading={isLoading}
          error={error}
          filters={filters}
          selectedProject={selectedProject}
          onSelectProject={(project) => {
            setSelectedProject(project);
            setEditingPost(null); // Clear editing state when selecting a new project
            setCurrentDraft(null);
            setViewMode('create');
          }}
          scheduledCountByProject={scheduledCountByProject}
          publishedCountByProject={publishedCountByProject}
        />
      </div>
      <div className="app-content">
        {viewMode === 'create' ? (
          <PostPreview 
            project={selectedProject} 
            onSaveDraft={handleSaveDraft}
            currentDraft={currentDraft}
            onScheduleClick={() => setViewMode('schedule')}
            isEditing={!!editingPost}
            onSaveEdit={handleSaveEditedPost}
            onCancelEdit={handleCancelEdit}
            scheduledPostsForProject={scheduledPostsForProject}
            onEditScheduledPost={handleEditPost}
            onUnschedulePost={unschedulePost}
          />
        ) : (
          <SchedulePanel
            scheduledPosts={scheduledPosts}
            settings={settings}
            onSchedulePost={handleSchedulePost}
            onUnschedulePost={unschedulePost}
            onReschedulePost={handleReschedulePost}
            onEditPost={handleEditPost}
            currentDraft={currentDraft}
            onClearDraft={handleClearDraft}
          />
        )}
      </div>
    </Layout>
  );
}

export default App;
