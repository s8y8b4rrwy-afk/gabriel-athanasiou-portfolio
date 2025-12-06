import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { PostDraft, ScheduleSlot, ScheduleSettings } from '../types';
import type { Project } from '../types';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface DeletedIdEntry {
  id: string;
  deletedAt: string;
}

export interface DeletedIds {
  drafts: DeletedIdEntry[];
  scheduleSlots: DeletedIdEntry[];
  templates: DeletedIdEntry[];
}

interface UseScheduleReturn {
  scheduledPosts: ScheduledPost[];
  drafts: PostDraft[];
  scheduleSlots: ScheduleSlot[];
  settings: ScheduleSettings;
  deletedIds: DeletedIds;
  schedulePost: (draft: PostDraft, date: Date, time: string) => void;
  unschedulePost: (slotId: string) => void;
  reschedulePost: (slotId: string, newDate: Date, newTime: string) => void;
  saveDraft: (project: Project, caption: string, hashtags: string[], selectedImages: string[]) => PostDraft;
  deleteDraft: (draftId: string) => void;
  updateDraft: (draftId: string, updates: Partial<PostDraft>) => void;
  updateSettings: (updates: Partial<ScheduleSettings>) => void;
  getPostsForDate: (date: Date) => ScheduledPost[];
  getPostsForMonth: (year: number, month: number) => Map<string, ScheduledPost[]>;
  markAsPublished: (slotId: string, instagramPostId?: string, permalink?: string) => void;
  markAsFailed: (slotId: string, error: string) => void;
  importScheduleData: (drafts: PostDraft[], slots: ScheduleSlot[], settings: ScheduleSettings, deletedIds?: DeletedIds) => void;
}

const DEFAULT_SETTINGS: ScheduleSettings = {
  defaultTimes: ['11:00', '19:00'],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  maxPostsPerDay: 3,
};

