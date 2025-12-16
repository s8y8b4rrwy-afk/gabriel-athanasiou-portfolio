/**
 * Instagram Scheduled Publish - Manual Trigger (Studio-owned copy)
 *
 * Copied from repo root `netlify/functions/instagram-publish-now.mjs`.
 */

import crypto from 'crypto';

const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';
const CLOUDINARY_CLOUD = 'date24ay6';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;

// NOTE: Use instagram-publish-now-background.mjs for longer timeouts (2 min)
// This non-background version has 10s timeout limit
const MAX_PROCESSING_WAIT = 30000; // 30 seconds (will hit Netlify timeout first)
const POLL_INTERVAL = 2000;
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000;

// Use "today" window (midnight UTC to now) instead of 1-hour window
// This catches any post scheduled for today that hasn't been published yet
const USE_TODAY_WINDOW = true;

async function sendNotification(results, scheduleData) {
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
			? `⚠️ Instagram Manual Publish: ${successful.length} published, ${failed.length} failed`
			: `✅ Instagram Manual Publish: ${successful.length} post(s) published`;

	let html = `<h2>Instagram Manual Publish Report</h2>`;
	html += `<p>Time: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>`;

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

export const handler = async (event) => {
	console.log('🔫 Manual Instagram publish triggered at:', new Date().toISOString());

	const dryRunParam = event?.queryStringParameters?.dryRun;
	
	// Debug: log env vars
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

		const now = new Date();
		// Use "today" window: midnight UTC to now
		let windowStart;
		if (USE_TODAY_WINDOW) {
			windowStart = new Date(now);
			windowStart.setUTCHours(0, 0, 0, 0);
		} else {
			windowStart = new Date(now.getTime() - SCHEDULE_WINDOW_MS);
		}

		console.log('📅 Window config:', {
			now: now.toISOString(),
			windowStart: windowStart.toISOString(),
			useTodayWindow: USE_TODAY_WINDOW,
		});

		const draftsMap = new Map((scheduleData.drafts || []).map((d) => [d.id, d]));
		const allSlots = scheduleData.scheduleSlots || [];

		const duePosts = allSlots
			.filter((slot) => {
				if (slot.status !== 'pending') return false;
				const scheduledDateTime = new Date(`${slot.scheduledDate}T${slot.scheduledTime}:00`);
				return scheduledDateTime <= now && scheduledDateTime >= windowStart;
			})
			.map((slot) => {
				const draft = draftsMap.get(slot.postDraftId);
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
			await saveWithSmartMerge(statusUpdates);

			const freshDataForEmail = await fetchScheduleData();
			await sendNotification(results, freshDataForEmail || scheduleData);
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

	const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
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
		throw new Error(`Failed to save to Cloudinary: ${error}`);
	}

	return await response.json();
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

async function publishSingleImage(imageUrl, caption, accessToken, accountId) {
	const containerResponse = await fetch(
		`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				image_url: imageUrl,
				caption: caption,
				access_token: accessToken,
			}),
		}
	);

	const containerData = await containerResponse.json();
	if (containerData.error) {
		throw new Error(containerData.error.message);
	}

	const containerId = containerData.id;
	await waitForMediaReady(containerId, accessToken);

	const publishResponse = await fetch(
		`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media_publish`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				creation_id: containerId,
				access_token: accessToken,
			}),
		}
	);

	const publishData = await publishResponse.json();
	if (publishData.error) {
		throw new Error(publishData.error.message);
	}

	return { mediaId: publishData.id };
}

async function publishCarousel(imageUrls, caption, accessToken, accountId) {
	const childIds = [];

	for (const imageUrl of imageUrls) {
		const childResponse = await fetch(
			`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					image_url: imageUrl,
					access_token: accessToken,
				}),
			}
		);

		const childData = await childResponse.json();
		if (childData.error) {
			throw new Error(`Failed to create carousel item: ${childData.error.message}`);
		}

		childIds.push(childData.id);
	}

	const containerResponse = await fetch(
		`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				media_type: 'CAROUSEL',
				children: childIds,
				caption: caption,
				access_token: accessToken,
			}),
		}
	);

	const containerData = await containerResponse.json();
	if (containerData.error) {
		throw new Error(containerData.error.message);
	}

	const containerId = containerData.id;
	await waitForMediaReady(containerId, accessToken);

	const publishResponse = await fetch(
		`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${accountId}/media_publish`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				creation_id: containerId,
				access_token: accessToken,
			}),
		}
	);

	const publishData = await publishResponse.json();
	if (publishData.error) {
		throw new Error(publishData.error.message);
	}

	return { mediaId: publishData.id };
}

async function waitForMediaReady(mediaId, accessToken) {
	const startTime = Date.now();

	while (Date.now() - startTime < MAX_PROCESSING_WAIT) {
		const response = await fetch(
			`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${mediaId}?fields=status&access_token=${accessToken}`
		);

		const data = await response.json();
		if (data.error) {
			throw new Error(`Failed to check media status: ${data.error.message}`);
		}

		if (data.status === 'READY') {
			return;
		}

		if (data.status === 'ERROR') {
			throw new Error('Instagram media processing failed');
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
	}

	throw new Error('Media processing timeout');
}
