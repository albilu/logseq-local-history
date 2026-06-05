import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockLogseq, mockEditor, mockFileStorage, resetMockLogseq } from '../../__mocks__/logseq';
import type { PageSnapshot } from '../../types';
import { addSnapshot, getSnapshots } from '../history-store';
import { handleDbChanged, resetState } from '../change-detector';

const defaultSettings = { debounceMs: 5000, maxVersions: 50, excludePages: '' };

type ChangedBlock = {
  uuid: string;
  page?: {
    name?: string;
  };
};

function makeSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    pageName: overrides.pageName ?? 'test page',
    pageUuid: overrides.pageUuid ?? 'page-uuid',
    timestamp: overrides.timestamp ?? Date.now(),
    blocks: overrides.blocks ?? [{ uuid: 'b1', content: 'Hello' }],
  };
}

function makeChange(blocks: ChangedBlock[]) {
  return { blocks, txData: [] as unknown[] };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForSnapshots(pageName: string, expectedLength: number): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    const snapshots = await getSnapshots(pageName);
    if (snapshots.length === expectedLength) {
      return;
    }

    await flushMicrotasks();
  }

  expect(await getSnapshots(pageName)).toHaveLength(expectedLength);
}

async function waitForHistoryFileRemoval(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    const removedHistoryFile = mockFileStorage.removeItem.mock.calls.some(([key]) => (
      key.startsWith('history/')
      && key.endsWith('.json')
      && key !== 'history/_index.json'
      && key !== 'history/_files.json'
    ));

    if (removedHistoryFile) {
      return;
    }

    await flushMicrotasks();
  }

  expect(mockFileStorage.removeItem.mock.calls.some(([key]) => (
    key.startsWith('history/')
    && key.endsWith('.json')
    && key !== 'history/_index.json'
    && key !== 'history/_files.json'
  ))).toBe(true);
}

beforeEach(() => {
  installMockLogseq();
  resetMockLogseq();
  resetState();
  vi.useFakeTimers();
});

afterEach(() => {
  resetState();
  vi.useRealTimers();
});

