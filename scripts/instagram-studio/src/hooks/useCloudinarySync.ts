import { useState, useCallback, useEffect } from 'react';
import {
  fetchScheduleFromCloudinary,
  uploadScheduleToCloudinary,
  exportScheduleAsJson,
  exportScheduleAsCsv,
  importScheduleFromFile,
  type ScheduleData,
} from '../services/cloudinarySync';
import type { PostDraft, ScheduleSlot, ScheduleSettings } from '../types';

interface UseCloudinarySyncOptions {
  drafts: PostDraft[];
  scheduleSlots: ScheduleSlot[];
  settings: ScheduleSettings;
  onImport: (data: ScheduleData) => void;
}

interface UseCloudinarySyncReturn {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
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
  onImport,
}: UseCloudinarySyncOptions): UseCloudinarySyncReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return localStorage.getItem('instagram-studio-last-sync');
  });
  const [autoSync, setAutoSyncState] = useState<boolean>(() => {
    return localStorage.getItem('instagram-studio-auto-sync') === 'true';
  });

  const setAutoSync = useCallback((value: boolean) => {
    setAutoSyncState(value);
    localStorage.setItem('instagram-studio-auto-sync', String(value));
  }, []);

  const syncToCloudinary = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await uploadScheduleToCloudinary(drafts, scheduleSlots, settings);
      
      if (result.success) {
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        localStorage.setItem('instagram-studio-last-sync', now);
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
  }, [drafts, scheduleSlots, settings]);

  const fetchFromCloudinary = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const data = await fetchScheduleFromCloudinary();
      
      if (data) {
        onImport(data);
        return true;
      }
      return false;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [onImport]);

  const exportAsJson = useCallback(() => {
    exportScheduleAsJson(drafts, scheduleSlots, settings);
  }, [drafts, scheduleSlots, settings]);

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

  // Auto-sync on changes (debounced)
  useEffect(() => {
    if (!autoSync || drafts.length === 0) return;

    const timeoutId = setTimeout(() => {
      syncToCloudinary();
    }, 5000); // 5 second debounce

    return () => clearTimeout(timeoutId);
  }, [autoSync, drafts, scheduleSlots, settings, syncToCloudinary]);

  return {
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
  };
}
