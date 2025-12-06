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
}

export function Layout({ children, onRefresh, viewMode, onViewModeChange, pendingCount, isConnected }: LayoutProps) {
  return (
    <div className="layout">
      <Header 
        onRefresh={onRefresh} 
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        pendingCount={pendingCount}
        isConnected={isConnected}
      />
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
}
