import crypto from 'crypto';

/**
 * Instagram Studio Sync Function
 * 
 * Handles signed uploads to Cloudinary for Instagram Studio data.
 * This keeps the API secret secure on the server side.
 * 
 * Endpoints:
 * - POST: Upload schedule data to Cloudinary
 * - GET: Generate a signed URL for fetching (not needed, public read)
 */

const CLOUDINARY_CLOUD_NAME = 'date24ay6';
const CLOUDINARY_FOLDER = 'instagram-studio';
const DEFAULT_PUBLIC_ID = 'schedule-data';

/**
 * Get the public ID for the schedule data based on profile
 * @param profileId - Optional profile ID (defaults to 'default')
 */
function getPublicId(profileId) {
  if (!profileId || profileId === 'default') {
    return DEFAULT_PUBLIC_ID;
  }
  return `schedule-data-${profileId}`;
}

/**
 * Generate Cloudinary signature for signed uploads
 * Cloudinary uses SHA-1 for signatures
 */
function generateSignature(paramsToSign, apiSecret) {
  const sortedParams = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&');
  
  return crypto
    .createHash('sha1')
    .update(sortedParams + apiSecret)
    .digest('hex');
}

export const handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get Cloudinary credentials from environment
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing Cloudinary credentials');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error: Missing Cloudinary credentials' 
        }),
      };
    }

    // Parse the request body
    const body = JSON.parse(event.body);
    const { scheduleData, profileId } = body;

    if (!scheduleData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing scheduleData in request body' }),
      };
    }

    // Get profile-specific public ID
    const publicId = getPublicId(profileId);

    // Prepare the upload - only sign the required params
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      folder: CLOUDINARY_FOLDER,
      invalidate: 'true',
      overwrite: 'true',
      public_id: publicId,
      timestamp: timestamp,
    };

    const signature = generateSignature(paramsToSign, apiSecret);

    // Convert schedule data to a file
    const jsonString = JSON.stringify(scheduleData, null, 2);
    const base64Data = Buffer.from(jsonString).toString('base64');
    const dataUri = `data:application/json;base64,${base64Data}`;

    // Upload to Cloudinary using signed upload
    const formData = new URLSearchParams();
    formData.append('file', dataUri);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', CLOUDINARY_FOLDER);
    formData.append('public_id', publicId);
    formData.append('overwrite', 'true');
    formData.append('invalidate', 'true');

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const result = await uploadResponse.json();

    if (result.error) {
      console.error('Cloudinary upload error:', result.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    console.log('✅ Instagram Studio data synced to Cloudinary:', result.secure_url);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        version: result.version,
      }),
    };
  } catch (error) {
    console.error('Instagram Studio sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
    };
  }
};
