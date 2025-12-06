import { useEffect, useRef } from 'react';
import { cmsService } from '../services/cmsService';

/**
 * Hook that checks for data updates in the background without blocking rendering
 * 
 * This runs periodically to check if new content is available and optionally
 * refreshes the page silently or shows a notification
 * 
 * @param enabled - Whether to enable background checking
 * @param intervalMinutes - How often to check for updates (default: 30 minutes)
 * @param onUpdateFound - Optional callback when updates are detected
 */
export const useBackgroundDataSync = (
  enabled: boolean = true,
  intervalMinutes: number = 30,
  onUpdateFound?: () => void
) => {
  const intervalRef = useRef<number | null>(null);
  const hasCheckedOnce = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const checkForUpdates = async () => {
      try {
        const hasUpdates = await cmsService.checkForUpdates();
        
        if (hasUpdates) {
          console.log('[useBackgroundDataSync] Updates detected!');
          
          // Call optional callback
          if (onUpdateFound) {
            onUpdateFound();
          } else {
            // Default behavior: silently invalidate cache
            // Next navigation/refresh will fetch new data
            cmsService.invalidateCache();
            console.log('[useBackgroundDataSync] Cache invalidated, new data will load on next navigation');
          }
        }
      } catch (error) {
        console.warn('[useBackgroundDataSync] Update check failed:', error);
      }
    };

    // Check once on mount (after a short delay to not block initial render)
    if (!hasCheckedOnce.current) {
      const initialTimeout = setTimeout(() => {
        hasCheckedOnce.current = true;
        checkForUpdates();
      }, 10000); // Check 10 seconds after app loads

      return () => clearTimeout(initialTimeout);
    }

    // Set up periodic checks
    const intervalMs = intervalMinutes * 60 * 1000;
    intervalRef.current = window.setInterval(checkForUpdates, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMinutes, onUpdateFound]);
};
