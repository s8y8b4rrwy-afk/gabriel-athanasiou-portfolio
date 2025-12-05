/**
 * Cloudinary Sync Service for Instagram Studio
 * 
 * Handles uploading and fetching schedule data to/from Cloudinary.
 * Uses Cloudinary's unsigned upload for JSON data.
 */

import type { PostDraft, ScheduleSlot, ScheduleSettings } from '../types';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'date24ay6';
const CLOUDINARY_UPLOAD_PRESET = 'instagram_studio'; // Create this preset in Cloudinary settings
const CLOUDINARY_FOLDER = 'instagram-studio';

interface ScheduleData {
  version: string;
  exportedAt: string;
  settings: ScheduleSettings;
  drafts: PostDraft[];
  scheduleSlots: ScheduleSlot[];
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
 */
export function getScheduleDataUrl(): string {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/${CLOUDINARY_FOLDER}/schedule-data.json`;
}

/**
 * Fetch schedule data from Cloudinary
 */
export async function fetchScheduleFromCloudinary(): Promise<ScheduleData | null> {
  try {
    const url = getScheduleDataUrl();
    // Add cache-busting parameter
    const cacheBuster = `?t=${Date.now()}`;
    
    const response = await fetch(url + cacheBuster);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('No schedule data found in Cloudinary');
        return null;
      }
      throw new Error(`Failed to fetch schedule data: ${response.status}`);
    }
    
    const data: ScheduleData = await response.json();
    console.log('✅ Fetched schedule from Cloudinary:', data.exportedAt);
    return data;
  } catch (error) {
    console.error('Error fetching schedule from Cloudinary:', error);
    return null;
  }
}

/**
 * Upload schedule data to Cloudinary
 * Uses unsigned upload with a preset configured in Cloudinary
 */
export async function uploadScheduleToCloudinary(
  drafts: PostDraft[],
  scheduleSlots: ScheduleSlot[],
  settings: ScheduleSettings
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const scheduleData: ScheduleData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      drafts,
      scheduleSlots,
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(scheduleData, null, 2);
    
    // Create a Blob from the JSON
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', blob, 'schedule-data.json');
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('public_id', 'schedule-data');
    formData.append('folder', CLOUDINARY_FOLDER);
    formData.append('resource_type', 'raw');
    formData.append('overwrite', 'true');
    formData.append('invalidate', 'true');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const result = await response.json() as CloudinaryUploadResponse & CloudinaryError;

    if (result.error) {
      throw new Error(result.error.message);
    }

    console.log('✅ Uploaded schedule to Cloudinary:', result.secure_url);
    return { success: true, url: result.secure_url };
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
  settings: ScheduleSettings
): void {
  const scheduleData: ScheduleData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    settings,
    drafts,
    scheduleSlots,
  };

  const jsonString = JSON.stringify(scheduleData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `instagram-schedule-${new Date().toISOString().split('T')[0]}.json`;
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
