import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { installMockLogseq, mockEditor, mockLogseq, mockUI, resetMockLogseq } from './__mocks__/logseq';
import type { PageSnapshot } from './types';

const getSnapshotsMock = vi.fn();
const clearHistoryMock = vi.fn();
const revertToSnapshotMock = vi.fn();

vi.mock('./services/history-store', () => ({
  getSnapshots: getSnapshotsMock,
  clearHistory: clearHistoryMock,
}));

vi.mock('./services/revert', () => ({
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

describe('App shell', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installMockLogseq();
    resetMockLogseq();
    getSnapshotsMock.mockReset();
    clearHistoryMock.mockReset();
    revertToSnapshotMock.mockReset();
    mockUI.showMsg.mockReset();

    mockEditor.getCurrentPage.mockResolvedValue({ name: 'Project Notes' });
    mockEditor.getCurrentPageBlocksTree.mockResolvedValue([{ uuid: 'current-1', content: 'Current page state' }]);
    getSnapshotsMock.mockResolvedValue(snapshots);

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

  it('renders overlay and sidebar by default, switches to diff on compare, and returns on back', async () => {
    const { default: App } = await import('./App');

    await act(async () => {
      root.render(<App />);
      await flushPromises();
    });

    expect(mockLogseq.setMainUIInlineStyle).toHaveBeenLastCalledWith(expect.objectContaining({
      width: '100vw',
    }));

    expect(container.querySelector('.local-history-overlay')).not.toBeNull();
    expect(container.textContent).toContain('Local History');
    expect(container.textContent).toContain('Project Notes');

    const items = Array.from(container.querySelectorAll('.snapshot-item')) as HTMLDivElement[];
    await act(async () => {
      items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const compareButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compare with Current')
    );
    expect(compareButton).toBeDefined();

    await act(async () => {
      compareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockLogseq.setMainUIInlineStyle).toHaveBeenLastCalledWith(expect.objectContaining({
      width: '100vw',
    }));
    expect(container.textContent).toContain('Current Version');
    expect(mockEditor.getCurrentPageBlocksTree).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.diff-view-container-expanded')).not.toBeNull();

    const backButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Back')
    );

    await act(async () => {
      backButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockLogseq.setMainUIInlineStyle).toHaveBeenLastCalledWith(expect.objectContaining({
      width: '100vw',
    }));
    expect(container.textContent).toContain('Local History');
  });

  it('closes on overlay click and Escape with cursor restore', async () => {
    const { default: App } = await import('./App');

    await act(async () => {
      root.render(<App />);
      await flushPromises();
    });

    const overlay = container.querySelector('.local-history-overlay');
    expect(overlay).not.toBeNull();

    await act(async () => {
      overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockLogseq.hideMainUI).toHaveBeenCalledWith({ restoreEditingCursor: true });

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flushPromises();
    });

    expect(mockLogseq.hideMainUI).toHaveBeenCalledTimes(2);
  });

  it('uses maxVersions from settings for revert actions with a fallback of 50', async () => {
    mockLogseq.settings = { ...mockLogseq.settings, maxVersions: 12 };
    const { default: App } = await import('./App');

    await act(async () => {
      root.render(<App />);
      await flushPromises();
    });

    const items = Array.from(container.querySelectorAll('.snapshot-item')) as HTMLDivElement[];
    await act(async () => {
      items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const compareButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compare with Current')
    );

    await act(async () => {
      compareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const revertButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Revert to This Version')
    );

    await act(async () => {
      revertButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(revertToSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'newer' }), 12);

    mockLogseq.settings = { ...mockLogseq.settings, maxVersions: undefined as unknown as number };
    revertToSnapshotMock.mockClear();

    await act(async () => {
      root.render(<App />);
      await flushPromises();
    });

    const secondItems = Array.from(container.querySelectorAll('.snapshot-item')) as HTMLDivElement[];
    await act(async () => {
      secondItems[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const secondCompareButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compare with Current')
    );

    await act(async () => {
      secondCompareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const secondRevertButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Revert to This Version')
    );

    await act(async () => {
      secondRevertButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(revertToSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'newer' }), 50);
  });

  it('stays on the sidebar when the current page changes before compare', async () => {
    const { default: App } = await import('./App');

    await act(async () => {
      root.render(<App />);
      await flushPromises();
    });

    const items = Array.from(container.querySelectorAll('.snapshot-item')) as HTMLDivElement[];
    await act(async () => {
      items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    mockEditor.getCurrentPage.mockResolvedValue({ name: 'Another Page' });

    const compareButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compare with Current')
    );

    await act(async () => {
      compareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockUI.showMsg).toHaveBeenCalledWith(
      'The current page changed. Close and reopen Local History for the new page.',
      'warning'
    );
    expect(container.textContent).toContain('Local History');
    expect(container.textContent).not.toContain('Current Version');
    expect(mockEditor.getCurrentPageBlocksTree).not.toHaveBeenCalled();
  });

  it('shows an error and stays on the sidebar when current page blocks cannot be loaded', async () => {
    const { default: App } = await import('./App');

    await act(async () => {
      root.render(<App />);
      await flushPromises();
    });

    const items = Array.from(container.querySelectorAll('.snapshot-item')) as HTMLDivElement[];
    await act(async () => {
      items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    mockEditor.getCurrentPageBlocksTree.mockRejectedValue(new Error('load failed'));

    const compareButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Compare with Current')
    );

    await act(async () => {
      compareButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(mockUI.showMsg).toHaveBeenCalledWith('Failed to load the current page for comparison.', 'error');
    expect(container.textContent).toContain('Local History');
    expect(container.textContent).not.toContain('Current Version');
  });
});
