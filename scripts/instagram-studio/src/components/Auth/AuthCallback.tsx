import { useEffect, useState } from 'react';
import { exchangeCodeForToken } from '../../services/instagramApi';
import type { InstagramCredentials } from '../../types/instagram';
import styles from './AuthCallback.module.css';

interface AuthCallbackProps {
  onSuccess: (credentials: InstagramCredentials) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function AuthCallback({ onSuccess, onError, onCancel }: AuthCallbackProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const processCallback = async () => {
      // Get the authorization code from URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const errorReason = urlParams.get('error_reason');
      const errorDescription = urlParams.get('error_description');

      // Handle user cancellation or denial
      if (error) {
        const message = errorDescription || errorReason || error;
        setStatus('error');
        setErrorMessage(message);
        onError(message);
        return;
      }

      // No code means something went wrong
      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received');
        onError('No authorization code received');
        return;
      }

      // Exchange code for token
      try {
        const result = await exchangeCodeForToken(code);

        if (result.success && result.credentials) {
          setStatus('success');
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          onSuccess(result.credentials);
        } else {
          throw new Error(result.error || 'Token exchange failed');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus('error');
        setErrorMessage(message);
        onError(message);
      }
    };

    processCallback();
  }, [onSuccess, onError]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {status === 'processing' && (
          <>
            <div className={styles.spinner}></div>
            <h2>Connecting to Instagram...</h2>
            <p>Please wait while we complete the authentication.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className={styles.successIcon}>✓</div>
            <h2>Connected!</h2>
            <p>Your Instagram account has been connected successfully.</p>
            <p className={styles.redirect}>Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className={styles.errorIcon}>✕</div>
            <h2>Connection Failed</h2>
            <p className={styles.errorMessage}>{errorMessage}</p>
            <button onClick={onCancel} className={styles.button}>
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
