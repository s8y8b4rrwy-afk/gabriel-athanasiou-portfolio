/**
 * Instagram Studio Diagnostic Function
 * 
 * Helps debug why scheduled posts aren't publishing.
 * Call it to see:
 * - What data is in Cloudinary
 * - What posts are due for publishing
 * - Why they might not be publishing
 * - Any configuration issues
 * 
 * URL: /.netlify/functions/instagram-diagnostic
 */

const CLOUDINARY_CLOUD = 'date24ay6';
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const handler = async (event) => {
  console.log('🔍 Diagnostic check started');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    checks: {},
    warnings: [],
    errors: [],
  };

  try {
    // 1. Check Cloudinary connection and fetch data
    console.log('📡 Fetching schedule data from Cloudinary...');
    const scheduleData = await fetchScheduleData();
    
    if (!scheduleData) {
      diagnostics.errors.push('❌ No schedule data found in Cloudinary');
      diagnostics.checks.cloudinaryData = { status: 'ERROR', message: 'No schedule data' };
      return {
        statusCode: 200,
        body: JSON.stringify(diagnostics, null, 2),
      };
    }

    diagnostics.checks.cloudinaryData = {
      status: 'OK',
      timestamp: scheduleData.exportedAt,
      draftsCount: (scheduleData.drafts || []).length,
      scheduleSlotsCount: (scheduleData.scheduleSlots || []).length,
      templatesCount: (scheduleData.templates || []).length,
    };

    // 2. Check Instagram connection
    const hasConnection = scheduleData.instagram?.connected && scheduleData.instagram?.accessToken;
    diagnostics.checks.instagramConnection = {
      status: hasConnection ? 'OK' : 'ERROR',
      connected: scheduleData.instagram?.connected || false,
      hasAccessToken: !!scheduleData.instagram?.accessToken,
      accountId: scheduleData.instagram?.accountId || 'NOT SET',
    };

    if (!hasConnection) {
      diagnostics.errors.push('❌ Instagram not connected or no access token');
    }

    // 3. Analyze schedule slots and find due posts
    console.log('🔎 Analyzing schedule slots...');
    const now = new Date();
    const windowStart = new Date(now.getTime() - SCHEDULE_WINDOW_MS);

    const slots = scheduleData.scheduleSlots || [];
    const draftsMap = new Map((scheduleData.drafts || []).map(d => [d.id, d]));

    const slotAnalysis = {
      total: slots.length,
      byStatus: {
        pending: 0,
        published: 0,
        failed: 0,
      },
      duePosts: [],
      almostDue: [],
      future: [],
      pastDue: [],
    };

    for (const slot of slots) {
      // Count by status
      slotAnalysis.byStatus[slot.status] = (slotAnalysis.byStatus[slot.status] || 0) + 1;

      const draft = draftsMap.get(slot.postDraftId);
      const scheduledDateTime = new Date(`${slot.scheduledDate}T${slot.scheduledTime}:00`);
      const timeToPublish = scheduledDateTime.getTime() - now.getTime();

      const postInfo = {
        slotId: slot.id,
        projectId: draft?.projectId || 'UNKNOWN',
        scheduledTime: `${slot.scheduledDate} ${slot.scheduledTime}`,
        status: slot.status,
        draftFound: !!draft,
        imagesCount: draft?.selectedImages.length || 0,
        timeToPublish: Math.floor(timeToPublish / 1000 / 60) + ' minutes',
      };

      // Categorize
      if (slot.status === 'pending') {
        if (scheduledDateTime <= now && scheduledDateTime >= windowStart) {
          slotAnalysis.duePosts.push({
            ...postInfo,
            reason: 'SHOULD PUBLISH NOW',
          });
        } else if (scheduledDateTime > now && scheduledDateTime <= new Date(now.getTime() + 5 * 60000)) {
          slotAnalysis.almostDue.push({
            ...postInfo,
            reason: 'Due in < 5 minutes',
          });
        } else if (scheduledDateTime > now) {
          slotAnalysis.future.push(postInfo);
        } else {
          slotAnalysis.pastDue.push({
            ...postInfo,
            reason: 'Should have been published',
            hoursAgo: Math.floor((now.getTime() - scheduledDateTime.getTime()) / 1000 / 3600),
          });
        }
      }
    }

    diagnostics.checks.scheduleSlots = slotAnalysis;

    // 4. Check for environment variables
    diagnostics.checks.environment = {
      hasCloudinaryApiSecret: !!process.env.CLOUDINARY_API_SECRET,
      hasResendApiKey: !!process.env.RESEND_API_KEY,
      hasNotificationEmail: !!process.env.NOTIFICATION_EMAIL,
      cloudinaryCloud: process.env.CLOUDINARY_CLOUD || 'NOT SET',
      cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ? '***' : 'NOT SET',
    };

    // 5. Generate recommendations
    if (slotAnalysis.duePosts.length > 0 && !hasConnection) {
      diagnostics.warnings.push('⚠️  Posts are due but Instagram is not connected');
    }

    if (slotAnalysis.duePosts.length > 0 && hasConnection && !process.env.CLOUDINARY_API_SECRET) {
      diagnostics.warnings.push('⚠️  Posts are due and Instagram is connected, but CLOUDINARY_API_SECRET is not set - status updates will fail');
    }

    if (slotAnalysis.byStatus.pending === 0 && slotAnalysis.byStatus.published === 0) {
      diagnostics.warnings.push('ℹ️  No scheduled posts found. Have you created any schedules?');
    }

    if (slotAnalysis.duePosts.length === 0 && slotAnalysis.future.length === 0) {
      diagnostics.warnings.push('ℹ️  No future posts scheduled.');
    }

    // Add summary
    diagnostics.summary = {
      scheduleDataFound: true,
      instagramConnected: hasConnection,
      pendingPostsCount: slotAnalysis.byStatus.pending,
      duePostsCount: slotAnalysis.duePosts.length,
      pastDueCount: slotAnalysis.pastDue.length,
      readyToPublish: hasConnection && slotAnalysis.duePosts.length > 0,
    };

    console.log('✅ Diagnostic check complete');
    return {
      statusCode: 200,
      body: JSON.stringify(diagnostics, null, 2),
    };

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    diagnostics.errors.push(`Fatal error: ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify(diagnostics, null, 2),
    };
  }
};

/**
 * Fetch schedule data from Cloudinary
 */
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
