import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { t, tPlural } from '../i18n';
import { clearHistory, getSnapshots } from '../services/history-store';
import type { PageSnapshot } from '../types';
import { formatAbsoluteTime, formatRelativeTime } from '../utils';

interface HistorySidebarProps {
  onCompare: (snapshotA: PageSnapshot, snapshotB: PageSnapshot | null) => void | Promise<void>;
  onClose: () => void;
}

export function HistorySidebar({ onCompare, onClose }: HistorySidebarProps) {
  const [pageName, setPageName] = useState('');
  const [snapshots, setSnapshots] = useState<PageSnapshot[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    let nextPageName = '';

    try {
      const page = await logseq.Editor.getCurrentPage();
      nextPageName = typeof page?.originalName === 'string'
        ? page.originalName
        : typeof page?.name === 'string'
          ? page.name
          : '';

      setPageName(nextPageName);

      if (!nextPageName) {
        setSnapshots([]);
        setSelectedIds([]);
        return;
      }

      const nextSnapshots = await getSnapshots(nextPageName);
      setSnapshots([...nextSnapshots].reverse());
      setSelectedIds([]);
      } catch {
        setSnapshots([]);
        setSelectedIds([]);
        if (nextPageName) {
          setPageName(nextPageName);
          setLoadError(t('sidebar.loadError'));
          void logseq.UI.showMsg(t('sidebar.loadErrorToast', { pageName: nextPageName }), 'error');
        }
      } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadSnapshots();
      }
    };

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadSnapshots]);

  const handleSelect = useCallback((snapshotId: string, multiSelect: boolean) => {
    setSelectedIds((currentIds) => {
      if (!multiSelect) {
        return [snapshotId];
      }

      if (currentIds.includes(snapshotId)) {
        return currentIds.filter((id) => id !== snapshotId);
      }

      if (currentIds.length >= 2) {
        return currentIds;
      }

      return [...currentIds, snapshotId];
    });
  }, []);

  const handleSelectKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>, snapshotId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleSelect(snapshotId, event.ctrlKey || event.metaKey);
  }, [handleSelect]);

  const handleCompare = useCallback(async () => {
    const selectedSnapshots = snapshots.filter((snapshot) => selectedIds.includes(snapshot.id));

    if (selectedSnapshots.length === 1) {
      await onCompare(selectedSnapshots[0], null);
      return;
    }

    if (selectedSnapshots.length === 2) {
      const [older, newer] = [...selectedSnapshots].sort((a, b) => a.timestamp - b.timestamp);
      await onCompare(older, newer);
    }
  }, [onCompare, selectedIds, snapshots]);

  const handleClear = useCallback(async () => {
    if (!pageName) {
      return;
    }

    try {
      await clearHistory(pageName);
      setSnapshots([]);
      setSelectedIds([]);
      setLoadError('');
    } catch {
      await logseq.UI.showMsg(t('sidebar.clearErrorToast', { pageName }), 'error');
    }
  }, [pageName]);

  return (
    <div className="local-history-panel">
      <div className="local-history-header">
        <h3>{t('sidebar.title')}</h3>
        <button type="button" className="local-history-close" onClick={onClose} aria-label={t('sidebar.closeAria')}>
          x
        </button>
      </div>

      {pageName ? <div className="local-history-page-name">{t('sidebar.pageLabel', { pageName })}</div> : null}

      <div className="local-history-timeline">
        {loading ? <div className="local-history-empty">{t('sidebar.loading')}</div> : null}

        {!loading && !pageName ? (
          <div className="local-history-empty">{t('sidebar.navigateToPage')}</div>
        ) : null}

        {!loading && pageName && snapshots.length === 0 ? (
          <div className="local-history-empty">{loadError || t('sidebar.noHistory')}</div>
        ) : null}

        {!loading && snapshots.length > 0
          ? snapshots.map((snapshot) => {
              const isSelected = selectedIds.includes(snapshot.id);

              return (
                <div
                  key={snapshot.id}
                  className={`snapshot-item${isSelected ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={(event) => handleSelect(snapshot.id, event.ctrlKey || event.metaKey)}
                  onKeyDown={(event) => handleSelectKeyDown(event, snapshot.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelect(snapshot.id, true)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={t('sidebar.selectVersionAria', { timestamp: formatAbsoluteTime(snapshot.timestamp) })}
                  />
                  <div className="snapshot-time" title={formatAbsoluteTime(snapshot.timestamp)}>
                    <div className="relative">{formatRelativeTime(snapshot.timestamp)}</div>
                    <div className="absolute">{formatAbsoluteTime(snapshot.timestamp)}</div>
                  </div>
                </div>
              );
            })
          : null}
      </div>

      <div className="local-history-footer">
        <div className="count">
          {tPlural('sidebar.versionCount', snapshots.length)}
        </div>

        <div className="local-history-actions">
          {selectedIds.length === 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => void handleCompare()}>
              {t('sidebar.compareCurrent')}
            </button>
          ) : null}

          {selectedIds.length === 2 ? (
            <button type="button" className="btn btn-primary" onClick={() => void handleCompare()}>
              {t('sidebar.compareSelected')}
            </button>
          ) : null}

          {snapshots.length > 0 ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void handleClear()}>
              {t('sidebar.clearHistory')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
