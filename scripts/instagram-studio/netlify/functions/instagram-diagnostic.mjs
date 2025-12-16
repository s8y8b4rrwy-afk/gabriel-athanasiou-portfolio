/**
 * Instagram Diagnostic - Netlify Function (Studio-owned copy)
 *
 * Copied from repo root `netlify/functions/instagram-diagnostic.mjs`.
 */

const CLOUDINARY_CLOUD = 'date24ay6';
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000;

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

		const now = new Date();
		const windowStart = new Date(now.getTime() - SCHEDULE_WINDOW_MS);
		const allSlots = scheduleData.scheduleSlots || [];

		const statusDist = {};
		for (const slot of allSlots) {
			statusDist[slot.status] = (statusDist[slot.status] || 0) + 1;
		}

		const draftsMap = new Map((scheduleData.drafts || []).map((d) => [d.id, d]));

		const dueSlots = allSlots.filter((slot) => {
			if (slot.status !== 'pending') return false;
			const scheduledDateTime = new Date(`${slot.scheduledDate}T${slot.scheduledTime}:00`);
			return scheduledDateTime <= now && scheduledDateTime >= windowStart;
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
			now: now.toISOString(),
			windowStart: windowStart.toISOString(),
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
