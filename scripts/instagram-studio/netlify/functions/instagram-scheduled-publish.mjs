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

import crypto from 'crypto';
import { schedule } from '@netlify/functions';
import {
	GRAPH_API_BASE,
	GRAPH_API_VERSION,
	CLOUDINARY_CLOUD,
	waitForMediaReady,
	publishMediaContainer,
	createMediaContainer,
	createCarouselContainer,
} from './lib/instagram-lib.mjs';

const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;

// Catch-up window: publish any pending posts from today that are past their scheduled time
// This means a post scheduled for 11am will still publish if the function runs at 6pm
const USE_TODAY_WINDOW = true; // Set to false to revert to 1-hour window
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000; // Fallback: 1 hour window

async function sendNotification(results, scheduleData, saveSuccess = true, saveError = null) {
	const resendApiKey = process.env.RESEND_API_KEY;
	const notificationEmail = process.env.NOTIFICATION_EMAIL;

	if (!resendApiKey || !notificationEmail) {
		console.log('📧 Notification skipped: RESEND_API_KEY or NOTIFICATION_EMAIL not configured');
		return;
	}

	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);

	const subject =
		failed.length > 0
			? `⚠️ Instagram: ${successful.length} published, ${failed.length} failed`
			: `✅ Instagram: ${successful.length} post(s) published`;

	let html = `<h2>Instagram Scheduled Publish Report</h2>`;
	html += `<p>Time: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>`;
	
	// Add save status warning if applicable
	if (!saveSuccess && saveError) {
		html += `<div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 4px;">`;
		html += `<strong>⚠️ Data Save Failed:</strong> Status updates for published posts could not be saved to Cloudinary.`;
		html += `<p>Error: ${saveError.message}</p>`;
		html += `<p>The posts were published to Instagram, but their status may not be marked as "published" in the schedule.</p>`;
		html += `</div>`;
	}

	if (successful.length > 0) {
		html += `<h3>✅ Successfully Published (${successful.length})</h3><ul>`;
		for (const r of successful) {
			const post = (scheduleData.schedules || []).find((p) => p.id === r.postId);
			html += `<li><strong>${post?.projectId || r.postId}</strong> - Media ID: ${r.mediaId}</li>`;
		}
		html += `</ul>`;
	}

	if (failed.length > 0) {
		html += `<h3>❌ Failed (${failed.length})</h3><ul>`;
		for (const r of failed) {
			const post = (scheduleData.schedules || []).find((p) => p.id === r.postId);
			html += `<li><strong>${post?.projectId || r.postId}</strong> - Error: ${r.error}</li>`;
		}
		html += `</ul>`;
	}

	html += `<p><a href="https://studio.lemonpost.studio">Open Instagram Studio →</a></p>`;

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${resendApiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: 'Instagram Studio <noreply@lemonpost.studio>',
				to: [notificationEmail],
				subject: subject,
				html: html,
			}),
		});

		if (response.ok) {
			console.log('📧 Notification email sent successfully');
		} else {
			const error = await response.text();
			console.error('📧 Failed to send notification:', error);
		}
	} catch (error) {
		console.error('📧 Notification error:', error.message);
	}
}

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
				if (slot.status !== 'pending') return false;
				
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

				const imageUrls = await getInstagramUrls(draft.selectedImages, draft.projectId);

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
				
				await sendNotification(results, notificationData, saveSuccess, saveError);
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

async function fetchScheduleData() {
	const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/raw/upload/instagram-studio/schedule-data?t=${Date.now()}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			if (response.status === 404) return null;
			throw new Error(`Failed to fetch: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		console.error('Error fetching schedule data:', error);
		return null;
	}
}

async function saveWithSmartMerge(statusUpdates) {
	console.log('🔄 Smart merge: Fetching fresh cloud data before save...');

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
	return await uploadToCloudinary(freshData);
}

async function uploadToCloudinary(data) {
	const apiSecret = process.env.CLOUDINARY_API_SECRET;
	if (!CLOUDINARY_API_KEY) {
		throw new Error('CLOUDINARY_API_KEY not configured');
	}
	if (!apiSecret) {
		throw new Error('CLOUDINARY_API_SECRET not configured');
	}

	data.lastUpdated = new Date().toISOString();
	data.lastMergedAt = new Date().toISOString();

	const timestamp = Math.floor(Date.now() / 1000);
	const publicId = 'instagram-studio/schedule-data';

	// Cloudinary requires ALL parameters to be included in signature (alphabetically sorted)
	const signatureString = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
	const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

	const formData = new URLSearchParams();
	formData.append(
		'file',
		`data:application/json;base64,${Buffer.from(JSON.stringify(data, null, 2)).toString('base64')}`
	);
	formData.append('public_id', publicId);
	formData.append('timestamp', timestamp.toString());
	formData.append('api_key', CLOUDINARY_API_KEY);
	formData.append('signature', signature);
	formData.append('resource_type', 'raw');
	formData.append('overwrite', 'true');

	const response = await fetch(
		`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: formData.toString(),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		// Log detailed error info for debugging
		console.error('Cloudinary upload details:', {
			status: response.status,
			statusText: response.statusText,
			error: error.substring(0, 500), // First 500 chars
			timestamp: timestamp,
			publicId: publicId,
		});
		throw new Error(`Failed to save to Cloudinary (${response.status}): ${error.substring(0, 200)}`);
	}

	const result = await response.json();
	console.log('✅ Cloudinary upload successful:', { publicId, url: result.secure_url?.substring(0, 100) });
	return result;
}

