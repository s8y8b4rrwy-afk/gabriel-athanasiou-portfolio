/**
 * Smart Merge Utility for Instagram Studio
 * 
 * Intelligently merges local and cloud schedule data to ensure
 * the latest changes from both sources are preserved.
 * 
 * Merge Strategy:
 * - Items (drafts, schedules, templates): Merge by ID, keep the one with latest timestamp
 * - Deleted items: Track deleted IDs to prevent re-appearance
 * - Settings: Keep whichever was modified more recently (based on data exportedAt)
 * - Instagram credentials: Keep the most recent valid token
 */

import type { PostDraft, ScheduleSlot, ScheduleSettings } from '../types';
import type { RecurringTemplate } from '../types/template';
import type { InstagramCredentials } from '../types/instagram';

/**
 * Extended ScheduleData type with deletion tracking
 */
export interface ScheduleDataWithMerge {
  version: string;
  exportedAt: string;
  lastMergedAt?: string;
  profileId?: string;
  settings: ScheduleSettings;
  drafts: PostDraft[];
  scheduleSlots: ScheduleSlot[];
  templates?: RecurringTemplate[];
  defaultTemplate?: RecurringTemplate;
  instagram?: InstagramCredentials;
  // Deletion tracking - stores IDs of deleted items with deletion timestamp
  deletedIds?: {
    drafts: { id: string; deletedAt: string }[];
    scheduleSlots: { id: string; deletedAt: string }[];
    templates: { id: string; deletedAt: string }[];
  };
}

export interface MergeResult {
  data: ScheduleDataWithMerge;
  stats: {
    draftsAdded: number;
    draftsUpdated: number;
    draftsDeleted: number;
    scheduleSlotsAdded: number;
    scheduleSlotsUpdated: number;
    scheduleSlotsDeleted: number;
    templatesAdded: number;
    templatesUpdated: number;
    templatesDeleted: number;
    settingsSource: 'local' | 'cloud' | 'unchanged';
    instagramSource: 'local' | 'cloud' | 'unchanged' | 'none';
  };
}

/**
 * Compare two timestamps and return which is more recent
 */
function getNewerTimestamp(a: string | undefined | null, b: string | undefined | null): 'a' | 'b' | 'equal' {
  if (!a && !b) return 'equal';
  if (!a) return 'b';
  if (!b) return 'a';
  
  const dateA = new Date(a).getTime();
  const dateB = new Date(b).getTime();
  
  if (dateA > dateB) return 'a';
  if (dateB > dateA) return 'b';
  return 'equal';
}

/**
 * Get the effective timestamp for an item
 * Prioritizes: updatedAt > createdAt > fallback
 */
function getItemTimestamp(item: { updatedAt?: string; createdAt?: string }): string {
  return item.updatedAt || item.createdAt || new Date(0).toISOString();
}

/**
 * Merge arrays of items by ID, keeping the most recently modified version
 */
function mergeItemsById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  localItems: T[],
  cloudItems: T[],
  localDeletedIds: { id: string; deletedAt: string }[] = [],
  cloudDeletedIds: { id: string; deletedAt: string }[] = []
): { merged: T[]; deletedIds: { id: string; deletedAt: string }[]; added: number; updated: number; deleted: number } {
  const mergedMap = new Map<string, T>();
  const deletedMap = new Map<string, { id: string; deletedAt: string }>();
  
  let added = 0;
  let updated = 0;
  let deleted = 0;
  
  // Combine all deleted IDs from both sources
  [...localDeletedIds, ...cloudDeletedIds].forEach(del => {
    const existing = deletedMap.get(del.id);
    if (!existing || getNewerTimestamp(del.deletedAt, existing.deletedAt) === 'a') {
      deletedMap.set(del.id, del);
    }
  });
  
  // Add all cloud items first
  cloudItems.forEach(item => {
    // Check if this item was deleted
    const deletion = deletedMap.get(item.id);
    if (deletion) {
      // Item was deleted - only keep it if it was modified after deletion
      const itemTime = getItemTimestamp(item);
      if (getNewerTimestamp(itemTime, deletion.deletedAt) === 'a') {
        // Item was modified after deletion - resurrect it
        mergedMap.set(item.id, item);
        deletedMap.delete(item.id);
      } else {
        deleted++;
      }
    } else {
      mergedMap.set(item.id, item);
    }
  });
  
  // Merge with local items
  localItems.forEach(localItem => {
    // Check if this item was deleted
    const deletion = deletedMap.get(localItem.id);
    if (deletion) {
      const itemTime = getItemTimestamp(localItem);
      if (getNewerTimestamp(itemTime, deletion.deletedAt) === 'a') {
        // Item was modified after deletion - resurrect it
        mergedMap.set(localItem.id, localItem);
        deletedMap.delete(localItem.id);
        added++;
      }
      // else: item stays deleted
      return;
    }
    
    const cloudItem = mergedMap.get(localItem.id);
    
    if (!cloudItem) {
      // Item only exists locally - add it
      mergedMap.set(localItem.id, localItem);
      added++;
    } else {
      // Item exists in both - keep the more recent one
      const localTime = getItemTimestamp(localItem);
      const cloudTime = getItemTimestamp(cloudItem);
      const comparison = getNewerTimestamp(localTime, cloudTime);
      
      if (comparison === 'a') {
        // Local is newer
        mergedMap.set(localItem.id, localItem);
        updated++;
      }
      // If cloud is newer or equal, keep cloud version (already in map)
    }
  });
  
  return {
    merged: Array.from(mergedMap.values()),
    deletedIds: Array.from(deletedMap.values()),
    added,
    updated,
    deleted
  };
}

