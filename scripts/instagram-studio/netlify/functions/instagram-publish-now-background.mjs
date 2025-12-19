/**
 * Instagram Manual Publish - Background Function (Studio-owned)
 *
 * Manual trigger to publish scheduled posts immediately.
 * Uses shared library for all Instagram API calls to ensure consistent behavior.
 * 
 * @see lib/instagram-lib.mjs for shared Instagram API functions
 */

import {
	CLOUDINARY_CLOUD,
	fetchScheduleData,
	uploadToCloudinary,
	getInstagramUrls,
	publishPost,
	sendNotification,
} from './lib/instagram-lib.mjs';

// Use "today" window: midnight local time to now
// This catches any post scheduled for today that hasn't been published yet
const USE_TODAY_WINDOW = true;
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000; // Fallback: 1 hour window

export const handler = async (event) => {
	console.log('🔫 Manual Instagram publish triggered at:', new Date().toISOString());

	const dryRunParam = event?.queryStringParameters?.dryRun;
	
	console.log('🔍 Dry run check:', {
		dryRunParam,
		INSTAGRAM_DRY_RUN: process.env.INSTAGRAM_DRY_RUN,
		DRY_RUN: process.env.DRY_RUN,
	});
	
	const isDryRun =
		dryRunParam === '1' ||
		dryRunParam === 'true' ||
		process.env.INSTAGRAM_DRY_RUN === 'true' ||
		process.env.DRY_RUN === 'true';
	
	console.log('🔍 isDryRun result:', isDryRun);

	const headers = {
		'Content-Type': 'application/json',
		'X-Function-Owner': 'studio',
	};

	try {
		const scheduleData = await fetchScheduleData();

		if (!scheduleData) {
			return {
				statusCode: 200,
				headers,
				body: JSON.stringify({ ok: true, skipped: true, reason: 'no_schedule_data' }),
			};
		}

		console.log('📊 Schedule data loaded:', {
			hasInstagram: !!scheduleData.instagram,
			instagramConnected: scheduleData.instagram?.connected,
			hasAccessToken: !!scheduleData.instagram?.accessToken,
			draftsCount: scheduleData.drafts?.length || 0,
			slotsCount: scheduleData.scheduleSlots?.length || 0,
		});

		if (!scheduleData.instagram?.connected || !scheduleData.instagram?.accessToken) {
			console.log('🔌 Instagram not connected');
			return {
				statusCode: 200,
				headers,
				body: JSON.stringify({
					ok: true,
					skipped: true,
					reason: 'not_connected',
					details: {
						connected: !!scheduleData.instagram?.connected,
						hasAccessToken: !!scheduleData.instagram?.accessToken,
					},
				}),
			};
		}

		const { accessToken, accountId } = scheduleData.instagram;

		// Get configured timezone from settings (default to Europe/London)
		const configuredTimezone = scheduleData.settings?.timezone || 'Europe/London';
		console.log(`🌍 Using timezone: ${configuredTimezone}`);

		const now = new Date();
		
		// Format current time in the CONFIGURED timezone
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
		let windowStartDateStr;
		let windowStartTimeStr;
		if (USE_TODAY_WINDOW) {
			windowStartDateStr = todayDateStr;
			windowStartTimeStr = '00:00';
			console.log(`📅 Using TODAY window: ${windowStartDateStr} 00:00 to ${todayDateStr} ${currentTimeStr}`);
		} else {
			const windowStart = new Date(now.getTime() - SCHEDULE_WINDOW_MS);
			const wsYear = windowStart.getFullYear();
			const wsMonth = String(windowStart.getMonth() + 1).padStart(2, '0');
			const wsDay = String(windowStart.getDate()).padStart(2, '0');
			const wsHour = String(windowStart.getHours()).padStart(2, '0');
			const wsMin = String(windowStart.getMinutes()).padStart(2, '0');
			windowStartDateStr = `${wsYear}-${wsMonth}-${wsDay}`;
			windowStartTimeStr = `${wsHour}:${wsMin}`;
			console.log(`⏰ Using 1-HOUR window: ${windowStartDateStr} ${windowStartTimeStr} to ${todayDateStr} ${currentTimeStr}`);
		}

		const draftsMap = new Map((scheduleData.drafts || []).map((d) => [d.id, d]));
		const allSlots = scheduleData.scheduleSlots || [];

		console.log(`📋 Total schedule slots: ${allSlots.length}`);

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
				const windowStartDateTime = `${windowStartDateStr}T${windowStartTimeStr}`;
				
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
			console.log('📭 No posts due for publishing');
			return {
				statusCode: 200,
				headers,
				body: JSON.stringify({
					ok: true,
					skipped: true,
					reason: 'no_posts_due',
					stats: {
						slotsCount: allSlots.length,
						pendingCount: allSlots.filter((s) => s.status === 'pending').length,
					},
				}),
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

				// Use shared library for publishing
				const result = await publishPost({ imageUrls, caption: fullCaption }, accessToken, accountId);

				statusUpdates.set(slot.id, {
					status: 'published',
					publishedAt: new Date().toISOString(),
					instagramMediaId: result.mediaId || result.postId,
				});

				results.push({ postId: slot.id, projectId: draft.projectId, success: true, mediaId: result.mediaId || result.postId });
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

		if (!isDryRun && statusUpdates.size > 0) {
			// Save status updates with smart merge
			let saveSuccess = false;
			let saveError = null;
			const maxRetries = 3;
			
			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					console.log(`💾 Saving status updates (attempt ${attempt}/${maxRetries})...`);
					
					const freshData = await fetchScheduleData();
					if (!freshData) {
						throw new Error('Cannot save: failed to fetch fresh data for merge');
					}

					let updatedCount = 0;
					for (const slot of freshData.scheduleSlots || []) {
						const update = statusUpdates.get(slot.id);
						if (update) {
							slot.status = update.status;
							if (update.publishedAt) slot.publishedAt = update.publishedAt;
							if (update.instagramMediaId) slot.instagramMediaId = update.instagramMediaId;
							if (update.error) slot.error = update.error;
							slot.updatedAt = new Date().toISOString();
							updatedCount++;
							console.log(`  ✓ Applied status update to slot ${slot.id}: ${update.status}`);
						}
					}

					console.log(`🔄 Smart merge: Applied ${updatedCount} status updates`);
					await uploadToCloudinary(freshData);
					console.log('💾 Status updates saved successfully');
					saveSuccess = true;
					break;
				} catch (error) {
					saveError = error;
					console.error(`❌ Save attempt ${attempt} failed: ${error.message}`);
					
					if (attempt < maxRetries) {
						const waitMs = Math.pow(2, attempt) * 1000;
						console.log(`⏳ Waiting ${waitMs}ms before retry...`);
						await new Promise(r => setTimeout(r, waitMs));
					}
				}
			}

			// Send notification
			try {
				const freshDataForEmail = await fetchScheduleData();
				await sendNotification(results, freshDataForEmail || scheduleData, { 
					type: 'Manual',
					saveSuccess,
					saveError
				});
			} catch (notificationError) {
				console.error('📧 Failed to send notification:', notificationError.message);
			}
			
			if (!saveSuccess) {
				console.error('⚠️ WARNING: Status updates failed to save to Cloudinary after 3 attempts');
			}
		}

		console.log('✅ Manual publish complete:', results);
		return {
			statusCode: 200,
			headers,
			body: JSON.stringify({
				ok: true,
				dryRun: isDryRun,
				results,
			}),
		};
	} catch (error) {
		console.error('❌ Manual publish error:', error);
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({ ok: false, error: error.message }),
		};
	}
};
