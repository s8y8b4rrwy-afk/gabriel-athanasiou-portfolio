/**
 * Instagram Diagnostic - Netlify Function (Studio-owned copy)
 *
 * Uses shared library for consistent behavior with other Instagram functions.
 * @see lib/instagram-lib.mjs for shared functions
 */

import { CLOUDINARY_CLOUD, fetchScheduleData } from './lib/instagram-lib.mjs';

// Match the scheduled-publish window logic
const USE_TODAY_WINDOW = true;
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Get current date/time in a specific timezone
 */
function getTimeInTimezone(date, timezone) {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	const parts = formatter.formatToParts(date);
	const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
	return {
		date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
		time: `${getPart('hour')}:${getPart('minute')}`,
	};
}

export const handler = async () => {
	console.log('🔍 Instagram diagnostic started at:', new Date().toISOString());

	try {
		const scheduleData = await fetchScheduleData();

		if (!scheduleData) {
			return {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
				body: JSON.stringify({
					ok: true,
					message: 'No schedule data found',
					cloudinaryUrl: `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/instagram-studio/schedule-data`,
				}),
			};
		}

		// Get configured timezone from settings (default to Europe/London)
		const configuredTimezone = scheduleData.settings?.timezone || 'Europe/London';
		console.log(`🌍 Using timezone: ${configuredTimezone}`);

		const now = new Date();
		const tzNow = getTimeInTimezone(now, configuredTimezone);
		const currentDateTimeStr = `${tzNow.date}T${tzNow.time}`;
		const windowStartDateTimeStr = USE_TODAY_WINDOW ? `${tzNow.date}T00:00` : null;
		
		console.log(`⏰ Current time in ${configuredTimezone}: ${tzNow.date} ${tzNow.time} (Server UTC: ${now.toISOString()})`);
		
		const allSlots = scheduleData.scheduleSlots || [];

		const statusDist = {};
		for (const slot of allSlots) {
			statusDist[slot.status] = (statusDist[slot.status] || 0) + 1;
		}

		const draftsMap = new Map((scheduleData.drafts || []).map((d) => [d.id, d]));

		// Filter due posts using string comparison in configured timezone
		const dueSlots = allSlots.filter((slot) => {
			if (slot.status !== 'pending') return false;
			const slotDateTimeStr = `${slot.scheduledDate}T${slot.scheduledTime}`;
			const isDue = slotDateTimeStr <= currentDateTimeStr && 
				(USE_TODAY_WINDOW ? slotDateTimeStr >= windowStartDateTimeStr : true);
			return isDue;
		});

		const dueWithDraft = dueSlots.map((slot) => {
			const draft = draftsMap.get(slot.postDraftId);
			return {
				slotId: slot.id,
				postDraftId: slot.postDraftId,
				projectId: draft?.projectId,
				scheduledDate: slot.scheduledDate,
				scheduledTime: slot.scheduledTime,
				status: slot.status,
			};
		});

		const responsePayload = {
			ok: true,
			message: 'Diagnostic complete',
			timezone: configuredTimezone,
			nowInTimezone: `${tzNow.date} ${tzNow.time}`,
			nowUTC: now.toISOString(),
			windowStart: windowStartDateTimeStr,
			scheduleData: {
				version: scheduleData.version,
				lastUpdated: scheduleData.lastUpdated,
				lastMergedAt: scheduleData.lastMergedAt,
				hasInstagram: !!scheduleData.instagram,
				instagramConnected: !!scheduleData.instagram?.connected,
				hasAccessToken: !!scheduleData.instagram?.accessToken,
				hasAccountId: !!scheduleData.instagram?.accountId,
				draftsCount: scheduleData.drafts?.length || 0,
				slotsCount: allSlots.length,
				statusDistribution: statusDist,
			},
			due: {
				count: dueSlots.length,
				slots: dueWithDraft,
			},
			cloudinaryUrl: `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/instagram-studio/schedule-data`,
		};

		console.log('✅ Diagnostic:', {
			slots: allSlots.length,
			due: dueSlots.length,
			instagramConnected: responsePayload.scheduleData.instagramConnected,
		});

		return {
			statusCode: 200,
			headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
			body: JSON.stringify(responsePayload),
		};
	} catch (error) {
		console.error('❌ Diagnostic error:', error);
		return {
			statusCode: 500,
			headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
			body: JSON.stringify({ ok: false, error: error.message }),
		};
	}
};