async function getInstagramUrls(imageUrls, projectId) {
	const results = [];
	const ASPECT_PORTRAIT = '0.8';
	const CLOUDINARY_CLOUD = 'date24ay6';

	for (let i = 0; i < imageUrls.length; i++) {
		const url = imageUrls[i];
		let imageIndex = i;

		if (url.includes('res.cloudinary.com')) {
			const match = url.match(/portfolio-projects-[^-]+-(\d+)/);
			if (match) {
				imageIndex = parseInt(match[1], 10);
			}
		}

		const publicId = `portfolio-projects-${projectId}-${imageIndex}`;
		const instagramUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/ar_${ASPECT_PORTRAIT},c_lfill,b_black,g_center,q_95,f_jpg/w_1440,c_limit/${publicId}.jpg`;

		results.push(instagramUrl);
	}

	return results;
}

async function publishPost(post, accessToken, accountId) {
	const { imageUrls, caption } = post;

	if (!imageUrls || imageUrls.length === 0) {
		throw new Error('No images to publish');
	}

	if (imageUrls.length === 1) {
		return await publishSingleImage(imageUrls[0], caption, accessToken, accountId);
	} else {
		return await publishCarousel(imageUrls, caption, accessToken, accountId);
	}
}

/**
 * Publish a single image to Instagram
 * Uses shared library functions from instagram-lib.mjs
 */
async function publishSingleImage(imageUrl, caption, accessToken, accountId) {
	// Create media container using shared lib
	const containerResult = await createMediaContainer(accessToken, accountId, imageUrl, caption, false);
	
	if (containerResult.error) {
		throw new Error(containerResult.error);
	}

	const containerId = containerResult.id;
	
	// Wait for processing using shared lib
	const ready = await waitForMediaReady(containerId, accessToken);
	if (!ready.success) {
		throw new Error(ready.error || 'Media processing failed');
	}

	// Publish using shared lib (includes rate limit handling)
	const publishResult = await publishMediaContainer(containerId, accessToken, accountId);
	
	if (!publishResult.success) {
		throw new Error(publishResult.error || 'Publish failed');
	}

	return { mediaId: publishResult.postId };
}

/**
 * Publish a carousel (multiple images) to Instagram
 * Uses shared library functions from instagram-lib.mjs
 */
async function publishCarousel(imageUrls, caption, accessToken, accountId) {
	const childIds = [];

	// Create child containers for each image using shared lib
	for (const imageUrl of imageUrls) {
		const childResult = await createMediaContainer(accessToken, accountId, imageUrl, null, true);
		
		if (childResult.error) {
			throw new Error(`Failed to create carousel item: ${childResult.error}`);
		}

		childIds.push(childResult.id);
		
		// Wait for each item using shared lib
		const ready = await waitForMediaReady(childResult.id, accessToken);
		if (!ready.success) {
			throw new Error(`Carousel item processing failed: ${ready.error}`);
		}
	}

	// Create carousel container using shared lib
	const containerResult = await createCarouselContainer(accessToken, accountId, childIds, caption);
	
	if (containerResult.error) {
		throw new Error(containerResult.error);
	}

	const containerId = containerResult.id;
	
	// Wait for carousel processing using shared lib
	const ready = await waitForMediaReady(containerId, accessToken);
	if (!ready.success) {
		throw new Error(ready.error || 'Carousel processing failed');
	}

	// Publish using shared lib (includes rate limit handling)
	const publishResult = await publishMediaContainer(containerId, accessToken, accountId);
	
	if (!publishResult.success) {
		throw new Error(publishResult.error || 'Publish failed');
	}

	return { mediaId: publishResult.postId };
}

