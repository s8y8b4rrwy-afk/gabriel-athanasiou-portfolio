/**
 * Instagram Scheduled Publish - Netlify Scheduled Function (Studio-owned copy)
 *
 * Runs hourly to check for scheduled posts and publish them to Instagram.
 * Uses shared library for all Instagram API calls to ensure consistent behavior.
 * 
 * IMPORTANT: This uses @netlify/functions schedule() wrapper for proper scheduling.
 * The schedule is defined at the bottom of the file with the handler export.
 * 
 * @see lib/instagram-lib.mjs for shared Instagram API functions
 */

import { schedule } from '@netlify/functions';
import {
	CLOUDINARY_CLOUD,
	waitForMediaReady,
	publishMediaContainer,
	createMediaContainer,
	createCarouselContainer,
	fetchScheduleData,
	saveWithSmartMerge,
	getInstagramUrls,
	publishPost,
	sendNotification,
} from './lib/instagram-lib.mjs';

// Catch-up window: publish any pending posts from today that are past their scheduled time
// This means a post scheduled for 11am will still publish if the function runs at 6pm
const USE_TODAY_WINDOW = true; // Set to false to revert to 1-hour window
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000; // Fallback: 1 hour window

// The actual scheduled function logic
const scheduledHandler = async (event) => {
	console.log('⏰ Scheduled publish check started at:', new Date().toISOString());

	const dryRunParam = event?.queryStringParameters?.dryRun;
	const isDryRun =
		dryRunParam === '1' ||
		dryRunParam === 'true' ||
		process.env.INSTAGRAM_DRY_RUN === 'true' ||
		process.env.DRY_RUN === 'true';

	try {
		const scheduleData = await fetchScheduleData();

		if (!scheduleData) {
			console.log('📭 No schedule data found in Cloudinary');
			return {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
				body: JSON.stringify({ ok: true, skipped: true, reason: 'no_schedule_data' }),
			};
		}

		console.log('📊 Schedule data structure:', {
			hasInstagram: !!scheduleData.instagram,
			instagramConnected: scheduleData.instagram?.connected,
			hasAccessToken: !!scheduleData.instagram?.accessToken,
			draftsCount: scheduleData.drafts?.length || 0,
			slotsCount: scheduleData.scheduleSlots?.length || 0,
			version: scheduleData.version,
		});

		if (!scheduleData.instagram?.connected || !scheduleData.instagram?.accessToken) {
			console.log('🔌 Instagram not connected or no access token');
			return {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
				body: JSON.stringify({ ok: true, skipped: true, reason: 'not_connected' }),
			};
		}

		const { accessToken, accountId } = scheduleData.instagram;

		// Get configured timezone from settings (default to Europe/London)
		const configuredTimezone = scheduleData.settings?.timezone || 'Europe/London';
		console.log(`🌍 Using timezone: ${configuredTimezone}`);

		const now = new Date();
		
		// Format current time in the CONFIGURED timezone (not server UTC)
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: configuredTimezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
		const parts = formatter.formatToParts(now);
		const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
		
		const todayDateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
		const currentTimeStr = `${getPart('hour')}:${getPart('minute')}`;
		
		console.log(`⏰ Current time in ${configuredTimezone}: ${todayDateStr} ${currentTimeStr} (Server UTC: ${now.toISOString()})`);
		
		// Calculate window start based on mode
		let windowStart;
		let windowStartDateStr;
		if (USE_TODAY_WINDOW) {
			// Today window: start of today (midnight local time)
			windowStart = new Date(now);
			windowStart.setHours(0, 0, 0, 0);
			windowStartDateStr = todayDateStr;
			console.log(`📅 Using TODAY window: ${windowStartDateStr} 00:00 to ${todayDateStr} ${currentTimeStr}`);
		} else {
			// 1-hour window (original behavior)
			windowStart = new Date(now.getTime() - SCHEDULE_WINDOW_MS);
			const wsYear = windowStart.getFullYear();
			const wsMonth = String(windowStart.getMonth() + 1).padStart(2, '0');
			const wsDay = String(windowStart.getDate()).padStart(2, '0');
			const wsHour = String(windowStart.getHours()).padStart(2, '0');
			const wsMin = String(windowStart.getMinutes()).padStart(2, '0');
			windowStartDateStr = `${wsYear}-${wsMonth}-${wsDay}`;
			console.log(`⏰ Using 1-HOUR window: ${wsYear}-${wsMonth}-${wsDay} ${wsHour}:${wsMin} to ${todayDateStr} ${currentTimeStr}`);
		}

		const draftsMap = new Map((scheduleData.drafts || []).map((d) => [d.id, d]));
		const allSlots = scheduleData.scheduleSlots || [];

		console.log(`📋 Total schedule slots: ${allSlots.length}`);

		const statusDist = {};
		for (const slot of allSlots) {
			statusDist[slot.status] = (statusDist[slot.status] || 0) + 1;
		}
		console.log('   Status distribution:', statusDist);

		const duePosts = allSlots
			.filter((slot) => {
				// Skip if not pending
				if (slot.status !== 'pending') {
					if (slot.status === 'failed') {
						console.log(`   ⏭️ Skipping ${slot.id}: status is 'failed' - will not auto-retry`);
					}
					return false;
				}
				
				// IDEMPOTENCY GUARD: Skip if already published (even if status was reset to pending by stale UI sync)
				// This prevents duplicate publishes when UI auto-sync overwrites status back to 'pending'
				if (slot.instagramMediaId || slot.publishedAt) {
					console.log(`   ⏭️ Skipping ${slot.id}: already has instagramMediaId or publishedAt (status may have been reset by stale sync)`);
					return false;
				}
				
				// Skip if has error from previous attempt (prevents retry loop for persistently failing posts)
				if (slot.error) {
					console.log(`   ⏭️ Skipping ${slot.id}: has previous error - "${slot.error.substring(0, 50)}..."`);
					return false;
				}
				
				// Compare dates and times as strings (local timezone)
				const slotDateTime = `${slot.scheduledDate}T${slot.scheduledTime}`;
				const currentDateTime = `${todayDateStr}T${currentTimeStr}`;
				const windowStartDateTime = USE_TODAY_WINDOW ? `${todayDateStr}T00:00` : `${windowStartDateStr}T${String(windowStart.getHours()).padStart(2, '0')}:${String(windowStart.getMinutes()).padStart(2, '0')}`;
				
				// String comparison works for ISO format (YYYY-MM-DDTHH:MM)
				const isDue = slotDateTime <= currentDateTime && slotDateTime >= windowStartDateTime;
				
				if (isDue) {
					console.log(`   ✅ Due: ${slot.scheduledDate} ${slot.scheduledTime} (${slot.postDraftId})`);
				}
				return isDue;
			})
			.map((slot) => {
				const draft = draftsMap.get(slot.postDraftId);
				if (!draft) {
					console.warn(`⚠️  Draft not found for slot ${slot.id} (postDraftId: ${slot.postDraftId})`);
				}
				return { slot, draft };
			})
			.filter(({ draft }) => draft !== undefined);

		if (duePosts.length === 0) {
			console.log('📭 No posts due for publishing in the current window');
			return {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
				body: JSON.stringify({ ok: true, skipped: true, reason: 'no_posts_due' }),
			};
		}

		console.log(`📬 Found ${duePosts.length} post(s) to publish`);

		const results = [];
		const statusUpdates = new Map();

		for (const { slot, draft } of duePosts) {
			try {
				console.log(`📤 Publishing post: ${draft.projectId}`);

				let hashtags = draft.hashtags || [];
				if (hashtags.length > 30) {
					console.log(`⚠️ Trimming hashtags from ${hashtags.length} to 30`);
					hashtags = hashtags.slice(0, 30);
				}
				const fullCaption =
					hashtags.length > 0 ? `${draft.caption}\n\n${hashtags.join(' ')}` : draft.caption;

				// Pass imageMode to support 'fill' (crop) vs 'fit' (letterbox)
				const imageUrls = await getInstagramUrls(draft.selectedImages, draft.projectId, draft.imageMode || 'fill');

				if (isDryRun) {
					console.log(`🧪 DRY_RUN: skipping publish for ${draft.projectId}`);
					results.push({ postId: slot.id, projectId: draft.projectId, success: true, dryRun: true });
					continue;
				}

				const result = await publishPost({ imageUrls, caption: fullCaption }, accessToken, accountId);

				statusUpdates.set(slot.id, {
					status: 'published',
					publishedAt: new Date().toISOString(),
					instagramMediaId: result.mediaId,
				});

				results.push({ postId: slot.id, projectId: draft.projectId, success: true, mediaId: result.mediaId });
				console.log(`✅ Published: ${draft.projectId}`);
			} catch (error) {
				console.error(`❌ Failed to publish ${draft.projectId}:`, error.message);

				statusUpdates.set(slot.id, {
					status: 'failed',
					error: error.message,
				});

				results.push({ postId: slot.id, projectId: draft.projectId, success: false, error: error.message });
			}
		}

		if (!isDryRun) {
			// Always try to save status updates, with retry logic
			let saveSuccess = false;
			let saveError = null;
			const maxRetries = 3;
			
			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					console.log(`💾 Saving status updates (attempt ${attempt}/${maxRetries})...`);
					await saveWithSmartMerge(statusUpdates);
					console.log('💾 Status updates saved successfully');
					saveSuccess = true;
					break;
				} catch (error) {
					saveError = error;
					console.error(`❌ Save attempt ${attempt} failed: ${error.message}`);
					
					// Wait before retry (exponential backoff: 2s, 4s, then give up)
					if (attempt < maxRetries) {
						const waitMs = Math.pow(2, attempt) * 1000;
						console.log(`⏳ Waiting ${waitMs}ms before retry...`);
						await new Promise(r => setTimeout(r, waitMs));
					}
				}
			}
			
			// Always send notification, including save failure info if applicable
			try {
				const freshDataForEmail = await fetchScheduleData();
				const notificationData = freshDataForEmail || scheduleData;
				
				await sendNotification(results, notificationData, { 
					type: 'Scheduled', 
					saveSuccess, 
					saveError 
				});
			} catch (notificationError) {
				console.error('❌ Failed to send notification:', notificationError.message);
			}
			
			// If save failed, include warning in response
			if (!saveSuccess) {
				console.error('⚠️ WARNING: Status updates failed to save to Cloudinary after 3 attempts');
			}
		}

		console.log('✅ Scheduled publish complete:', results);
		return {
			statusCode: 200,
			headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
			body: JSON.stringify({ ok: true, dryRun: isDryRun, results }),
		};
	} catch (error) {
		console.error('❌ Scheduled publish error:', error);
		return {
			statusCode: 500,
			headers: { 'Content-Type': 'application/json', 'X-Function-Owner': 'studio' },
			body: JSON.stringify({ ok: false, error: error.message }),
		};
	}
};

// Export handler wrapped with schedule() - runs every hour at minute 0 (UTC)
// Cron: '0 * * * *' = minute 0 of every hour
export const handler = schedule('0 * * * *', scheduledHandler);