const DEFAULT_DELETED_IDS: DeletedIds = {
  drafts: [],
  scheduleSlots: [],
  templates: [],
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to track a deletion
function trackDeletion(deletedIds: DeletedIds, type: keyof DeletedIds, id: string): DeletedIds {
  // Don't add duplicates
  if (deletedIds[type].some(d => d.id === id)) {
    return deletedIds;
  }
  return {
    ...deletedIds,
    [type]: [...deletedIds[type], { id, deletedAt: new Date().toISOString() }]
  };
}

export function useSchedule(): UseScheduleReturn {
  const [drafts, setDrafts] = useLocalStorage<PostDraft[]>('instagram-studio-drafts', []);
  const [scheduleSlots, setScheduleSlots] = useLocalStorage<ScheduleSlot[]>('instagram-studio-schedule', []);
  const [settings, setSettings] = useLocalStorage<ScheduleSettings>('instagram-studio-settings', DEFAULT_SETTINGS);
  const [deletedIds, setDeletedIds] = useLocalStorage<DeletedIds>('instagram-studio-deleted-ids', DEFAULT_DELETED_IDS);

  // Combine drafts with their schedule slots
  const scheduledPosts = useMemo((): ScheduledPost[] => {
    return scheduleSlots
      .map(slot => {
        const draft = drafts.find(d => d.id === slot.postDraftId);
        if (!draft) return null;
        return { ...draft, scheduleSlot: slot };
      })
      .filter((post): post is ScheduledPost => post !== null)
      .sort((a, b) => {
        const dateA = new Date(`${a.scheduleSlot.scheduledDate}T${a.scheduleSlot.scheduledTime}`);
        const dateB = new Date(`${b.scheduleSlot.scheduledDate}T${b.scheduleSlot.scheduledTime}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [drafts, scheduleSlots]);

  // Save a new draft
  const saveDraft = useCallback((
    project: Project,
    caption: string,
    hashtags: string[],
    selectedImages: string[]
  ): PostDraft => {
    const now = new Date().toISOString();
    const draft: PostDraft = {
      id: generateId(),
      projectId: project.id,
      project,
      caption,
      hashtags,
      selectedImages,
      createdAt: now,
      updatedAt: now,
    };
    setDrafts(prev => [...prev, draft]);
    return draft;
  }, [setDrafts]);

  // Delete a draft (and track deletion for cloud sync)
  const deleteDraft = useCallback((draftId: string) => {
    // Track the deletion for smart merge
    setDeletedIds(prev => trackDeletion(prev, 'drafts', draftId));
    // Also remove any schedule slots for this draft and track those deletions
    setScheduleSlots(prev => {
      const slotsToDelete = prev.filter(slot => slot.postDraftId === draftId);
      slotsToDelete.forEach(slot => {
        setDeletedIds(p => trackDeletion(p, 'scheduleSlots', slot.id));
      });
      return prev.filter(slot => slot.postDraftId !== draftId);
    });
    setDrafts(prev => prev.filter(d => d.id !== draftId));
  }, [setDrafts, setScheduleSlots, setDeletedIds]);

  // Update a draft
  const updateDraft = useCallback((draftId: string, updates: Partial<PostDraft>) => {
    setDrafts(prev => prev.map(d => {
      if (d.id === draftId) {
        return { ...d, ...updates, updatedAt: new Date().toISOString() };
      }
      return d;
    }));
  }, [setDrafts]);

  // Schedule a post
  const schedulePost = useCallback((draft: PostDraft, date: Date, time: string) => {
    const slot: ScheduleSlot = {
      id: generateId(),
      postDraftId: draft.id,
      scheduledDate: formatDateKey(date),
      scheduledTime: time,
      status: 'pending',
    };
    setScheduleSlots(prev => [...prev, slot]);
  }, [setScheduleSlots]);

  // Unschedule a post (and track deletion for cloud sync)
  const unschedulePost = useCallback((slotId: string) => {
    // Track the deletion for smart merge
    setDeletedIds(prev => trackDeletion(prev, 'scheduleSlots', slotId));
    setScheduleSlots(prev => prev.filter(slot => slot.id !== slotId));
  }, [setScheduleSlots, setDeletedIds]);

  // Reschedule a post
  const reschedulePost = useCallback((slotId: string, newDate: Date, newTime: string) => {
    setScheduleSlots(prev => prev.map(slot => {
      if (slot.id === slotId) {
        return {
          ...slot,
          scheduledDate: formatDateKey(newDate),
          scheduledTime: newTime,
        };
      }
      return slot;
    }));
  }, [setScheduleSlots]);

  // Get posts for a specific date
  const getPostsForDate = useCallback((date: Date): ScheduledPost[] => {
    const dateKey = formatDateKey(date);
    return scheduledPosts.filter(post => post.scheduleSlot.scheduledDate === dateKey);
  }, [scheduledPosts]);

  // Get posts for a month (returns a map of date -> posts)
  const getPostsForMonth = useCallback((year: number, month: number): Map<string, ScheduledPost[]> => {
    const result = new Map<string, ScheduledPost[]>();
    
    scheduledPosts.forEach(post => {
      const postDate = new Date(post.scheduleSlot.scheduledDate);
      if (postDate.getFullYear() === year && postDate.getMonth() === month) {
        const dateKey = post.scheduleSlot.scheduledDate;
        const existing = result.get(dateKey) || [];
        result.set(dateKey, [...existing, post]);
      }
    });
    
    return result;
  }, [scheduledPosts]);

  // Mark post as published
  const markAsPublished = useCallback((slotId: string, instagramPostId?: string, permalink?: string) => {
    setScheduleSlots(prev => prev.map(slot => {
      if (slot.id === slotId) {
        return { 
          ...slot, 
          status: 'published' as const,
          instagramPostId,
          instagramPermalink: permalink,
          publishedAt: new Date().toISOString(),
        };
      }
      return slot;
    }));
  }, [setScheduleSlots]);

  // Mark post as failed
  const markAsFailed = useCallback((slotId: string, _error: string) => {
    setScheduleSlots(prev => prev.map(slot => {
      if (slot.id === slotId) {
        return { ...slot, status: 'failed' as const };
      }
      return slot;
    }));
  }, [setScheduleSlots]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<ScheduleSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, [setSettings]);

  // Import schedule data from external source (Cloudinary/file)
  // Now also imports deletedIds for smart merge support
  const importScheduleData = useCallback((
    importedDrafts: PostDraft[],
    importedSlots: ScheduleSlot[],
    importedSettings: ScheduleSettings,
    importedDeletedIds?: DeletedIds
  ) => {
    setDrafts(importedDrafts);
    setScheduleSlots(importedSlots);
    setSettings(importedSettings);
    if (importedDeletedIds) {
      setDeletedIds(importedDeletedIds);
    }
  }, [setDrafts, setScheduleSlots, setSettings, setDeletedIds]);

  return {
    scheduledPosts,
    drafts,
    scheduleSlots,
    settings,
    deletedIds,
    schedulePost,
    unschedulePost,
    reschedulePost,
    saveDraft,
    deleteDraft,
    updateDraft,
    updateSettings,
    getPostsForDate,
    getPostsForMonth,
    markAsPublished,
    markAsFailed,
    importScheduleData,
  };
}
