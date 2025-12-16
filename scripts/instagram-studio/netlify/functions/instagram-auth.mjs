/**
 * Instagram Auth Netlify Function (Studio-owned copy)
 *
 * Copied from repo root `netlify/functions/instagram-auth.mjs`.
 * This version is deployed ONLY with the Studio site.
 */

const INSTAGRAM_API_BASE = 'https://api.instagram.com';
const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';

// Token expiry is 60 days, we'll set it to 59 to be safe
const TOKEN_EXPIRY_DAYS = 59;

export const handler = async (event) => {
	// CORS headers
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Content-Type': 'application/json',
		'X-Function-Owner': 'studio',
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
		const body = JSON.parse(event.body);
		const { action } = body;

		// Get credentials from environment
		const appId = process.env.INSTAGRAM_APP_ID;
		const appSecret = process.env.INSTAGRAM_APP_SECRET;

		if (!appId || !appSecret) {
			console.error('Missing Instagram credentials');
			return {
				statusCode: 500,
				headers,
				body: JSON.stringify({
					error: 'Server configuration error: Missing Instagram credentials',
				}),
			};
		}

		switch (action) {
			case 'exchange':
				return await handleTokenExchange(body, appId, appSecret, headers);
			case 'refresh':
				return await handleTokenRefresh(body, appSecret, headers);
			default:
				return {
					statusCode: 400,
					headers,
					body: JSON.stringify({ error: 'Invalid action' }),
				};
		}
	} catch (error) {
		console.error('Instagram auth error:', error);
		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({
				error: error instanceof Error ? error.message : 'Unknown error',
			}),
		};
	}
};

/**
 * Exchange authorization code for tokens
 */
async function handleTokenExchange(body, appId, appSecret, headers) {
	const { code, redirectUri } = body;

	if (!code || !redirectUri) {
		return {
			statusCode: 400,
			headers,
			body: JSON.stringify({ error: 'Missing code or redirectUri' }),
		};
	}

	// Step 1: Exchange code for short-lived token
	console.log('📱 Exchanging code for short-lived token...');

	const tokenFormData = new URLSearchParams({
		client_id: appId,
		client_secret: appSecret,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri,
		code: code,
	});

	const tokenResponse = await fetch(`${INSTAGRAM_API_BASE}/oauth/access_token`, {
		method: 'POST',
		body: tokenFormData,
	});

	const tokenData = await tokenResponse.json();

	if (tokenData.error_message || tokenData.error) {
		console.error('Short-lived token error:', tokenData);
		return {
			statusCode: 400,
			headers,
			body: JSON.stringify({
				error:
					tokenData.error_message ||
					tokenData.error?.message ||
					'Token exchange failed',
			}),
		};
	}

	const shortLivedToken = tokenData.access_token;
	const userId = tokenData.user_id;

	console.log('✅ Got short-lived token for user:', userId);

	// Step 2: Exchange for long-lived token
	console.log('🔄 Exchanging for long-lived token...');

	const longLivedParams = new URLSearchParams({
		grant_type: 'ig_exchange_token',
		client_secret: appSecret,
		access_token: shortLivedToken,
	});

	const longLivedResponse = await fetch(
		`${GRAPH_API_BASE}/access_token?${longLivedParams.toString()}`
	);

	const longLivedData = await longLivedResponse.json();

	if (longLivedData.error) {
		console.error('Long-lived token error:', longLivedData.error);
		return {
			statusCode: 400,
			headers,
			body: JSON.stringify({
				error: longLivedData.error.message || 'Long-lived token exchange failed',
			}),
		};
	}

	const longLivedToken = longLivedData.access_token;
	const expiresIn = longLivedData.expires_in; // seconds

	console.log('✅ Got long-lived token, expires in:', expiresIn, 'seconds');

	// Step 3: Get user info
	console.log('👤 Getting user info...');

	const userResponse = await fetch(
		`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/me?fields=id,username,account_type,media_count&access_token=${longLivedToken}`
	);

	const userData = await userResponse.json();

	if (userData.error) {
		console.error('User info error:', userData.error);
		return {
			statusCode: 400,
			headers,
			body: JSON.stringify({
				error: userData.error.message || 'Failed to get user info',
			}),
		};
	}

	console.log('✅ Connected as:', userData.username);

	// Calculate expiry date
	const tokenExpiry = new Date();
	tokenExpiry.setDate(tokenExpiry.getDate() + TOKEN_EXPIRY_DAYS);

	return {
		statusCode: 200,
		headers,
		body: JSON.stringify({
			success: true,
			accessToken: longLivedToken,
			accountId: userData.id,
			username: userData.username,
			accountType: userData.account_type,
			mediaCount: userData.media_count,
			tokenExpiry: tokenExpiry.toISOString(),
			expiresIn: expiresIn,
		}),
	};
}

/**
 * Refresh a long-lived token
 */
async function handleTokenRefresh(body, appSecret, headers) {
	const { accessToken } = body;

	if (!accessToken) {
		return {
			statusCode: 400,
			headers,
			body: JSON.stringify({ error: 'Missing accessToken' }),
		};
	}

	console.log('🔄 Refreshing long-lived token...');

	const refreshParams = new URLSearchParams({
		grant_type: 'ig_refresh_token',
		access_token: accessToken,
	});

	const refreshResponse = await fetch(
		`${GRAPH_API_BASE}/refresh_access_token?${refreshParams.toString()}`
	);

	const refreshData = await refreshResponse.json();

	if (refreshData.error) {
		console.error('Token refresh error:', refreshData.error);
		return {
			statusCode: 400,
			headers,
			body: JSON.stringify({
				error: refreshData.error.message || 'Token refresh failed',
			}),
		};
	}

	const newToken = refreshData.access_token;
	const expiresIn = refreshData.expires_in;

	// Calculate new expiry date
	const tokenExpiry = new Date();
	tokenExpiry.setDate(tokenExpiry.getDate() + TOKEN_EXPIRY_DAYS);

	console.log('✅ Token refreshed, new expiry:', tokenExpiry.toISOString());

	return {
		statusCode: 200,
		headers,
		body: JSON.stringify({
			success: true,
			accessToken: newToken,
			tokenExpiry: tokenExpiry.toISOString(),
			expiresIn: expiresIn,
		}),
	};
}
