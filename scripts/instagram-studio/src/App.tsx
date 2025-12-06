import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Layout, ProjectList, PostPreview, SchedulePanel, DndContext, SyncPanel, TemplateList, TemplateEditor, AuthCallback, InstagramConnect } from './components';
import { useProjects, useSchedule, useCloudinarySync, useTemplates } from './hooks';
import { generateCaption } from './utils/generateCaption';
import { generateHashtags } from './utils/generateHashtags';
import { applyTemplateToProject, getHashtagsFromGroups, HashtagGroupKey } from './types/template';
import { getCredentialsLocally, saveCredentialsLocally } from './services/instagramApi';
import type { Project, PostDraft, ScheduleSlot, RecurringTemplate, ScheduleSettings, InstagramCredentials, ImageDisplayMode } from './types';
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
  imageMode?: ImageDisplayMode;
  scheduledDate: string;
  scheduledTime: string;
}

function App() {
  const { projects, isLoading, error, filters, refetch } = useProjects({
    showOnlyWithImages: true,
  });
  
  const {
    scheduledPosts: rawScheduledPosts,
    drafts,
    scheduleSlots,
    settings,
    deletedIds,
    schedulePost,
    unschedulePost,
    reschedulePost,
    saveDraft,
    updateDraft,
    importScheduleData,
    markAsPublished,
  } = useSchedule();

  // Enhance scheduled posts with project data lookup (for cloud-synced posts missing project info)
  const scheduledPosts = useMemo(() => {
    return rawScheduledPosts.map(post => {
      // If project data is already present, return as-is
      if (post.project?.title) {
        return post;
      }
      // Look up project by projectId
      const projectFromList = projects.find(p => p.id === post.projectId);
      if (projectFromList) {
        return { ...post, project: projectFromList };
      }
      // Create stub project if project not found (deleted/hidden project)
      // This prevents crashes and shows meaningful info
      const stubProject = {
        id: post.projectId,
        title: `Project ${post.projectId?.slice(-6) || 'Unknown'}`,
        year: '',
        gallery: post.selectedImages || [],
        type: 'unknown' as const,
        slug: '',
        kinds: [],
        genre: [],
        productionCompany: '',
        client: '',
        releaseDate: '',
        workDate: '',
        description: '',
        isFeatured: false,
        isHero: false,
        heroImage: post.selectedImages?.[0] || '',
        videoUrl: '',
        additionalVideos: [],
        awards: [],
        credits: [],
        externalLinks: [],
        relatedArticleId: null,
      };
      return { ...post, project: stubProject };
    });
  }, [rawScheduledPosts, projects]);

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
    // Import schedule data (including deletedIds for smart merge)
    importScheduleData(data.drafts, data.scheduleSlots, data.settings, data.deletedIds);
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
    deletedIds,
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
    imageMode?: ImageDisplayMode;
  } | null>(null);
  const hasInitializedFromCloudRef = useRef(false);
  
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

  // Sync with Cloudinary on initial load - smart merge to get latest data
  // Use ref to prevent re-running when callbacks are recreated
  useEffect(() => {
    if (hasInitializedFromCloudRef.current) return;
    hasInitializedFromCloudRef.current = true;
    
    // Smart merge sync: fetches cloud, merges with local, uploads merged, updates local
    // This ensures we're up to date with cloud while preserving any local changes
    console.log('🔄 Smart sync with Cloudinary on boot...');
    syncToCloudinary().then(success => {
      if (success) {
        console.log('✅ Successfully synced with Cloudinary');
      } else {
        // If sync failed, try just fetching
        console.log('⚠️ Sync failed, trying fetch only...');
        fetchFromCloudinary().then(fetchSuccess => {
          if (fetchSuccess) {
            console.log('✅ Successfully loaded data from Cloudinary');
          } else {
            console.log('ℹ️ No data found in Cloudinary or fetch failed, using local data');
          }
        });
      }
    });
  }, []); // Empty deps - only run once on mount

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
    imageMode?: ImageDisplayMode;
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
      // Update existing draft (including imageMode if changed)
      updateDraft(editingPost.draftId, {
        caption: currentDraft?.caption || editingPost.caption,
        hashtags: currentDraft?.hashtags || editingPost.hashtags,
        selectedImages: currentDraft?.selectedImages || editingPost.selectedImages,
        imageMode: currentDraft?.imageMode,
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
        currentDraft.selectedImages,
        currentDraft.imageMode
      );
      schedulePost(savedDraft, date, time);
      setCurrentDraft(null);
      setSelectedProject(null);
    }
  }, [currentDraft, editingPost, saveDraft, schedulePost, updateDraft, reschedulePost]);

  // Handle saving changes to an edited post (with optional time change)
  // Saves and exits editing mode
  const handleSaveEditedPost = useCallback((draft: { caption: string; hashtags: string[]; selectedImages: string[]; imageMode?: ImageDisplayMode }, newTime?: string) => {
    if (editingPost) {
      updateDraft(editingPost.draftId, {
        caption: draft.caption,
        hashtags: draft.hashtags,
        selectedImages: draft.selectedImages,
        imageMode: draft.imageMode,
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
      imageMode: post.imageMode,
    });
    setEditingPost({
      draftId: post.id,
      slotId: post.scheduleSlot.id,
      project: post.project,
      caption: post.caption,
      hashtags: post.hashtags,
      selectedImages: post.selectedImages,
      imageMode: post.imageMode,
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
    // Delay sync to allow React state to update first
    // The auto-sync will handle it, but we also trigger a manual sync after delay
    setTimeout(() => {
      syncToCloudinary();
      console.log('🔧 Debug: Marked slot as published and synced:', slotId);
    }, 100);
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
        isSyncing={isSyncing}
        syncSuccess={syncSuccess}
        syncError={syncError}
        lastSyncedAt={lastSyncedAt}
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
