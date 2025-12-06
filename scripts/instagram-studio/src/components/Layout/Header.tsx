import './Header.css';

type ViewMode = 'create' | 'schedule' | 'templates' | 'sync' | 'settings';

interface HeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  pendingCount?: number;
  isConnected?: boolean;
  isSyncing?: boolean;
  syncSuccess?: string | null;
  syncError?: string | null;
  lastSyncedAt?: Date | string | null;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({ 
  viewMode, 
  onViewModeChange, 
  pendingCount = 0, 
  isConnected = false,
  isSyncing = false,
  syncSuccess = null,
  syncError = null,
  lastSyncedAt = null,
  sidebarCollapsed = false,
  onToggleSidebar,
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

  // Helper to handle view changes - collapses sidebar on mobile
  const handleViewChange = (mode: 'create' | 'schedule' | 'templates' | 'sync') => {
    if (onViewModeChange) {
      onViewModeChange(mode);
      // On mobile, collapse the sidebar when switching to a non-projects view
      if (window.innerWidth <= 1024 && onToggleSidebar && !sidebarCollapsed) {
        onToggleSidebar();
      }
    }
  };

  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">🍋</span>
        <h1 className="header-title">Lemon Post Studio</h1>
      </div>
      
      {onViewModeChange && (
        <nav className="header-nav">
          <button 
            className={`nav-toggle ${!sidebarCollapsed ? 'expanded' : ''}`}
            onClick={() => {
              if (onToggleSidebar) {
                onToggleSidebar();
              }
            }}
            title={sidebarCollapsed ? 'Show projects' : 'Hide projects'}
          >
            <span className="toggle-icon">{sidebarCollapsed ? '▶' : '▼'}</span>
            <span className="toggle-text">Projects</span>
          </button>
          <div className="nav-divider"></div>
          <button 
            className={`nav-button ${viewMode === 'schedule' ? 'active' : ''}`}
            onClick={() => handleViewChange('schedule')}
          >
            📅 Schedule {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </button>
          <button 
            className={`nav-button ${viewMode === 'templates' ? 'active' : ''}`}
            onClick={() => handleViewChange('templates')}
          >
            📝 Templates
          </button>
          <button 
            className={`nav-button ${viewMode === 'sync' ? 'active' : ''}`}
            onClick={() => handleViewChange('sync')}
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
    </header>
  );
}
