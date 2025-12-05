import { useState, useEffect } from 'react';
import styles from './PasswordGate.module.css';

interface PasswordGateProps {
  children: React.ReactNode;
}

// Hash function for password verification (simple but effective for this use case)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Password hash from environment variable
// To generate a hash for your password, run this in browser console:
// crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_PASSWORD')).then(h => console.log(Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('')))
const PASSWORD_HASH = import.meta.env.VITE_PASSWORD_HASH || '';

const AUTH_KEY = 'instagram-studio-auth';
const REMEMBER_KEY = 'instagram-studio-remember';

export function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const savedAuth = localStorage.getItem(AUTH_KEY);
      const savedRemember = localStorage.getItem(REMEMBER_KEY);
      
      if (savedAuth && savedRemember === 'true') {
        // Verify the saved hash is still valid
        if (savedAuth === PASSWORD_HASH) {
          setIsAuthenticated(true);
          return;
        }
      }
      
      // Also check session storage for non-remember sessions
      const sessionAuth = sessionStorage.getItem(AUTH_KEY);
      if (sessionAuth === PASSWORD_HASH) {
        setIsAuthenticated(true);
        return;
      }
      
      setIsAuthenticated(false);
    };
    
    checkAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const hashedInput = await hashPassword(password);
      
      if (hashedInput === PASSWORD_HASH) {
        if (rememberMe) {
          localStorage.setItem(AUTH_KEY, PASSWORD_HASH);
          localStorage.setItem(REMEMBER_KEY, 'true');
        } else {
          sessionStorage.setItem(AUTH_KEY, PASSWORD_HASH);
          localStorage.removeItem(AUTH_KEY);
          localStorage.removeItem(REMEMBER_KEY);
        }
        setIsAuthenticated(true);
      } else {
        setError('Incorrect password');
        setPassword('');
      }
    } catch {
      setError('Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  // Still checking auth status
  if (isAuthenticated === null) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  // Show login form
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.logo}>📸</div>
          <h1 className={styles.title}>Instagram Studio</h1>
          <p className={styles.subtitle}>Enter password to continue</p>
          
          <input
            type="password"
            className={styles.input}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            disabled={isLoading}
          />
          
          <label className={styles.rememberLabel}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
            />
            <span>Remember me</span>
          </label>
          
          {error && <p className={styles.error}>{error}</p>}
          
          <button 
            type="submit" 
            className={styles.button}
            disabled={isLoading || !password}
          >
            {isLoading ? 'Verifying...' : 'Enter'}
          </button>
        </form>
      </div>
    );
  }

  // Authenticated - show the app
  return <>{children}</>;
}
