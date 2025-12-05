import React from 'react';
import './Header.css';

interface HeaderProps {
  onRefresh?: () => void;
}

export function Header({ onRefresh }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">🍋</span>
        <h1 className="header-title">Lemon Post Instagram Studio</h1>
      </div>
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