/**
 * Merge Instagram credentials, preferring the most recent valid token
 */
function mergeInstagramCredentials(
  local: InstagramCredentials | undefined,
  cloud: InstagramCredentials | undefined
): { merged: InstagramCredentials | undefined; source: 'local' | 'cloud' | 'unchanged' | 'none' } {
  // If neither has credentials
  if (!local && !cloud) {
    return { merged: undefined, source: 'none' };
  }
  
  // If only one has credentials
  if (!local) {
    return { merged: cloud, source: 'cloud' };
  }
  if (!cloud) {
    return { merged: local, source: 'local' };
  }
  
  // Both have credentials - check which is more recent
  const localRefresh = local.lastRefreshed || local.tokenExpiry;
  const cloudRefresh = cloud.lastRefreshed || cloud.tokenExpiry;
  
  const comparison = getNewerTimestamp(localRefresh, cloudRefresh);
  
  if (comparison === 'a') {
    return { merged: local, source: 'local' };
  } else if (comparison === 'b') {
    return { merged: cloud, source: 'cloud' };
  }
  
  // Equal - prefer the one with later expiry
  const expiryComparison = getNewerTimestamp(local.tokenExpiry, cloud.tokenExpiry);
  if (expiryComparison === 'a') {
    return { merged: local, source: 'local' };
  }
  
  return { merged: cloud, source: 'unchanged' };
}

/**
 * Main merge function - intelligently combines local and cloud data
 */
