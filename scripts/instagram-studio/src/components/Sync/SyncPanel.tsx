import { useRef } from 'react';
import styles from './Sync.module.css';

interface SyncPanelProps {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
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
  autoSync,
  onSyncToCloud,
  onFetchFromCloud,
  onExportJson,
  onExportCsv,
  onImportFile,
  onToggleAutoSync,
}: SyncPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <h3>☁️ Sync & Export</h3>
        {isSyncing && <span className={styles.syncing}>Syncing...</span>}
      </div>

      {syncError && (
        <div className={styles.error}>
          <span>⚠️</span> {syncError}
        </div>
      )}

      <div className={styles.syncStatus}>
        <span className={styles.statusLabel}>Last synced:</span>
        <span className={styles.statusValue}>{formatLastSync(lastSyncedAt)}</span>
      </div>

      <div className={styles.autoSync}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => onToggleAutoSync(e.target.checked)}
          />
          <span className={styles.slider}></span>
        </label>
        <span>Auto-sync to Cloudinary</span>
      </div>

      <div className={styles.section}>
        <h4>Cloudinary</h4>
        <div className={styles.buttons}>
          <button
            className={styles.primaryButton}
            onClick={onSyncToCloud}
            disabled={isSyncing}
          >
            ⬆️ Upload to Cloud
          </button>
          <button
            className={styles.secondaryButton}
            onClick={onFetchFromCloud}
            disabled={isSyncing}
          >
            ⬇️ Fetch from Cloud
          </button>
        </div>
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
    </div>
  );
}
