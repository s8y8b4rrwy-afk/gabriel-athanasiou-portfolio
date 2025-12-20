import { useState, useEffect } from 'react';
import { 
  getAuthorizationUrl, 
  getCredentialsLocally, 
  disconnectInstagram,
  refreshAccessToken,
  shouldRefreshToken,
  isTokenExpired,
  getRateLimitInfo,
  fetchRateLimitFromCloud,
  canPublishPost,
} from '../../services/instagramApi';
import type { InstagramCredentials, RateLimitInfo } from '../../types/instagram';
import styles from './InstagramConnect.module.css';

interface InstagramConnectProps {
  credentials: InstagramCredentials | null;
  onCredentialsChange: (credentials: InstagramCredentials | null) => void;
}

export function InstagramConnect({ credentials, onCredentialsChange }: InstagramConnectProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load rate limit info - first from cache, then fetch fresh from cloud
  useEffect(() => {
    // Immediately show cached data
    const cachedInfo = getRateLimitInfo();
    setRateLimitInfo(cachedInfo);
    
    // Then fetch fresh data from Cloudinary
    fetchRateLimitFromCloud().then((cloudInfo) => {
      if (cloudInfo) {
        setRateLimitInfo(cloudInfo);
      }
    });
  }, []);

  // Check if token needs refresh on mount
  useEffect(() => {
    if (credentials && shouldRefreshToken(credentials) && !isTokenExpired(credentials)) {
      handleRefresh();
    }
  }, [credentials]);

  const handleConnect = () => {
    const authUrl = getAuthorizationUrl();
    window.location.href = authUrl;
  };

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect your Instagram account?')) {
      disconnectInstagram();
      onCredentialsChange(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshAccessToken();
      if (result.success && result.credentials) {
        onCredentialsChange(result.credentials);
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getConnectionStatus = (): { status: 'connected' | 'expiring' | 'expired' | 'disconnected'; message: string } => {
    if (!credentials) {
      return { status: 'disconnected', message: 'Not connected' };
    }

    if (isTokenExpired(credentials)) {
      return { status: 'expired', message: 'Token expired - please reconnect' };
    }

    if (shouldRefreshToken(credentials)) {
      return { status: 'expiring', message: 'Token expiring soon' };
    }

    return { status: 'connected', message: 'Connected' };
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const connectionStatus = getConnectionStatus();
  const canPost = rateLimitInfo ? canPublishPost() : true;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.instagramIcon}>📷</div>
        <div className={styles.headerText}>
          <h3>Instagram Connection</h3>
          <span className={`${styles.status} ${styles[connectionStatus.status]}`}>
            {connectionStatus.message}
          </span>
        </div>
      </div>

      {credentials ? (
        <div className={styles.connectedState}>
          <div className={styles.accountInfo}>
            <div className={styles.username}>@{credentials.username}</div>
            <div className={styles.accountId}>ID: {credentials.accountId}</div>
          </div>

          <button 
            className={styles.detailsToggle}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▲ Hide Details' : '▼ Show Details'}
          </button>

          {showDetails && (
            <div className={styles.details}>
              <div className={styles.detailRow}>
                <span>Token Expires:</span>
                <span>{formatDate(credentials.tokenExpiry)}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Last Refreshed:</span>
                <span>{formatDate(credentials.lastRefreshed)}</span>
              </div>
              {rateLimitInfo && (
                <>
                  <div className={styles.detailRow}>
                    <span>API Usage:</span>
                    <span>
                      {rateLimitInfo.appUsage 
                        ? `${rateLimitInfo.appUsage.callCount}% used` 
                        : `${rateLimitInfo.callsRemaining} / ${rateLimitInfo.callsLimit} remaining`}
                    </span>
                  </div>
                  {rateLimitInfo.businessUsage?.useCases?.['IG_CONTENT_PUBLISHING'] && (
                    <div className={styles.detailRow}>
                      <span>Content Publishing:</span>
                      <span>
                        {rateLimitInfo.businessUsage.useCases['IG_CONTENT_PUBLISHING'].callCount}% used
                        {rateLimitInfo.businessUsage.useCases['IG_CONTENT_PUBLISHING'].estimatedTimeToRegainAccess > 0 && (
                          <span className={styles.warning}>
                            {' '}(reset in {rateLimitInfo.businessUsage.useCases['IG_CONTENT_PUBLISHING'].estimatedTimeToRegainAccess}m)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className={styles.detailRow}>
                    <span>Posts Today:</span>
                    <span className={!canPost ? styles.warning : ''}>
                      {rateLimitInfo.postsToday} / {rateLimitInfo.postsLimit}
                    </span>
                  </div>
                  {rateLimitInfo.lastUpdated && (
                    <div className={styles.detailRow}>
                      <span>Rate Limit Updated:</span>
                      <span>{formatDate(rateLimitInfo.lastUpdated)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className={styles.actions}>
            {(connectionStatus.status === 'expiring' || connectionStatus.status === 'expired') && (
              <button 
                className={styles.refreshButton}
                onClick={connectionStatus.status === 'expired' ? handleConnect : handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : connectionStatus.status === 'expired' ? 'Reconnect' : 'Refresh Token'}
              </button>
            )}
            <button 
              className={styles.disconnectButton}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.disconnectedState}>
          <p className={styles.description}>
            Connect your Instagram Business or Creator account to publish posts directly from this app.
          </p>
          <button className={styles.connectButton} onClick={handleConnect}>
            <span className={styles.igLogo}>📷</span>
            Connect Instagram Account
          </button>
          <p className={styles.note}>
            Requires a Business or Creator account linked to a Facebook Page.
          </p>
        </div>
      )}
    </div>
  );
}