describe('handleDbChanged', () => {
  it('debounces and captures snapshot after delay', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), defaultSettings);

    expect(mockEditor.getPageBlocksTree).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('test page');
    expect(await getSnapshots('test page')).toHaveLength(1);
  });

  it('resets debounce timer on subsequent changes', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), defaultSettings);

    await vi.advanceTimersByTimeAsync(3000);
    expect(mockEditor.getPageBlocksTree).not.toHaveBeenCalled();

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), defaultSettings);

    await vi.advanceTimersByTimeAsync(3000);
    expect(mockEditor.getPageBlocksTree).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledTimes(1);
  });

  it('excludes pages in the exclude list', async () => {
    handleDbChanged(
      makeChange([{ uuid: 'b1', page: { name: 'secret page' } }]),
      { ...defaultSettings, excludePages: 'secret page' }
    );

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockEditor.getPageBlocksTree).not.toHaveBeenCalled();
    expect(await getSnapshots('secret page')).toEqual([]);
  });

  it('handles multiple pages independently', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Content', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid' });

    handleDbChanged(
      makeChange([
        { uuid: 'b1', page: { name: 'page a' } },
        { uuid: 'b2', page: { name: 'page b' } },
      ]),
      defaultSettings
    );

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('page a');
    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('page b');
    expect(await getSnapshots('page a')).toHaveLength(1);
    expect(await getSnapshots('page b')).toHaveLength(1);
  });

  it('skips blocks without page info', async () => {
    handleDbChanged(makeChange([{ uuid: 'b1' }]), defaultSettings);

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockEditor.getPageBlocksTree).not.toHaveBeenCalled();
  });

  it('extracts affected page names from txData when blocks lack page info', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });

    handleDbChanged(
      {
        blocks: [{ uuid: 'b1' }],
        txData: [
          [':db/add', 'datom-1', ':block/name', 'test page'],
        ],
      },
      defaultSettings
    );

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('test page');
    expect(await getSnapshots('test page')).toHaveLength(1);
  });

  it('resolves affected page names from block page datoms in txData', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockImplementation(async (pageRef: string) => {
      if (pageRef === 'page-entity-1') {
        return { uuid: 'page-uuid', name: 'tx page' };
      }

      return { uuid: 'page-uuid', name: 'tx page' };
    });

    handleDbChanged(
      {
        blocks: [{ uuid: 'b1' }],
        txData: [
          [':db/add', 'block-1', ':block/page', 'page-entity-1'],
        ],
      },
      defaultSettings
    );

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('tx page');
    expect(await getSnapshots('tx page')).toHaveLength(1);
  });

  it('does not store a duplicate when the last stored snapshot matches', async () => {
    const existing = makeSnapshot({
      pageName: 'test page',
      blocks: [{ uuid: 'b1', content: 'Hello' }],
    });

    await addSnapshot(existing, defaultSettings.maxVersions);
    resetState();

    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), defaultSettings);

    await vi.advanceTimersByTimeAsync(5000);

    const snapshots = await getSnapshots('test page');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].id).toBe(existing.id);
  });

  it('does not store a duplicate when the in-memory snapshot matches', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), defaultSettings);
    await vi.advanceTimersByTimeAsync(5000);

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), defaultSettings);
    await vi.advanceTimersByTimeAsync(5000);

    expect(await getSnapshots('test page')).toHaveLength(1);
    expect(mockEditor.getPage).toHaveBeenCalledTimes(1);
  });

  it('serializes overlapping captures for the same page', async () => {
    const pageResolvers: Array<(value: { uuid: string; name: string }) => void> = [];

    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockImplementation(() => new Promise((resolve) => {
      pageResolvers.push(resolve);
    }));

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), { ...defaultSettings, debounceMs: 1 });
    await vi.advanceTimersByTimeAsync(1);

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), { ...defaultSettings, debounceMs: 1 });
    await vi.advanceTimersByTimeAsync(1);

    expect(mockEditor.getPage).toHaveBeenCalledTimes(1);

    pageResolvers[0]({ uuid: 'page-uuid', name: 'test page' });
    await flushMicrotasks();

    expect(mockEditor.getPage).toHaveBeenCalledTimes(1);
    expect(await getSnapshots('test page')).toHaveLength(1);
  });
});

describe('resetState', () => {
  it('clears all pending timers', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([]);

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), defaultSettings);

    resetState();
    await vi.advanceTimersByTimeAsync(10000);

    expect(mockEditor.getPageBlocksTree).not.toHaveBeenCalled();
  });

  it('invalidates already-started captures', async () => {
    let resolvePage: ((value: { uuid: string; name: string }) => void) | undefined;

    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePage = resolve;
    }));
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), { ...defaultSettings, debounceMs: 1 });
    await vi.advanceTimersByTimeAsync(1);

    resetState();
    resolvePage?.({ uuid: 'page-uuid', name: 'test page' });
    await flushMicrotasks();

    expect(await getSnapshots('test page')).toEqual([]);

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), { ...defaultSettings, debounceMs: 1 });
    await vi.advanceTimersByTimeAsync(1);

    expect(await getSnapshots('test page')).toHaveLength(1);
  });

  it('does not keep stale snapshots when reset happens during addSnapshot', async () => {
    let resolveWrite: (() => void) | undefined;
    const originalSetItem = mockFileStorage.setItem.getMockImplementation();

    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockFileStorage.setItem.mockImplementation(async (key: string, value: string) => {
      if (
        key.startsWith('history/')
        && key.endsWith('.json')
        && key !== 'history/_index.json'
        && key !== 'history/_files.json'
      ) {
        await new Promise<void>((resolve) => {
          resolveWrite = resolve;
        });
      }

      await originalSetItem?.(key, value);
    });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), { ...defaultSettings, debounceMs: 1 });
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    resetState();
    resolveWrite?.();
    await waitForHistoryFileRemoval();

    expect(await getSnapshots('test page')).toEqual([]);
  });
});
