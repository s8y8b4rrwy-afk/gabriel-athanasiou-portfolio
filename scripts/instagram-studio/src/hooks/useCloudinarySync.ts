import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchScheduleFromCloudinary,
  uploadScheduleToCloudinary,
  exportScheduleAsJson,
  exportScheduleAsCsv,
  importScheduleFromFile,
  type ScheduleData,
} from '../services/cloudinarySync';
import type { PostDraft, ScheduleSlot, ScheduleSettings } from '../types';
import type { RecurringTemplate } from '../types/template';
import type { InstagramCredentials } from '../types/instagram';

interface DeletedIds {
  drafts: { id: string; deletedAt: string }[];
  scheduleSlots: { id: string; deletedAt: string }[];
  templates: { id: string; deletedAt: string }[];
}

interface UseCloudinarySyncOptions {
  drafts: PostDraft[];
  scheduleSlots: ScheduleSlot[];
  settings: ScheduleSettings;
  templates: RecurringTemplate[];
  defaultTemplate: RecurringTemplate;
  instagramCredentials: InstagramCredentials | null;
  deletedIds?: DeletedIds;
  onImport: (data: ScheduleData) => void;
}

interface UseCloudinarySyncReturn {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  syncSuccess: string | null;
  syncToCloudinary: () => Promise<boolean>;
  fetchFromCloudinary: () => Promise<boolean>;
  exportAsJson: () => void;
  exportAsCsv: () => void;
  importFromFile: (file: File) => Promise<boolean>;
  autoSync: boolean;
  setAutoSync: (value: boolean) => void;
}

export function useCloudinarySync({
  drafts,
  scheduleSlots,
  settings,
  templates,
  defaultTemplate,
  instagramCredentials,
  deletedIds,
  onImport,
}: UseCloudinarySyncOptions): UseCloudinarySyncReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return localStorage.getItem('instagram-studio-last-sync');
  });
  const [autoSync, setAutoSyncState] = useState<boolean>(() => {
    return localStorage.getItem('instagram-studio-auto-sync') === 'true';
  });
  
  // Track when we just synced to prevent auto-sync loop
  const justSyncedRef = useRef(false);
  // Track the last sync timestamp to debounce properly
  const lastSyncTimeRef = useRef(0);

  const setAutoSync = useCallback((value: boolean) => {
    setAutoSyncState(value);
    localStorage.setItem('instagram-studio-auto-sync', String(value));
  }, []);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (syncSuccess) {
      const timeout = setTimeout(() => setSyncSuccess(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [syncSuccess]);

  const syncToCloudinary = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent syncs and rapid re-syncs
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 3000) {
      console.log('⏳ Skipping sync - too soon after last sync');
      return true; // Return true to prevent error handling
    }
    
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    lastSyncTimeRef.current = now;

    try {
      // Smart merge: fetch cloud data, merge with local, upload merged result
      const result = await uploadScheduleToCloudinary(
        drafts, 
        scheduleSlots, 
        settings, 
        templates, 
        defaultTemplate, 
        instagramCredentials,
        deletedIds
      );
      
      if (result.success) {
        const syncTime = new Date().toISOString();
        setLastSyncedAt(syncTime);
        localStorage.setItem('instagram-studio-last-sync', syncTime);
        
        // NOTE: We do NOT call onImport here anymore!
        // The local state is the source of truth during a sync.
        // The merge happens server-side, and we trust that our local changes
        // were included in the upload. Calling onImport here would overwrite
        // any state changes made AFTER the sync started (race condition).
        // 
        // If you need to sync FROM cloud, use fetchFromCloudinary explicitly.
        if (result.mergeStats) {
          setSyncSuccess(`✅ Synced! ${result.mergeStats}`);
        } else {
          setSyncSuccess('✅ Data synced to cloud successfully!');
        }
        return true;
      } else {
        setSyncError(result.error || 'Upload failed');
        return false;
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [drafts, scheduleSlots, settings, templates, defaultTemplate, instagramCredentials, deletedIds, onImport]);

  const fetchFromCloudinary = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const data = await fetchScheduleFromCloudinary();
      
      if (data) {
        onImport(data);
        setSyncSuccess('✅ Data fetched from cloud successfully!');
        return true;
      } else {
        // No data found - show helpful message
        setSyncError('No data in cloud yet. Click "Sync to Cloud" first to upload your data.');
        return false;
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [onImport]);

  const exportAsJson = useCallback(() => {
    exportScheduleAsJson(drafts, scheduleSlots, settings, templates, defaultTemplate, instagramCredentials, deletedIds);
  }, [drafts, scheduleSlots, settings, templates, defaultTemplate, instagramCredentials, deletedIds]);

  const exportAsCsv = useCallback(() => {
    exportScheduleAsCsv(drafts, scheduleSlots);
  }, [drafts, scheduleSlots]);

  const importFromFile = useCallback(async (file: File): Promise<boolean> => {
    const data = await importScheduleFromFile(file);
    
    if (data) {
      onImport(data);
      return true;
    }
    return false;
  }, [onImport]);

  // Auto-sync on changes (debounced) - only for user-initiated changes
  useEffect(() => {
    // Skip if auto-sync is disabled, no data, or we just synced
    if (!autoSync || drafts.length === 0 || justSyncedRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      // Double-check we didn't just sync
      if (!justSyncedRef.current) {
        console.log('🔄 Auto-syncing changes...');
        syncToCloudinary();
      }
    }, 5000); // 5 second debounce

    return () => clearTimeout(timeoutId);
  }, [autoSync, drafts, scheduleSlots, settings, templates, defaultTemplate, instagramCredentials, deletedIds, syncToCloudinary]);

  return {
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
  };
}
