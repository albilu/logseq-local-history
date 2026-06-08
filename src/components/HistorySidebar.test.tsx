import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { installMockLogseq, mockEditor, mockUI, resetMockLogseq } from '../__mocks__/logseq';
import type { PageSnapshot } from '../types';

const getSnapshotsMock = vi.fn();
const clearHistoryMock = vi.fn();
const revertToSnapshotMock = vi.fn();
const clipboardWriteTextMock = vi.fn();

vi.mock('../services/history-store', () => ({
  getSnapshots: getSnapshotsMock,
  clearHistory: clearHistoryMock,
}));

vi.mock('../services/revert', () => ({
  revertToSnapshot: revertToSnapshotMock,
}));

vi.mock('react-diff-viewer-continued', () => ({
  default: ({
    oldValue,
    newValue,
    splitView,
    useDarkTheme,
  }: {
    oldValue: string;
    newValue: string;
    splitView: boolean;
    useDarkTheme?: boolean;
  }) => (
    <div
      data-testid="diff-viewer"
      data-old-value={oldValue}
      data-new-value={newValue}
      data-split-view={String(splitView)}
      data-use-dark-theme={String(useDarkTheme)}
    />
  ),
  DiffMethod: {
    WORDS: 'WORDS',
  },
}));

const snapshots: PageSnapshot[] = [
  {
    id: 'older',
    pageName: 'Project Notes',
    pageUuid: 'page-1',
    timestamp: 1000,
    blocks: [{ uuid: 'older-1', content: 'Older snapshot' }],
  },
  {
    id: 'newer',
    pageName: 'Project Notes',
    pageUuid: 'page-1',
    timestamp: 2000,
    blocks: [{ uuid: 'newer-1', content: 'Newer snapshot' }],
  },
];

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('HistorySidebar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installMockLogseq();
    resetMockLogseq();
    getSnapshotsMock.mockReset();
    clearHistoryMock.mockReset();
    mockEditor.getCurrentPage.mockReset();

    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flushPromises();
    });
    document.body.innerHTML = '';
    vi.resetModules();
  });

  it('loads the current page, shows newest-first snapshots, compares selections, and clears history', async () => {
    mockEditor.getCurrentPage.mockResolvedValue({ originalName: 'Project Notes' });
    getSnapshotsMock.mockResolvedValue(snapshots);
    const onCompare = vi.fn();
    const { HistorySidebar } = await import('./HistorySidebar');

    await act(async () => {
      root.render(<HistorySidebar onCompare={onCompare} onClose={vi.fn()} />);
      await flushPromises();
    });

    expect(getSnapshotsMock).toHaveBeenCalledWith('Project Notes');
    expect(container.textContent).toContain('Page: Project Notes');

    const items = Array.from(container.querySelectorAll('.snapshot-item'));
    expect(items).toHaveLength(2);

    await act(async () => {
      items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const compareCurrentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compare with Current')
    );
    expect(compareCurrentButton).toBeDefined();

    await act(async () => {
      compareCurrentButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(onCompare).toHaveBeenCalledWith(expect.objectContaining({ id: 'newer' }), null);

    await act(async () => {
      items[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      await flushPromises();
    });

    const compareSelectedButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compare Selected')
    );
    expect(compareSelectedButton).toBeDefined();

    await act(async () => {
      compareSelectedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(onCompare).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'older' }),
      expect.objectContaining({ id: 'newer' })
    );

    const clearButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Clear History')
    );

    await act(async () => {
      clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(clearHistoryMock).toHaveBeenCalledWith('Project Notes');
  });

  it('supports keyboard selection on snapshot rows', async () => {
    mockEditor.getCurrentPage.mockResolvedValue({ originalName: 'Project Notes' });
    getSnapshotsMock.mockResolvedValue(snapshots);
    const onCompare = vi.fn();
    const { HistorySidebar } = await import('./HistorySidebar');

    await act(async () => {
      root.render(<HistorySidebar onCompare={onCompare} onClose={vi.fn()} />);
      await flushPromises();
    });

    const items = Array.from(container.querySelectorAll('.snapshot-item')) as HTMLDivElement[];

    await act(async () => {
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flushPromises();
    });

    expect(items[0].getAttribute('role')).toBe('button');
    expect(items[0].getAttribute('tabindex')).toBe('0');
    expect(container.textContent).toContain('Compare with Current');
  });

  it('shows empty states when there is no page or no history', async () => {
    const { HistorySidebar } = await import('./HistorySidebar');

    mockEditor.getCurrentPage.mockResolvedValue(null);
    getSnapshotsMock.mockResolvedValue([]);

    await act(async () => {
      root.render(<HistorySidebar onCompare={vi.fn()} onClose={vi.fn()} />);
      await flushPromises();
    });

    expect(container.textContent).toContain('Navigate to a page to view its history.');

    mockEditor.getCurrentPage.mockResolvedValue({ name: 'Project Notes' });
    getSnapshotsMock.mockResolvedValue([]);

    await act(async () => {
      root.unmount();
      root = createRoot(container);
      root.render(<HistorySidebar onCompare={vi.fn()} onClose={vi.fn()} />);
      await flushPromises();
    });

    expect(container.textContent).toContain('No history for this page yet.');
  });

  it('shows a history load error without pretending no page is open', async () => {
    mockEditor.getCurrentPage.mockResolvedValue({ name: 'Project Notes' });
    getSnapshotsMock.mockRejectedValue(new Error('storage failed'));
    const { HistorySidebar } = await import('./HistorySidebar');

    await act(async () => {
      root.render(<HistorySidebar onCompare={vi.fn()} onClose={vi.fn()} />);
      await flushPromises();
    });

    expect(container.textContent).toContain('Page: Project Notes');
    expect(container.textContent).toContain('Failed to load history for this page.');
    expect(container.textContent).not.toContain('Navigate to a page to view its history.');
    expect(mockUI.showMsg).toHaveBeenCalledWith('Failed to load history for "Project Notes".', 'error');
  });

  it('shows an error and keeps the current snapshots when clearing history fails', async () => {
    mockEditor.getCurrentPage.mockResolvedValue({ originalName: 'Project Notes' });
    getSnapshotsMock.mockResolvedValue(snapshots);
    clearHistoryMock.mockRejectedValue(new Error('remove failed'));
    const { HistorySidebar } = await import('./HistorySidebar');

    await act(async () => {
      root.render(<HistorySidebar onCompare={vi.fn()} onClose={vi.fn()} />);
      await flushPromises();
    });

    const clearButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Clear History')
    );

    await act(async () => {
      clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockUI.showMsg).toHaveBeenCalledWith('Failed to clear history for "Project Notes".', 'error');
    expect(container.querySelectorAll('.snapshot-item')).toHaveLength(2);
  });
});

describe('DiffViewerPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installMockLogseq();
    resetMockLogseq();
    revertToSnapshotMock.mockReset();
    mockUI.showMsg.mockReset();
    clipboardWriteTextMock.mockReset();

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: clipboardWriteTextMock,
        },
      },
    });

    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flushPromises();
    });
    document.body.innerHTML = '';
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
    Reflect.deleteProperty(globalThis, 'navigator');
    vi.resetModules();
  });

  it('supports split/unified toggle, copy, and revert when comparing against current', async () => {
    const onBack = vi.fn();
    const { DiffViewerPanel } = await import('./DiffViewer');

    await act(async () => {
      root.render(
        <DiffViewerPanel
          snapshotA={snapshots[0]}
          snapshotB={null}
          currentBlocks={[{ uuid: 'current-1', content: 'Current page state' }]}
          onBack={onBack}
          maxVersions={7}
        />
      );
      await flushPromises();
    });

    const diffViewer = container.querySelector('[data-testid="diff-viewer"]');
    expect(diffViewer?.getAttribute('data-split-view')).toBe('true');
    expect(diffViewer?.getAttribute('data-use-dark-theme')).toBe('false');

    const splitCheckbox = container.querySelector('.diff-controls input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      splitCheckbox.click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="diff-viewer"]')?.getAttribute('data-split-view')).toBe('false');

    const buttons = Array.from(container.querySelectorAll('button'));
    const copyButton = buttons.find((button) => button.textContent?.includes('Copy Old'));
    const revertButton = buttons.find((button) => button.textContent?.includes('Revert to This Version'));

    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith('Older snapshot');
    expect(mockUI.showMsg).toHaveBeenCalledWith('Copied to clipboard', 'success');

    await act(async () => {
      revertButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(revertToSnapshotMock).toHaveBeenCalledWith(snapshots[0], 7);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error instead of a false success when clipboard copy fails', async () => {
    clipboardWriteTextMock.mockRejectedValue(new Error('clipboard unavailable'));
    const { DiffViewerPanel } = await import('./DiffViewer');

    await act(async () => {
      root.render(
        <DiffViewerPanel
          snapshotA={snapshots[0]}
          snapshotB={null}
          currentBlocks={[{ uuid: 'current-1', content: 'Current page state' }]}
          onBack={vi.fn()}
          maxVersions={7}
        />
      );
      await flushPromises();
    });

    const copyButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Copy Old')
    );

    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockUI.showMsg).toHaveBeenCalledWith('Copy failed. Clipboard access is unavailable.', 'error');
    expect(mockUI.showMsg).not.toHaveBeenCalledWith('Copied to clipboard', 'success');
  });

  it('uses dark theme in the diff viewer when Logseq reports a dark theme', async () => {
    document.documentElement.classList.add('dark-theme');

    const { DiffViewerPanel } = await import('./DiffViewer');

    await act(async () => {
      root.render(
        <DiffViewerPanel
          snapshotA={snapshots[0]}
          snapshotB={snapshots[1]}
          onBack={vi.fn()}
          maxVersions={5}
        />
      );
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="diff-viewer"]')?.getAttribute('data-use-dark-theme')).toBe('true');
  });

  it('hides revert when comparing two snapshots and shows an error on revert failure', async () => {
    const { DiffViewerPanel } = await import('./DiffViewer');

    await act(async () => {
      root.render(
        <DiffViewerPanel
          snapshotA={snapshots[0]}
          snapshotB={snapshots[1]}
          onBack={vi.fn()}
          maxVersions={5}
        />
      );
      await flushPromises();
    });

    expect(container.textContent).not.toContain('Revert to This Version');

    revertToSnapshotMock.mockRejectedValue(new Error('boom'));

    await act(async () => {
      root.render(
        <DiffViewerPanel
          snapshotA={snapshots[0]}
          snapshotB={null}
          currentBlocks={[]}
          onBack={vi.fn()}
          maxVersions={5}
        />
      );
      await flushPromises();
    });

    const revertButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Revert to This Version')
    );

    await act(async () => {
      revertButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockUI.showMsg).toHaveBeenCalledWith('Revert failed. Your previous version was saved.', 'error');
  });
});
