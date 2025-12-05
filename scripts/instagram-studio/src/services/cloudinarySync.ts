/**
 * Cloudinary Sync Service for Instagram Studio
 * 
 * Handles uploading and fetching schedule data to/from Cloudinary.
 * Uses a Netlify function for signed uploads (keeps API secret secure).
 */

import type { PostDraft, ScheduleSlot, ScheduleSettings } from '../types';
import type { RecurringTemplate } from '../types/template';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'date24ay6';
const CLOUDINARY_FOLDER = 'instagram-studio';

// Default profile ID - will be replaced with Instagram user ID when multi-profile is implemented
// For now, use 'default' to maintain backwards compatibility
const DEFAULT_PROFILE_ID = 'default';

// Netlify function endpoint for signed uploads
// In dev, use the main portfolio's function; in prod, use environment variable
const SYNC_FUNCTION_URL = import.meta.env.VITE_SYNC_FUNCTION_URL || 
  'https://lemonpost.studio/.netlify/functions/instagram-studio-sync';

interface ScheduleData {
  version: string;
  exportedAt: string;
  profileId?: string; // For multi-profile support
  settings: ScheduleSettings;
  drafts: PostDraft[];
  scheduleSlots: ScheduleSlot[];
  // New fields for templates
  templates?: RecurringTemplate[];
  defaultTemplate?: RecurringTemplate;
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
    return data;
  } catch (error) {
    console.error('Error fetching schedule from Cloudinary:', error);
    return null;
  }
}

/**
 * Upload schedule data to Cloudinary
 * Uses a Netlify function for signed uploads (API secret stays on server)
 * @param profileId - Optional profile ID for multi-profile support (defaults to 'default')
 */
export async function uploadScheduleToCloudinary(
  drafts: PostDraft[],
  scheduleSlots: ScheduleSlot[],
  settings: ScheduleSettings,
  templates?: RecurringTemplate[],
  defaultTemplate?: RecurringTemplate,
  profileId: string = DEFAULT_PROFILE_ID
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const scheduleData: ScheduleData = {
      version: '1.2.0', // Version bump for profile support
      exportedAt: new Date().toISOString(),
      profileId,
      settings,
      drafts,
      scheduleSlots,
      templates: templates || [],
      defaultTemplate,
    };

    // Call the Netlify function for signed upload
    const response = await fetch(SYNC_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduleData, profileId }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || `Upload failed: ${response.status}`);
    }

    console.log(`✅ Uploaded schedule to Cloudinary (profile: ${profileId}):`, result.url);
    return { success: true, url: result.url };
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
  defaultTemplate?: RecurringTemplate
): void {
  const scheduleData: ScheduleData = {
    version: '1.1.0',
    exportedAt: new Date().toISOString(),
    settings,
    drafts,
    scheduleSlots,
    templates: templates || [],
    defaultTemplate,
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
 */
export function exportScheduleAsCsv(
  drafts: PostDraft[],
  scheduleSlots: ScheduleSlot[]
): void {
  // Create a map of draft IDs to drafts
  const draftMap = new Map(drafts.map(d => [d.id, d]));
  
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
      
      return [
        slot.scheduledDate,
        slot.scheduledTime,
        slot.status,
        `"${draft.project.title.replace(/"/g, '""')}"`,
        draft.project.year,
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
