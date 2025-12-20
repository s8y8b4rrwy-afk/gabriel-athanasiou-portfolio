/**
 * Cloudinary Sync Service for Instagram Studio
 * 
 * Handles uploading and fetching schedule data to/from Cloudinary.
 * Uses a Netlify function for signed uploads (keeps API secret secure).
 * 
 * SMART MERGE: When syncing, local and cloud data are intelligently merged
 * to preserve the latest changes from both sources.
 */

import type { PostDraft, ScheduleSlot, ScheduleSettings } from '../types';
import type { RecurringTemplate } from '../types/template';
import type { InstagramCredentials } from '../types/instagram';
import { 
  mergeScheduleData, 
  formatMergeStats, 
  cleanupOldDeletions,
  type ScheduleDataWithMerge,
  type MergeResult 
} from '../utils/mergeScheduleData';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'date24ay6';
const CLOUDINARY_FOLDER = 'instagram-studio';

/**
 * Migration: Strip embedded project data from drafts
 * 
 * Old drafts stored the entire Project object (~50-100 fields per draft).
 * This caused:
 * - Duplicate data (same project stored multiple times across drafts)
 * - Stale data (project updates in Airtable don't reflect in existing drafts)
 * - Bloated schedule-data.json
 * 
 * Now we only store projectId, and look up project data at runtime.
 * This function strips the embedded project from legacy drafts.
 */
export function migrateOldDrafts(drafts: PostDraft[]): PostDraft[] {
  let migratedCount = 0;
  
  const migrated = drafts.map(draft => {
    // Check if draft has embedded project data that needs removal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draftAny = draft as any;
    if (draftAny.project !== undefined) {
      migratedCount++;
      // Strip the project field, keep everything else
      const { project: _removed, ...cleanDraft } = draftAny;
      return cleanDraft as PostDraft;
    }
    return draft;
  });
  
  if (migratedCount > 0) {
    console.log(`🔄 Migration: Stripped embedded project data from ${migratedCount} drafts`);
  } else {
    console.log('📋 Migration: No embedded project data found to strip');
  }
  
  return migrated;
}

// Default profile ID - will be replaced with Instagram user ID when multi-profile is implemented
// For now, use 'default' to maintain backwards compatibility
const DEFAULT_PROFILE_ID = 'default';

// Netlify function endpoint for signed uploads
// Prefer relative URLs so deploy previews + local `netlify dev` just work.
// Can be overridden with `VITE_SYNC_FUNCTION_URL` for emergency fallback.
const SYNC_FUNCTION_URL = import.meta.env.VITE_SYNC_FUNCTION_URL ||
	'/.netlify/functions/instagram-studio-sync';

interface ScheduleData {
  version: string;
  exportedAt: string;
  lastMergedAt?: string; // Track when data was last merged
  profileId?: string; // For multi-profile support
  settings: ScheduleSettings;
  drafts: PostDraft[];
  scheduleSlots: ScheduleSlot[];
  // New fields for templates
  templates?: RecurringTemplate[];
  defaultTemplate?: RecurringTemplate;
  // Instagram credentials (synced to cloud for persistence)
  instagram?: InstagramCredentials;
  // Deletion tracking for smart merge
  deletedIds?: {
    drafts: { id: string; deletedAt: string }[];
    scheduleSlots: { id: string; deletedAt: string }[];
    templates: { id: string; deletedAt: string }[];
  };
}

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  version: number;
}

interface CloudinaryError {
  error?: {
    message: string;
  };
}

/**
 * Get the Cloudinary URL for the schedule data
 * Note: Cloudinary stores raw files without extension, so we don't add .json
 * @param profileId - Optional profile ID for multi-profile support (defaults to 'default')
 */
export function getScheduleDataUrl(profileId: string = DEFAULT_PROFILE_ID): string {
  const publicId = profileId === 'default' ? 'schedule-data' : `schedule-data-${profileId}`;
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/${CLOUDINARY_FOLDER}/${publicId}`;
}

/**
 * Fetch schedule data from Cloudinary
 * @param profileId - Optional profile ID for multi-profile support (defaults to 'default')
 */
export async function fetchScheduleFromCloudinary(profileId: string = DEFAULT_PROFILE_ID): Promise<ScheduleData | null> {
  try {
    const url = getScheduleDataUrl(profileId);
    // Add cache-busting parameter
    const cacheBuster = `?t=${Date.now()}`;
    
    const response = await fetch(url + cacheBuster);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No schedule data found in Cloudinary for profile: ${profileId}`);
        return null;
      }
      throw new Error(`Failed to fetch schedule data: ${response.status}`);
    }
    
    const data: ScheduleData = await response.json();
    console.log(`✅ Fetched schedule from Cloudinary (profile: ${profileId}):`, data.exportedAt);
    
    // Apply migration: strip embedded project data from old drafts
    // This keeps data clean and ensures fresh project data is always used
    if (data.drafts && data.drafts.length > 0) {
      data.drafts = migrateOldDrafts(data.drafts);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching schedule from Cloudinary:', error);
    return null;
  }
}

