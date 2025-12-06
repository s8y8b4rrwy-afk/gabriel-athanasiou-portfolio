import { useState, useCallback, useMemo, useEffect } from 'react';
import { Layout, ProjectList, PostPreview, SchedulePanel, DndContext, SyncPanel, TemplateList, TemplateEditor, AuthCallback, InstagramConnect } from './components';
import { useProjects, useSchedule, useCloudinarySync, useTemplates } from './hooks';
import { generateCaption } from './utils/generateCaption';
import { generateHashtags } from './utils/generateHashtags';
import { applyTemplateToProject, getHashtagsFromGroups, HashtagGroupKey } from './types/template';
import { getCredentialsLocally, saveCredentialsLocally } from './services/instagramApi';
import type { Project, PostDraft, ScheduleSlot, RecurringTemplate, ScheduleSettings, InstagramCredentials } from './types';
import type { ScheduleData } from './services/cloudinarySync';
import './App.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

type ViewMode = 'create' | 'schedule' | 'templates' | 'sync' | 'settings';

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
    markAsPublished,
  } = useSchedule();

  // Template management
  const {
    templates,
    defaultTemplate,
    createTemplate,
    updateTemplate,
    updateDefaultTemplate,
    deleteTemplate,
    duplicateTemplate,
    importTemplates,
  } = useTemplates();

  const [selectedTemplate, setSelectedTemplate] = useState<RecurringTemplate | null>(null);
  
  // Instagram credentials - must be declared early as it's used by cloud sync
  const [instagramCredentials, setInstagramCredentials] = useState<InstagramCredentials | null>(() => {
    // Initialize from localStorage on mount
    return getCredentialsLocally();
  });
  
  // Cloudinary sync - handle importing all data including templates and Instagram credentials
  const handleImportScheduleData = useCallback((data: ScheduleData) => {
    // Import schedule data
    importScheduleData(data.drafts, data.scheduleSlots, data.settings);
    // Import templates if present
    if (data.templates || data.defaultTemplate) {
      importTemplates(data.templates || [], data.defaultTemplate);
    }
    // Import Instagram credentials if present (for persistence across sessions)
    if (data.instagram && data.instagram.accessToken) {
      console.log('📷 Restoring Instagram credentials from cloud...');
      saveCredentialsLocally(data.instagram);
      setInstagramCredentials(data.instagram);
    }
  }, [importScheduleData, importTemplates]);

  const {
    isSyncing,
    lastSyncedAt,
    syncError,
    syncSuccess,
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
    templates,
    defaultTemplate,
    instagramCredentials,
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
  const [hasInitializedFromCloud, setHasInitializedFromCloud] = useState(false);
  
  // Track if we're editing an existing scheduled post
  const [editingPost, setEditingPost] = useState<EditingState | null>(null);

  // Instagram OAuth callback check
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasCode = urlParams.has('code');
    const hasError = urlParams.has('error');
    setIsOAuthCallback(hasCode || hasError);
  }, []);

  // Fetch from Cloudinary on initial load
  useEffect(() => {
    if (!hasInitializedFromCloud) {
      setHasInitializedFromCloud(true);
      // Only auto-fetch if we don't have local data or if auto-sync is enabled
      const hasLocalData = drafts.length > 0 || scheduleSlots.length > 0;
      const shouldAutoFetch = autoSync || !hasLocalData;
      
      if (shouldAutoFetch) {
        console.log('🔄 Fetching data from Cloudinary on boot...');
        fetchFromCloudinary().then(success => {
          if (success) {
            console.log('✅ Successfully loaded data from Cloudinary');
          } else {
            console.log('ℹ️ No data found in Cloudinary or fetch failed');
          }
        });
      }
    }
  }, [hasInitializedFromCloud, autoSync, drafts.length, scheduleSlots.length, fetchFromCloudinary]);

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
  // Saves and exits editing mode
  const handleSaveEditedPost = useCallback((draft: { caption: string; hashtags: string[]; selectedImages: string[] }, newTime?: string) => {
    if (editingPost) {
      updateDraft(editingPost.draftId, {
        caption: draft.caption,
        hashtags: draft.hashtags,
        selectedImages: draft.selectedImages,
      });
      // If time changed, reschedule the post
      if (newTime && newTime !== editingPost.scheduledTime) {
        reschedulePost(
          editingPost.slotId, 
          new Date(editingPost.scheduledDate), 
          newTime
        );
      }
      // Exit editing mode and go back to previous view
      const projectToKeep = editingPost.project;
      setEditingPost(null);
      setCurrentDraft(null);
      // If we came from create view, keep the project selected
      if (previousViewMode === 'create') {
        setSelectedProject(projectToKeep);
      } else {
        setSelectedProject(null);
        setViewMode(previousViewMode);
      }
    }
  }, [editingPost, updateDraft, reschedulePost, previousViewMode]);

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

  // Handle publish success from SchedulePanel/Queue - mark post as published
  const handleSchedulePublishSuccess = useCallback((slotId: string, instagramPostId?: string, permalink?: string) => {
    markAsPublished(slotId, instagramPostId, permalink);
    // Always sync to Cloudinary after successful publish
    syncToCloudinary();
  }, [markAsPublished, syncToCloudinary]);

  // Handle publish success from PostPreview (when editing a scheduled post)
  const handlePreviewPublishSuccess = useCallback((result: { instagramPostId?: string; permalink?: string }) => {
    // If we're editing a scheduled post, mark it as published
    if (editingPost?.slotId) {
      markAsPublished(editingPost.slotId, result.instagramPostId, result.permalink);
      // Always sync to Cloudinary after successful publish
      syncToCloudinary();
      setEditingPost(null);
      setCurrentDraft(null);
      setSelectedProject(null);
      setViewMode(previousViewMode);
    }
  }, [editingPost, markAsPublished, syncToCloudinary, previousViewMode]);

  // Debug: Manual mark as published (for fixing out-of-sync data)
  const handleDebugMarkAsPublished = useCallback((slotId: string) => {
    markAsPublished(slotId, `debug-${Date.now()}`, undefined);
    // Sync immediately
    syncToCloudinary();
    console.log('🔧 Debug: Marked slot as published:', slotId);
  }, [markAsPublished, syncToCloudinary]);

  // Clear current draft and editing state
  const handleClearDraft = useCallback(() => {
    setCurrentDraft(null);
    setEditingPost(null);
  }, []);

  // Cancel editing and go back to previous view
  const handleCancelEdit = useCallback(() => {
    const projectToKeep = editingPost?.project;
    setEditingPost(null);
    setCurrentDraft(null);
    
    // If we came from create view (viewing a project), keep that project selected
    // Otherwise (came from schedule/queue), clear selection and go back
    if (previousViewMode === 'create' && projectToKeep) {
      setSelectedProject(projectToKeep);
      // Stay in create view, but now viewing the project (not editing)
    } else {
      setSelectedProject(null);
      setViewMode(previousViewMode);
    }
  }, [previousViewMode, editingPost]);

  // Handle dropping a project onto a calendar day (drag & drop)
  const handleDropProjectOnDate = useCallback((project: Project, date: Date, time: string, template?: RecurringTemplate) => {
    // Use template if provided, otherwise fall back to defaults
    let caption: string;
    let hashtags: string[];
    
    if (template) {
      caption = applyTemplateToProject(template.captionTemplate, project);
      hashtags = getHashtagsFromGroups(template.hashtagGroups as HashtagGroupKey[]);
    } else {
      caption = generateCaption(project);
      hashtags = generateHashtags(project);
    }
    
    // Include all available images (hero + gallery), up to Instagram's limit of 10
    const allImages = [
      ...(project.heroImage ? [project.heroImage] : []),
      ...project.gallery
    ];
    // Remove duplicates (in case hero is also in gallery) and limit to 10
    const uniqueImages = [...new Set(allImages)].slice(0, 10);
    const selectedImages = uniqueImages.length > 0 ? uniqueImages : project.gallery.slice(0, 1);
    
    const savedDraft = saveDraft(project, caption, hashtags, selectedImages);
    schedulePost(savedDraft, date, time);
  }, [saveDraft, schedulePost]);

  // Template handlers
  const handleCreateTemplate = useCallback(() => {
    const template = createTemplate();
    setSelectedTemplate(template);
  }, [createTemplate]);

  const handleSaveTemplate = useCallback((updates: Partial<RecurringTemplate>) => {
    if (selectedTemplate) {
      if (selectedTemplate.id === 'default') {
        updateDefaultTemplate(updates);
      } else {
        updateTemplate(selectedTemplate.id, updates);
      }
      setSelectedTemplate(null);
    }
  }, [selectedTemplate, updateTemplate, updateDefaultTemplate]);

  const handleDeleteTemplate = useCallback(() => {
    if (selectedTemplate && selectedTemplate.id !== 'default') {
      deleteTemplate(selectedTemplate.id);
      setSelectedTemplate(null);
    }
  }, [selectedTemplate, deleteTemplate]);

  // OAuth callback handlers
  const handleOAuthSuccess = useCallback((credentials: InstagramCredentials) => {
    setInstagramCredentials(credentials);
    setIsOAuthCallback(false);
    setViewMode('settings');
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const handleOAuthError = useCallback((error: string) => {
    console.error('OAuth error:', error);
    setIsOAuthCallback(false);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const handleOAuthCancel = useCallback(() => {
    setIsOAuthCallback(false);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  // Show OAuth callback UI if we're handling a redirect
  if (isOAuthCallback) {
    return (
      <AuthCallback
        onSuccess={handleOAuthSuccess}
        onError={handleOAuthError}
        onCancel={handleOAuthCancel}
      />
    );
  }

  const pendingCount = scheduledPosts.filter(p => p.scheduleSlot.status === 'pending').length;

  return (
    <DndContext>
      <Layout 
        onRefresh={refetch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        pendingCount={pendingCount}
        isConnected={instagramCredentials?.connected}
      >
        <div className="app-sidebar">
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
              onPublishSuccess={handlePreviewPublishSuccess}
              templates={templates}
              defaultTemplate={defaultTemplate}
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
              onPublishSuccess={handleSchedulePublishSuccess}
              onMarkAsPublished={handleDebugMarkAsPublished}
              currentDraft={currentDraft}
              onClearDraft={handleClearDraft}
              onDropProject={handleDropProjectOnDate}
              enableDragDrop={true}
              templates={templates}
              defaultTemplate={defaultTemplate}
            />
          )}
          {viewMode === 'templates' && (
            selectedTemplate ? (
              <TemplateEditor
                template={selectedTemplate}
                onSave={handleSaveTemplate}
                onCancel={() => setSelectedTemplate(null)}
                onDelete={selectedTemplate.id !== 'default' ? handleDeleteTemplate : undefined}
              />
            ) : (
              <TemplateList
                templates={templates}
                defaultTemplate={defaultTemplate}
                onSelect={setSelectedTemplate}
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
              syncSuccess={syncSuccess}
              autoSync={autoSync}
              onSyncToCloud={syncToCloudinary}
              onFetchFromCloud={fetchFromCloudinary}
              onExportJson={exportAsJson}
              onExportCsv={exportAsCsv}
              onImportFile={importFromFile}
              onToggleAutoSync={setAutoSync}
            />
          )}
          {viewMode === 'settings' && (
            <div className="settings-panel">
              <h2>Settings</h2>
              <InstagramConnect
                credentials={instagramCredentials}
                onCredentialsChange={setInstagramCredentials}
              />
            </div>
          )}
        </div>
      </Layout>
    </DndContext>
  );
}

export default App;