export function mergeScheduleData(
  localData: ScheduleDataWithMerge,
  cloudData: ScheduleDataWithMerge | null
): MergeResult {
  // If no cloud data, just return local with proper structure
  if (!cloudData) {
    return {
      data: {
        ...localData,
        lastMergedAt: new Date().toISOString(),
        deletedIds: localData.deletedIds || { drafts: [], scheduleSlots: [], templates: [] }
      },
      stats: {
        draftsAdded: 0,
        draftsUpdated: 0,
        draftsDeleted: 0,
        scheduleSlotsAdded: 0,
        scheduleSlotsUpdated: 0,
        scheduleSlotsDeleted: 0,
        templatesAdded: 0,
        templatesUpdated: 0,
        templatesDeleted: 0,
        settingsSource: 'local',
        instagramSource: localData.instagram ? 'local' : 'none'
      }
    };
  }
  
  // Merge drafts
  const draftsResult = mergeItemsById(
    localData.drafts || [],
    cloudData.drafts || [],
    localData.deletedIds?.drafts || [],
    cloudData.deletedIds?.drafts || []
  );
  
  // Merge schedule slots
  const scheduleSlotsResult = mergeItemsById(
    localData.scheduleSlots || [],
    cloudData.scheduleSlots || [],
    localData.deletedIds?.scheduleSlots || [],
    cloudData.deletedIds?.scheduleSlots || []
  );
  
  // Merge templates
  const templatesResult = mergeItemsById(
    localData.templates || [],
    cloudData.templates || [],
    localData.deletedIds?.templates || [],
    cloudData.deletedIds?.templates || []
  );
  
  // Determine which settings to use based on exportedAt
  const settingsComparison = getNewerTimestamp(localData.exportedAt, cloudData.exportedAt);
  const settingsSource: 'local' | 'cloud' | 'unchanged' = 
    settingsComparison === 'a' ? 'local' : 
    settingsComparison === 'b' ? 'cloud' : 'unchanged';
  
  const mergedSettings = settingsComparison === 'b' ? cloudData.settings : localData.settings;
  const mergedDefaultTemplate = settingsComparison === 'b' ? cloudData.defaultTemplate : localData.defaultTemplate;
  
  // Merge Instagram credentials
  const instagramResult = mergeInstagramCredentials(localData.instagram, cloudData.instagram);
  
  // Construct merged data
  const mergedData: ScheduleDataWithMerge = {
    version: '1.4.0', // Version bump for merge support
    exportedAt: new Date().toISOString(),
    lastMergedAt: new Date().toISOString(),
    profileId: localData.profileId || cloudData.profileId,
    settings: mergedSettings,
    drafts: draftsResult.merged,
    scheduleSlots: scheduleSlotsResult.merged,
    templates: templatesResult.merged,
    defaultTemplate: mergedDefaultTemplate,
    instagram: instagramResult.merged,
    deletedIds: {
      drafts: draftsResult.deletedIds,
      scheduleSlots: scheduleSlotsResult.deletedIds,
      templates: templatesResult.deletedIds
    }
  };
  
  return {
    data: mergedData,
    stats: {
      draftsAdded: draftsResult.added,
      draftsUpdated: draftsResult.updated,
      draftsDeleted: draftsResult.deleted,
      scheduleSlotsAdded: scheduleSlotsResult.added,
      scheduleSlotsUpdated: scheduleSlotsResult.updated,
      scheduleSlotsDeleted: scheduleSlotsResult.deleted,
      templatesAdded: templatesResult.added,
      templatesUpdated: templatesResult.updated,
      templatesDeleted: templatesResult.deleted,
      settingsSource,
      instagramSource: instagramResult.source
    }
  };
}

/**
 * Track a deletion - call this when user deletes an item locally
 */
export function trackDeletion(
  currentDeletedIds: ScheduleDataWithMerge['deletedIds'],
  type: 'drafts' | 'scheduleSlots' | 'templates',
  id: string
): ScheduleDataWithMerge['deletedIds'] {
  const deletedIds = currentDeletedIds || { drafts: [], scheduleSlots: [], templates: [] };
  
  // Check if already tracked
  if (deletedIds[type].some(d => d.id === id)) {
    return deletedIds;
  }
  
  return {
    ...deletedIds,
    [type]: [...deletedIds[type], { id, deletedAt: new Date().toISOString() }]
  };
}

/**
 * Clean up old deletions (older than 30 days)
 * Call this periodically to prevent the deletedIds list from growing indefinitely
 */
export function cleanupOldDeletions(
  deletedIds: ScheduleDataWithMerge['deletedIds'],
  maxAgeDays: number = 30
): ScheduleDataWithMerge['deletedIds'] {
  if (!deletedIds) return { drafts: [], scheduleSlots: [], templates: [] };
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffTime = cutoff.toISOString();
  
  return {
    drafts: deletedIds.drafts.filter(d => d.deletedAt > cutoffTime),
    scheduleSlots: deletedIds.scheduleSlots.filter(d => d.deletedAt > cutoffTime),
    templates: deletedIds.templates.filter(d => d.deletedAt > cutoffTime)
  };
}

/**
 * Format merge stats for display
 */
export function formatMergeStats(stats: MergeResult['stats']): string {
  const parts: string[] = [];
  
  if (stats.draftsAdded > 0) parts.push(`${stats.draftsAdded} draft(s) added`);
  if (stats.draftsUpdated > 0) parts.push(`${stats.draftsUpdated} draft(s) updated`);
  if (stats.scheduleSlotsAdded > 0) parts.push(`${stats.scheduleSlotsAdded} schedule(s) added`);
  if (stats.scheduleSlotsUpdated > 0) parts.push(`${stats.scheduleSlotsUpdated} schedule(s) updated`);
  if (stats.templatesAdded > 0) parts.push(`${stats.templatesAdded} template(s) added`);
  if (stats.templatesUpdated > 0) parts.push(`${stats.templatesUpdated} template(s) updated`);
  
  if (parts.length === 0) {
    return 'Data is in sync';
  }
  
  return parts.join(', ');
}