/**
 * Upload schedule data to Cloudinary with SMART MERGE
 * 
 * This function:
 * 1. Fetches current cloud data (unless forceOverwrite is true)
 * 2. Merges local + cloud data (keeping latest changes from both)
 * 3. Uploads the merged result
 * 4. Returns the merged data so local state can be updated
 * 
 * Uses a Netlify function for signed uploads (API secret stays on server)
 * @param profileId - Optional profile ID for multi-profile support (defaults to 'default')
 * @param forceOverwrite - If true, skip merge and just overwrite cloud data with local
 */
export async function uploadScheduleToCloudinary(
  drafts: PostDraft[],
  scheduleSlots: ScheduleSlot[],
  settings: ScheduleSettings,
  templates?: RecurringTemplate[],
  defaultTemplate?: RecurringTemplate,
  instagram?: InstagramCredentials | null,
  deletedIds?: ScheduleData['deletedIds'],
  profileId: string = DEFAULT_PROFILE_ID,
  forceOverwrite: boolean = false
): Promise<{ success: boolean; url?: string; error?: string; mergedData?: ScheduleData; mergeStats?: string }> {
  try {
    // Strip embedded project data before upload (migration cleanup)
    const cleanDrafts = migrateOldDrafts(drafts);
    
    // Build local data object
    const localData: ScheduleDataWithMerge = {
      version: '1.4.0', // Version bump for merge support
      exportedAt: new Date().toISOString(),
      profileId,
      settings,
      drafts: cleanDrafts,
      scheduleSlots,
      templates: templates || [],
      defaultTemplate,
      instagram: instagram || undefined,
      deletedIds: deletedIds || { drafts: [], scheduleSlots: [], templates: [] }
    };
    
    let dataToUpload: ScheduleDataWithMerge;
    let mergeStatsMessage: string;
    
    if (forceOverwrite) {
      // Skip merge - just use local data directly
      console.log('⚠️ Force overwrite mode - skipping merge, using local data only');
      dataToUpload = localData;
      mergeStatsMessage = 'Force overwrite (no merge)';
    } else {
      // Step 1: Fetch current cloud data for merging
      console.log('📥 Fetching cloud data for merge...');
      const cloudData = await fetchScheduleFromCloudinary(profileId);
      
      // Step 1.5: Strip embedded project data from cloud data too (migration cleanup)
      if (cloudData && cloudData.drafts) {
        cloudData.drafts = migrateOldDrafts(cloudData.drafts);
      }
      
      // Step 2: Merge local and cloud data
      console.log('🔄 Merging local and cloud data...');
      const mergeResult: MergeResult = mergeScheduleData(localData, cloudData as ScheduleDataWithMerge | null);
      
      // Clean up old deletions (older than 30 days)
      mergeResult.data.deletedIds = cleanupOldDeletions(mergeResult.data.deletedIds, 30);
      
      dataToUpload = mergeResult.data;
      mergeStatsMessage = formatMergeStats(mergeResult.stats);
      console.log('📊 Merge stats:', mergeStatsMessage);
    }

    // FINAL cleanup: ensure no embedded project data in upload
    // This catches any edge cases from merge logic
    console.log('🔍 Pre-final cleanup drafts count:', dataToUpload.drafts?.length || 0);
    if (dataToUpload.drafts && dataToUpload.drafts.length > 0) {
      const beforeCount = dataToUpload.drafts.filter((d: PostDraft) => 'project' in d).length;
      console.log(`🔍 Drafts with project field before cleanup: ${beforeCount}`);
      dataToUpload.drafts = migrateOldDrafts(dataToUpload.drafts);
      const afterCount = dataToUpload.drafts.filter((d: PostDraft) => 'project' in d).length;
      console.log(`🔍 Drafts with project field after cleanup: ${afterCount}`);
    }

    // Upload data to Cloudinary
    console.log('📤 Uploading to:', SYNC_FUNCTION_URL);
    console.log('📦 Data size:', JSON.stringify(dataToUpload).length, 'bytes');
    
    const response = await fetch(SYNC_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduleData: dataToUpload, profileId }),
    });

    // First, check if response is ok before trying to parse
    if (!response.ok) {
      console.error('Upload failed with status:', response.status, response.statusText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('Failed to parse response JSON:', parseError);
      throw new Error(`Invalid JSON response from sync function: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }

    if (result.error) {
      console.error('Upload failed:', result);
      throw new Error(result.error || `Upload failed with server error`);
    }

    console.log(`✅ Uploaded schedule to Cloudinary (profile: ${profileId}):`, result.url);
    return { 
      success: true, 
      url: result.url, 
      mergedData: dataToUpload,
      mergeStats: mergeStatsMessage 
    };
  } catch (error) {
    console.error('Error uploading schedule to Cloudinary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Export schedule data as a downloadable JSON file
 */
export function exportScheduleAsJson(
  drafts: PostDraft[],
  scheduleSlots: ScheduleSlot[],
  settings: ScheduleSettings,
  templates?: RecurringTemplate[],
  defaultTemplate?: RecurringTemplate,
  instagram?: InstagramCredentials | null,
  deletedIds?: ScheduleData['deletedIds']
): void {
  // Strip embedded project data before export (migration cleanup)
  const cleanDrafts = migrateOldDrafts(drafts);
  
  const scheduleData: ScheduleData = {
    version: '1.4.0',
    exportedAt: new Date().toISOString(),
    settings,
    drafts: cleanDrafts,
    scheduleSlots,
    templates: templates || [],
    defaultTemplate,
    instagram: instagram || undefined,
    deletedIds: deletedIds || { drafts: [], scheduleSlots: [], templates: [] },
  };

  const jsonString = JSON.stringify(scheduleData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `instagram-studio-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export schedule data as a downloadable CSV file
 * @param projects - Optional projects array for looking up project data (if not embedded in drafts)
 */
export function exportScheduleAsCsv(
  drafts: PostDraft[],
  scheduleSlots: ScheduleSlot[],
  projects?: Array<{ id: string; title: string; year: string }>
): void {
  // Create a map of draft IDs to drafts
  const draftMap = new Map(drafts.map(d => [d.id, d]));
  // Create a map of project IDs to projects (for runtime lookup)
  const projectMap = new Map(projects?.map(p => [p.id, p]) || []);
  
  // Helper to get project data (from embedded or lookup)
  const getProjectData = (draft: PostDraft): { title: string; year: string } => {
    // First try embedded project (legacy drafts)
    if (draft.project?.title) {
      return { title: draft.project.title, year: draft.project.year || '' };
    }
    // Then try project lookup
    const project = projectMap.get(draft.projectId);
    if (project) {
      return { title: project.title, year: project.year || '' };
    }
    // Fallback
    return { title: 'Unknown Project', year: '' };
  };
  
  // CSV headers
  const headers = [
    'Schedule Date',
    'Schedule Time',
    'Status',
    'Project Title',
    'Project Year',
    'Caption',
    'Hashtags',
    'Images Count',
    'Created At',
  ].join(',');
  
  // CSV rows
  const rows = scheduleSlots
    .map(slot => {
      const draft = draftMap.get(slot.postDraftId);
      if (!draft) return null;
      
      const projectData = getProjectData(draft);
      
      return [
        slot.scheduledDate,
        slot.scheduledTime,
        slot.status,
        `"${projectData.title.replace(/"/g, '""')}"`,
        projectData.year,
        `"${draft.caption.substring(0, 100).replace(/"/g, '""').replace(/\n/g, ' ')}..."`,
        `"${draft.hashtags.join(' ')}"`,
        draft.selectedImages.length,
        draft.createdAt,
      ].join(',');
    })
    .filter(Boolean)
    .join('\n');
  
  const csv = `${headers}\n${rows}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `instagram-schedule-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import schedule data from a JSON file
 */
export function importScheduleFromFile(
  file: File
): Promise<ScheduleData | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const data: ScheduleData = JSON.parse(json);
        
        // Validate the data structure
        if (!data.version || !data.drafts || !data.scheduleSlots) {
          console.error('Invalid schedule data format');
          resolve(null);
          return;
        }
        
        resolve(data);
      } catch (error) {
        console.error('Error parsing schedule file:', error);
        resolve(null);
      }
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      resolve(null);
    };
    
    reader.readAsText(file);
  });
}

export type { ScheduleData };
