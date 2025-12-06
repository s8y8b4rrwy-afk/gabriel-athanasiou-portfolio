import { useRef, useState } from 'react';
import styles from './Sync.module.css';

interface SyncPanelProps {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  syncSuccess: string | null;
  autoSync: boolean;
  onSyncToCloud: () => void;
  onFetchFromCloud: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImportFile: (file: File) => void;
  onToggleAutoSync: (value: boolean) => void;
}

export function SyncPanel({
  isSyncing,
  lastSyncedAt,
  syncError,
  syncSuccess,
  autoSync,
  onSyncToCloud,
  onFetchFromCloud,
  onExportJson,
  onExportCsv,
  onImportFile,
  onToggleAutoSync,
}: SyncPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
      e.target.value = ''; // Reset input
    }
  };

  const formatLastSync = (isoString: string | null): string => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.syncPanel}>
      <div className={styles.header}>
        <h3>☁️ Cloud Sync</h3>
        {isSyncing && <span className={styles.syncing}>Syncing...</span>}
      </div>

      {syncError && (
        <div className={styles.error}>
          <span>⚠️</span> {syncError}
        </div>
      )}

      {syncSuccess && (
        <div className={styles.success}>
          {syncSuccess}
        </div>
      )}

      <div className={styles.syncStatus}>
        <span className={styles.statusLabel}>Last synced:</span>
        <span className={styles.statusValue}>{formatLastSync(lastSyncedAt)}</span>
      </div>

      {/* Main Sync Button - Downloads fresh data from cloud */}
      <button
        className={styles.mainSyncButton}
        onClick={onFetchFromCloud}
        disabled={isSyncing}
      >
        {isSyncing ? '🔄 Syncing...' : '🔄 Sync Now'}
      </button>
      <p className={styles.syncHint}>
        Downloads latest data from cloud
      </p>

      <div className={styles.autoSync}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => onToggleAutoSync(e.target.checked)}
          />
          <span className={styles.slider}></span>
        </label>
        <span>Auto-sync on changes</span>
      </div>

      {/* Advanced Options Toggle */}
      <button 
        className={styles.advancedToggle}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '▼' : '▶'} Advanced Options
      </button>

      {showAdvanced && (
        <>
          <div className={styles.section}>
            <h4>Cloud Operations</h4>
            <button
              className={styles.secondaryButton}
              onClick={onFetchFromCloud}
              disabled={isSyncing}
            >
              ⬇️ Download from Cloud
            </button>
            <p className={styles.hint}>
              Replaces local data with cloud version
            </p>
            <button
              className={styles.secondaryButton}
              onClick={onSyncToCloud}
              disabled={isSyncing}
              style={{ marginTop: '8px' }}
            >
              ⬆️ Upload to Cloud
            </button>
            <p className={styles.hint}>
              Merges local changes to cloud (smart merge)
            </p>
          </div>

          <div className={styles.section}>
            <h4>Export</h4>
            <div className={styles.buttons}>
              <button className={styles.exportButton} onClick={onExportJson}>
                📄 Export JSON
              </button>
              <button className={styles.exportButton} onClick={onExportCsv}>
                📊 Export CSV
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <h4>Import</h4>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              className={styles.importButton}
              onClick={() => fileInputRef.current?.click()}
            >
              📥 Import from File
            </button>
            <p className={styles.hint}>
              Import a previously exported JSON schedule file
            </p>
          </div>
        </>
      )}
    </div>
  );
}
