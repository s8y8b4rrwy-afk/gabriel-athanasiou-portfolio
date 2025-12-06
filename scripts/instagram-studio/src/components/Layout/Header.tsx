import React from 'react';
import './Header.css';

type ViewMode = 'create' | 'schedule' | 'templates' | 'sync' | 'settings';

interface HeaderProps {
  onRefresh?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  pendingCount?: number;
  isConnected?: boolean;
  isSyncing?: boolean;
  syncSuccess?: string | null;
  syncError?: string | null;
  lastSyncedAt?: Date | string | null;
}

export function Header({ 
  onRefresh, 
  viewMode, 
  onViewModeChange, 
  pendingCount = 0, 
  isConnected = false,
  isSyncing = false,
  syncSuccess = null,
  syncError = null,
  lastSyncedAt = null,
}: HeaderProps) {
  // Format last synced time
  const formatLastSynced = () => {
    if (!lastSyncedAt) return '';
    // Handle both Date objects and date strings
    const syncDate = lastSyncedAt instanceof Date ? lastSyncedAt : new Date(lastSyncedAt);
    if (isNaN(syncDate.getTime())) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return syncDate.toLocaleDateString();
  };

  // Determine sync status display
  const getSyncStatus = () => {
    if (isSyncing) return { icon: '🔄', text: 'Syncing...', className: 'syncing' };
    if (syncError) return { icon: '❌', text: 'Sync failed', className: 'error' };
    if (syncSuccess) return { icon: '✅', text: formatLastSynced() || 'Synced', className: 'success' };
    if (lastSyncedAt) return { icon: '☁️', text: formatLastSynced(), className: 'idle' };
    return { icon: '☁️', text: 'Not synced', className: 'idle' };
  };

  const syncStatus = getSyncStatus();

  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">🍋</span>
        <h1 className="header-title">Lemon Post Studio</h1>
      </div>
      
      {onViewModeChange && (
        <nav className="header-nav">
          <button 
            className={`nav-button ${viewMode === 'create' ? 'active' : ''}`}
            onClick={() => onViewModeChange('create')}
          >
            ✏️ Create
          </button>
          <button 
            className={`nav-button ${viewMode === 'schedule' ? 'active' : ''}`}
            onClick={() => onViewModeChange('schedule')}
          >
            📅 Schedule {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </button>
          <button 
            className={`nav-button ${viewMode === 'templates' ? 'active' : ''}`}
            onClick={() => onViewModeChange('templates')}
          >
            📝 Templates
          </button>
          <button 
            className={`nav-button ${viewMode === 'sync' ? 'active' : ''}`}
            onClick={() => onViewModeChange('sync')}
          >
            <span className={`sync-nav-icon ${isSyncing ? 'spinning' : ''}`}>☁️</span> 
            <span className="sync-nav-text">{syncStatus.text}</span>
            <span className={`sync-status-dot ${syncStatus.className}`}>●</span>
          </button>
          <button 
            className={`nav-button ${viewMode === 'settings' ? 'active' : ''}`}
            onClick={() => onViewModeChange('settings')}
          >
            ⚙️ Settings
            {isConnected && <span className="connected-dot">●</span>}
          </button>
        </nav>
      )}
      
      <div className="header-actions">
        {onRefresh && (
          <button className="header-button" onClick={onRefresh} title="Refresh Projects">
            🔄
          </button>
        )}
        <a
          href="https://www.instagram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="header-button"
          title="Open Instagram"
        >
          📱
        </a>
      </div>
    </header>
  );
}
