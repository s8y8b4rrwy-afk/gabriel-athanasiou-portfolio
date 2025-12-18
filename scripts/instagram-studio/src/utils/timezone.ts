/**
 * Timezone conversion utilities for Instagram Studio
 * 
 * All scheduled times are stored with their original timezone.
 * When displaying, times are converted to the user's selected display timezone.
 */

// Default timezone for legacy data that doesn't have scheduledTimezone
export const DEFAULT_STORAGE_TIMEZONE = 'Europe/London';

/**
 * Convert a date/time from one timezone to another
 * Returns the converted date and time strings
 */
export function convertTimezone(
  date: string,      // YYYY-MM-DD
  time: string,      // HH:mm
  fromTimezone: string,
  toTimezone: string
): { date: string; time: string } {
  if (fromTimezone === toTimezone) {
    return { date, time };
  }

  try {
    // Create a date in the source timezone
    // We need to parse the date/time as if it's in the source timezone
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a Date object and get its UTC representation
    // First, format as ISO and let the browser interpret it
    const isoString = `${date}T${time}:00`;
    
    // Get the offset for the source timezone at this specific date/time
    const sourceDate = new Date(isoString);
    const sourceFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: fromTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    // Get the offset difference by comparing local interpretation vs timezone interpretation
    const targetFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: toTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    // Create a reference point: interpret the time as UTC first
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    
    // Get how this UTC time looks in the source timezone
    const sourceOffset = getTimezoneOffset(utcDate, fromTimezone);
    // Get how this UTC time looks in the target timezone  
    const targetOffset = getTimezoneOffset(utcDate, toTimezone);
    
    // The actual UTC time of our scheduled time
    const actualUtcMs = utcDate.getTime() + sourceOffset * 60000;
    const actualUtcDate = new Date(actualUtcMs);
    
    // Now convert this UTC time to the target timezone
    const targetParts = targetFormatter.formatToParts(actualUtcDate);
    const getPart = (type: string) => targetParts.find(p => p.type === type)?.value || '00';
    
    const convertedDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const convertedTime = `${getPart('hour')}:${getPart('minute')}`;
    
    return { date: convertedDate, time: convertedTime };
  } catch (error) {
    console.error('Timezone conversion error:', error);
    return { date, time }; // Return original on error
  }
}

/**
 * Get timezone offset in minutes for a specific date
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate.getTime() - tzDate.getTime()) / 60000;
}

/**
 * Convert schedule slot times to display timezone
 */
export function convertSlotToDisplayTimezone(
  slot: { scheduledDate?: string; scheduledTime?: string; scheduledTimezone?: string },
  displayTimezone: string
): { displayDate: string; displayTime: string } {
  // Handle missing date/time - return defaults
  if (!slot.scheduledDate || !slot.scheduledTime) {
    return { 
      displayDate: slot.scheduledDate || '', 
      displayTime: slot.scheduledTime || '' 
    };
  }
  
  const storageTimezone = slot.scheduledTimezone || DEFAULT_STORAGE_TIMEZONE;
  const converted = convertTimezone(
    slot.scheduledDate,
    slot.scheduledTime,
    storageTimezone,
    displayTimezone
  );
  return { displayDate: converted.date, displayTime: converted.time };
}

/**
 * Format time for display (12-hour format with AM/PM)
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Format date for display
 */
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Check if a date string matches today in the given timezone
 */
export function isDateToday(dateStr: string, timezone: string): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(now);
  return dateStr === todayStr;
}

/**
 * Get current date string in a timezone
 */
export function getCurrentDateInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Get current time string in a timezone
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}
