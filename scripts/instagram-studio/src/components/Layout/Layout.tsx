import React from 'react';
import { Header } from './Header';
import './Layout.css';

type ViewMode = 'create' | 'schedule' | 'templates' | 'sync' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
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

export function Layout({ 
  children, 
  onRefresh, 
  viewMode, 
  onViewModeChange, 
  pendingCount, 
  isConnected,
  isSyncing,
  syncSuccess,
  syncError,
  lastSyncedAt,
  sidebarCollapsed = false,
  onToggleSidebar,
}: LayoutProps) {
  return (
    <div className="layout">
      <Header 
        onRefresh={onRefresh} 
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        pendingCount={pendingCount}
        isConnected={isConnected}
        isSyncing={isSyncing}
        syncSuccess={syncSuccess}
        syncError={syncError}
        lastSyncedAt={lastSyncedAt}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
      />
      <main className={`layout-main ${sidebarCollapsed ? 'layout-main--collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
}
