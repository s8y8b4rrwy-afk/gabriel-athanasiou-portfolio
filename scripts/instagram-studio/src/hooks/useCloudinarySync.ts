import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchScheduleFromCloudinary,
  uploadScheduleToCloudinary,
  exportScheduleAsJson,
  exportScheduleAsCsv,
  importScheduleFromFile,
  type ScheduleData,
} from '../services/cloudinarySync';
import type { PostDraft, ScheduleSlot, ScheduleSettings, Project } from '../types';
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
  projects?: Project[]; // For CSV export project lookup
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
  projects,
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
  
  // Create a stable hash of the data for auto-sync comparison
  const dataHashRef = useRef<string>('');

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
      // Read deletedIds fresh from localStorage to ensure we have the LATEST value
      // React state closures can be stale, but localStorage is always current
      const storedDeletedIds = localStorage.getItem('instagram-studio-deleted-ids');
      const freshDeletedIds = storedDeletedIds 
        ? JSON.parse(storedDeletedIds) 
        : { drafts: [], scheduleSlots: [], templates: [] };
      
      console.log('🔄 Syncing with deletedIds:', {
        drafts: freshDeletedIds.drafts?.length || 0,
        scheduleSlots: freshDeletedIds.scheduleSlots?.length || 0,
        templates: freshDeletedIds.templates?.length || 0,
      });

      // Smart merge: fetch cloud data, merge with local, upload merged result
      const result = await uploadScheduleToCloudinary(
        drafts, 
        scheduleSlots, 
        settings, 
        templates, 
        defaultTemplate, 
        instagramCredentials,
        freshDeletedIds // Use fresh localStorage value instead of potentially stale state
      );
      
      if (result.success) {
        const syncTime = new Date().toISOString();
        setLastSyncedAt(syncTime);
        localStorage.setItem('instagram-studio-last-sync', syncTime);
        
        // Mark that we just synced to prevent auto-sync loop
        justSyncedRef.current = true;
        console.log('🔒 justSyncedRef set to true (will reset in 10s)');
        setTimeout(() => { 
          justSyncedRef.current = false; 
          console.log('🔓 justSyncedRef reset to false - auto-sync now allowed');
        }, 10000); // Reset after 10s
        
        // Update the data hash after successful sync (use fresh deletedIds)
        dataHashRef.current = JSON.stringify({
          drafts: drafts.map(d => ({ id: d.id, updatedAt: d.updatedAt })),
          scheduleSlots: scheduleSlots.map(s => ({ id: s.id, status: s.status, scheduledDate: s.scheduledDate, scheduledTime: s.scheduledTime })),
          settings,
          templates: templates.map(t => ({ id: t.id, updatedAt: t.updatedAt })),
          defaultTemplate: defaultTemplate?.id,
          instagramCredentials: instagramCredentials?.accountId,
          deletedIds: freshDeletedIds, // Use fresh localStorage value
        });
        
        // Update local state with the merged result
        // This ensures local state reflects the smart merge (cloud + local combined)
        if (result.mergedData) {
          onImport(result.mergedData);
        }
        
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
    exportScheduleAsCsv(drafts, scheduleSlots, projects);
  }, [drafts, scheduleSlots, projects]);

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
    if (!autoSync) {
      // Only log once on mount, not every render
      return;
    }
    if (drafts.length === 0) {
      return;
    }
    if (justSyncedRef.current) {
      console.log('⏭️ Auto-sync skipped: just synced (will reset in a few seconds)');
      return;
    }

    // Create a hash of the current data to detect actual changes
    const currentHash = JSON.stringify({
      drafts: drafts.map(d => ({ id: d.id, updatedAt: d.updatedAt })),
      scheduleSlots: scheduleSlots.map(s => ({ id: s.id, status: s.status, scheduledDate: s.scheduledDate, scheduledTime: s.scheduledTime })),
      settings,
      templates: templates.map(t => ({ id: t.id, updatedAt: t.updatedAt })),
      defaultTemplate: defaultTemplate?.id,
      instagramCredentials: instagramCredentials?.accountId,
      deletedIds,
    });
    
    // Skip if nothing actually changed
    if (currentHash === dataHashRef.current) {
      return;
    }
    
    console.log('⏳ Data changed! Auto-sync scheduled in 5 seconds...');

    const timeoutId = setTimeout(() => {
      // Double-check we didn't just sync and data actually changed
      if (justSyncedRef.current) {
        console.log('⏭️ Auto-sync cancelled: a sync just happened');
        return;
      }
      if (currentHash === dataHashRef.current) {
        console.log('⏭️ Auto-sync cancelled: data unchanged');
        return;
      }
      console.log('🔄 Auto-syncing changes now...');
      dataHashRef.current = currentHash; // Update hash before sync
      syncToCloudinary();
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
