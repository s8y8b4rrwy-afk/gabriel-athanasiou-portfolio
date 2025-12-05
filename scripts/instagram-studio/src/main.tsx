import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PasswordGate } from './components/Auth/PasswordGate';
import { resetDailyPostCount, getRateLimitInfo } from './services/instagramApi';
import './index.css';

// Expose debug utilities to window for console access
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).resetPostCount = resetDailyPostCount;
  (window as unknown as Record<string, unknown>).getRateLimitInfo = getRateLimitInfo;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </React.StrictMode>
);
