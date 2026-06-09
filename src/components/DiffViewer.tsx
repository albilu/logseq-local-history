import { useCallback, useMemo, useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { t } from '../i18n';
import { revertToSnapshot } from '../services/revert';
import { deserializeToText, serializeBlockTree } from '../services/snapshot';
import type { PageSnapshot } from '../types';
import { formatAbsoluteTime } from '../utils';

function prefersDarkTheme(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const root = document.documentElement;
  return root.classList.contains('dark-theme') || root.dataset.theme === 'dark';
}

interface DiffViewerProps {
  className?: string;
  snapshotA: PageSnapshot;
  snapshotB: PageSnapshot | null;
  currentBlocks?: Array<Record<string, unknown>>;
  onBack: () => void;
  maxVersions: number;
}

export function DiffViewerPanel({
  className,
  snapshotA,
  snapshotB,
  currentBlocks,
  onBack,
  maxVersions,
}: DiffViewerProps) {
  const [splitView, setSplitView] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const oldText = useMemo(() => deserializeToText(snapshotA.blocks), [snapshotA.blocks]);
  const newText = useMemo(() => {
    if (snapshotB) {
      return deserializeToText(snapshotB.blocks);
    }

    return deserializeToText(serializeBlockTree(currentBlocks ?? []));
  }, [currentBlocks, snapshotB]);

  const oldTitle = formatAbsoluteTime(snapshotA.timestamp);
  const newTitle = snapshotB ? formatAbsoluteTime(snapshotB.timestamp) : t('diff.currentVersion');
  const canRevert = snapshotB === null;
  const darkTheme = prefersDarkTheme();

  const handleCopy = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard unavailable');
      }

      await navigator.clipboard.writeText(oldText);
      await logseq.UI.showMsg(t('diff.copied'), 'success');
    } catch {
      await logseq.UI.showMsg(t('diff.copyFailed'), 'error');
    }
  }, [oldText]);

  const handleRevert = useCallback(async () => {
    setReverting(true);
    setErrorMessage('');

    try {
      await revertToSnapshot(snapshotA, maxVersions);
      onBack();
    } catch {
      const message = t('diff.revertFailed');
      setErrorMessage(message);
      await logseq.UI.showMsg(message, 'error');
    } finally {
      setReverting(false);
    }
  }, [maxVersions, onBack, snapshotA]);

  return (
    <div className={className ?? 'diff-view-container'}>
      <div className="diff-header">
        <div className="diff-header-main">
          <button type="button" className="btn btn-sm" onClick={onBack}>
            {t('diff.back')}
          </button>
          <h3>
            {oldTitle} vs {newTitle}
          </h3>
        </div>

        <div className="diff-controls">
          <label>
            <input
              type="checkbox"
              checked={splitView}
              onChange={(event) => setSplitView(event.target.checked)}
            />{' '}{t('diff.splitView')}
          </label>
          <button type="button" className="btn btn-sm" onClick={() => void handleCopy()}>
            {t('diff.copyOld')}
          </button>
          {canRevert ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleRevert} disabled={reverting}>
              {reverting ? t('diff.reverting') : t('diff.revert')}
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? <div className="diff-error">{errorMessage}</div> : null}

      <div className="diff-body">
        <ReactDiffViewer
          oldValue={oldText}
          newValue={newText}
          splitView={splitView}
          compareMethod={DiffMethod.WORDS}
          useDarkTheme={darkTheme}
        />
      </div>
    </div>
  );
}
