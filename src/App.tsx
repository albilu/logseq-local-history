import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { DiffViewerPanel } from './components/DiffViewer';
import { HistorySidebar } from './components/HistorySidebar';
import type { PageSnapshot } from './types';

const HOST_PANEL_WIDTH = '100vw';

function getCurrentPageName(page: unknown): string {
  if (!page || typeof page !== 'object') {
    return '';
  }

  const pageRecord = page as { originalName?: unknown; name?: unknown };
  if (typeof pageRecord.originalName === 'string') {
    return pageRecord.originalName;
  }

  return typeof pageRecord.name === 'string' ? pageRecord.name : '';
}

function getCurrentPageUuid(page: unknown): string {
  if (!page || typeof page !== 'object') {
    return '';
  }

  const pageRecord = page as { uuid?: unknown };
  return typeof pageRecord.uuid === 'string' ? pageRecord.uuid : '';
}

function isSamePage(page: unknown, snapshot: PageSnapshot): boolean {
  const currentPageUuid = getCurrentPageUuid(page);
  if (currentPageUuid && snapshot.pageUuid) {
    if (currentPageUuid === snapshot.pageUuid) {
      return true;
    }
  }

  const currentPageName = getCurrentPageName(page);
  if (!currentPageName) {
    return false;
  }

  return currentPageName.toLowerCase() === snapshot.pageName.toLowerCase();
}

type View = 'sidebar' | 'diff';

interface DiffState {
  snapshotA: PageSnapshot;
  snapshotB: PageSnapshot | null;
  currentBlocks?: Array<Record<string, unknown>>;
}

export default function App() {
  const [view, setView] = useState<View>('sidebar');
  const [diffState, setDiffState] = useState<DiffState | null>(null);
  const [sidebarSession, setSidebarSession] = useState(0);

  useEffect(() => {
    logseq.setMainUIAttrs({ draggable: false });
    logseq.setMainUIInlineStyle({
      position: 'fixed',
      top: '0',
      right: '0',
      bottom: '0',
      width: HOST_PANEL_WIDTH,
      zIndex: 999,
    });
  }, [view]);

  const handleClose = useCallback(() => {
    logseq.hideMainUI({ restoreEditingCursor: true });
    setView('sidebar');
    setDiffState(null);
    setSidebarSession((current) => current + 1);
  }, []);

  const handleCompare = useCallback(async (snapshotA: PageSnapshot, snapshotB: PageSnapshot | null) => {
    let currentBlocks: Array<Record<string, unknown>> | undefined;

    if (snapshotB === null) {
      try {
        const currentPage = await logseq.Editor.getCurrentPage();
        const samePage = isSamePage(currentPage, snapshotA);
        console.info('[local-history] compare-current identity', {
          snapshotPageName: snapshotA.pageName,
          snapshotPageUuid: snapshotA.pageUuid,
          currentPage,
          resolvedCurrentPageName: getCurrentPageName(currentPage),
          resolvedCurrentPageUuid: getCurrentPageUuid(currentPage),
          samePage,
        });
        if (!samePage) {
          await logseq.UI.showMsg(
            'The current page changed. Close and reopen Local History for the new page.',
            'warning'
          );
          return;
        }

        const blocks = await logseq.Editor.getCurrentPageBlocksTree();
        currentBlocks = Array.isArray(blocks) ? (blocks as Array<Record<string, unknown>>) : [];
      } catch (error) {
        const message = 'Failed to load the current page for comparison.';
        void error;
        await logseq.UI.showMsg(message, 'error');
        return;
      }
    }

    setDiffState({ snapshotA, snapshotB, currentBlocks });
    setView('diff');
  }, []);

  const handleBack = useCallback(() => {
    setView('sidebar');
    setDiffState(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  const maxVersions = typeof logseq.settings?.maxVersions === 'number' ? logseq.settings.maxVersions : 50;

  return (
    <>
      <div className="local-history-overlay" onClick={handleClose} />
      {view === 'sidebar' ? (
        <HistorySidebar key={sidebarSession} onCompare={handleCompare} onClose={handleClose} />
      ) : null}
      {view === 'diff' && diffState ? (
        <DiffViewerPanel
          className="diff-view-container diff-view-container-expanded"
          snapshotA={diffState.snapshotA}
          snapshotB={diffState.snapshotB}
          currentBlocks={diffState.currentBlocks}
          onBack={handleBack}
          maxVersions={maxVersions}
        />
      ) : null}
    </>
  );
}
