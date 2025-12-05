import React from 'react';
import { Header } from './Header';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
}

export function Layout({ children, onRefresh }: LayoutProps) {
  return (
    <div className="layout">
      <Header onRefresh={onRefresh} />
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
}
