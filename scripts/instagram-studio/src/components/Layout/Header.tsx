import React from 'react';
import './Header.css';

type ViewMode = 'create' | 'schedule' | 'templates' | 'sync' | 'settings';

interface HeaderProps {
  onRefresh?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  pendingCount?: number;
  isConnected?: boolean;
}

export function Header({ onRefresh, viewMode, onViewModeChange, pendingCount = 0, isConnected = false }: HeaderProps) {
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
            ☁️ Sync
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
