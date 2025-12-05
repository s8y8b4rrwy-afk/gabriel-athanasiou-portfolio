import { useState, useCallback, useMemo } from 'react';
import { Layout, ProjectList, PostPreview, SchedulePanel, DndContext, SyncPanel, TemplateList, TemplateEditor } from './components';
import { useProjects, useSchedule, useCloudinarySync, useTemplates } from './hooks';
import { generateCaption } from './utils/generateCaption';
import { generateHashtags } from './utils/generateHashtags';
import type { Project, PostDraft, ScheduleSlot, RecurringTemplate, ScheduleSettings } from './types';
import type { ScheduleData } from './services/cloudinarySync';
import './App.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

type ViewMode = 'create' | 'schedule' | 'templates' | 'sync';

interface EditingState {
  draftId: string;
  slotId: string;
  project: Project;
  caption: string;
  hashtags: string[];
  selectedImages: string[];
  scheduledDate: string;
  scheduledTime: string;
}

function App() {
  const { projects, isLoading, error, filters, refetch } = useProjects({
    showOnlyWithImages: true,
  });
  
  const {
    scheduledPosts,
    drafts,
    scheduleSlots,
    settings,
    schedulePost,
    unschedulePost,
    reschedulePost,
    saveDraft,
    updateDraft,
    importScheduleData,
  } = useSchedule();

  // Template management
  const {
    templates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    toggleTemplateActive,
  } = useTemplates();

  const [selectedTemplate, setSelectedTemplate] = useState<RecurringTemplate | null>(null);
  
  // Cloudinary sync
  const handleImportScheduleData = useCallback((data: ScheduleData) => {
    importScheduleData(data.drafts, data.scheduleSlots, data.settings);
  }, [importScheduleData]);

  const {
    isSyncing,
    lastSyncedAt,
    syncError,
    syncToCloudinary,
    fetchFromCloudinary,
    exportAsJson,
    exportAsCsv,
    importFromFile,
    autoSync,
    setAutoSync,
  } = useCloudinarySync({
    drafts,
    scheduleSlots,
    settings,
    onImport: handleImportScheduleData,
  });
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('create');
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>('schedule');
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

  // Handle saving changes to an edited post (with optional time change)
  const handleSaveEditedPost = useCallback((newTime?: string) => {
    if (editingPost && currentDraft) {
      updateDraft(editingPost.draftId, {
        caption: currentDraft.caption,
        hashtags: currentDraft.hashtags,
        selectedImages: currentDraft.selectedImages,
      });
      // If time changed, reschedule the post
      if (newTime && newTime !== editingPost.scheduledTime) {
        reschedulePost(
          editingPost.slotId, 
          new Date(editingPost.scheduledDate), 
          newTime
        );
      }
      setEditingPost(null);
      setCurrentDraft(null);
      setSelectedProject(null);
      setViewMode(previousViewMode);
    }
  }, [editingPost, currentDraft, updateDraft, reschedulePost, previousViewMode]);

  // Handle editing a scheduled post
  const handleEditPost = useCallback((post: ScheduledPost) => {
    setPreviousViewMode(viewMode); // Remember where we came from
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
      scheduledDate: post.scheduleSlot.scheduledDate,
      scheduledTime: post.scheduleSlot.scheduledTime,
    });
    setViewMode('create');
  }, [viewMode]);

  // Handle rescheduling
  const handleReschedulePost = useCallback((slotId: string, newDate: Date, newTime: string) => {
    reschedulePost(slotId, newDate, newTime);
  }, [reschedulePost]);

  // Clear current draft and editing state
  const handleClearDraft = useCallback(() => {
    setCurrentDraft(null);
    setEditingPost(null);
  }, []);

  // Cancel editing and go back to previous view
  const handleCancelEdit = useCallback(() => {
    setEditingPost(null);
    setCurrentDraft(null);
    setSelectedProject(null);
    setViewMode(previousViewMode);
  }, [previousViewMode]);

  // Handle dropping a project onto a calendar day (drag & drop)
  const handleDropProjectOnDate = useCallback((project: Project, date: Date) => {
    const caption = generateCaption(project);
    const hashtags = generateHashtags(project);
    const selectedImages = project.heroImage 
      ? [project.heroImage] 
      : project.gallery.slice(0, 1);
    
    const savedDraft = saveDraft(project, caption, hashtags, selectedImages);
    schedulePost(savedDraft, date, settings.defaultTimes[0] || '11:00');
  }, [saveDraft, schedulePost, settings.defaultTimes]);

  // Template handlers
  const handleCreateTemplate = useCallback(() => {
    const template = createTemplate();
    setSelectedTemplate(template);
  }, [createTemplate]);

  const handleSaveTemplate = useCallback((updates: Partial<RecurringTemplate>) => {
    if (selectedTemplate) {
      updateTemplate(selectedTemplate.id, updates);
      setSelectedTemplate(null);
    }
  }, [selectedTemplate, updateTemplate]);

  const handleDeleteTemplate = useCallback(() => {
    if (selectedTemplate) {
      deleteTemplate(selectedTemplate.id);
      setSelectedTemplate(null);
    }
  }, [selectedTemplate, deleteTemplate]);

  return (
    <DndContext>
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
            <button 
              className={`view-mode-button ${viewMode === 'templates' ? 'active' : ''}`}
              onClick={() => setViewMode('templates')}
            >
              📝 Templates
            </button>
            <button 
              className={`view-mode-button ${viewMode === 'sync' ? 'active' : ''}`}
              onClick={() => setViewMode('sync')}
            >
              ☁️ Sync
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
              setEditingPost(null);
              setCurrentDraft(null);
              setViewMode('create');
            }}
            scheduledCountByProject={scheduledCountByProject}
            publishedCountByProject={publishedCountByProject}
            enableDragDrop={viewMode === 'schedule'}
          />
        </div>
        <div className="app-content">
          {viewMode === 'create' && (
            <PostPreview 
              project={selectedProject} 
              onSaveDraft={handleSaveDraft}
              currentDraft={currentDraft}
              onScheduleClick={() => setViewMode('schedule')}
              isEditing={!!editingPost}
              editingScheduleInfo={editingPost ? {
                scheduledDate: editingPost.scheduledDate,
                scheduledTime: editingPost.scheduledTime,
              } : null}
              onSaveEdit={handleSaveEditedPost}
              onCancelEdit={handleCancelEdit}
              scheduledPostsForProject={scheduledPostsForProject}
              onEditScheduledPost={handleEditPost}
              onUnschedulePost={unschedulePost}
              templates={templates}
            />
          )}
          {viewMode === 'schedule' && (
            <SchedulePanel
              scheduledPosts={scheduledPosts}
              settings={settings}
              onSchedulePost={handleSchedulePost}
              onUnschedulePost={unschedulePost}
              onReschedulePost={handleReschedulePost}
              onEditPost={handleEditPost}
              currentDraft={currentDraft}
              onClearDraft={handleClearDraft}
              onDropProject={handleDropProjectOnDate}
              enableDragDrop={true}
            />
          )}
          {viewMode === 'templates' && (
            selectedTemplate ? (
              <TemplateEditor
                template={selectedTemplate}
                onSave={handleSaveTemplate}
                onCancel={() => setSelectedTemplate(null)}
                onDelete={handleDeleteTemplate}
              />
            ) : (
              <TemplateList
                templates={templates}
                onSelect={setSelectedTemplate}
                onToggleActive={toggleTemplateActive}
                onDuplicate={duplicateTemplate}
                onCreate={handleCreateTemplate}
              />
            )
          )}
          {viewMode === 'sync' && (
            <SyncPanel
              isSyncing={isSyncing}
              lastSyncedAt={lastSyncedAt}
              syncError={syncError}
              autoSync={autoSync}
              onSyncToCloud={syncToCloudinary}
              onFetchFromCloud={fetchFromCloudinary}
              onExportJson={exportAsJson}
              onExportCsv={exportAsCsv}
              onImportFile={importFromFile}
              onToggleAutoSync={setAutoSync}
            />
          )}
        </div>
      </Layout>
    </DndContext>
  );
}

export default App;
