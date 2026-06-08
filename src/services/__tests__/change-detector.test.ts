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
    id?: number;
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

type ProcessEvents = {
  on: (event: 'unhandledRejection', handler: (reason: unknown) => void) => void;
  off: (event: 'unhandledRejection', handler: (reason: unknown) => void) => void;
};

const processEvents = (globalThis as typeof globalThis & { process: ProcessEvents }).process;

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
      key.startsWith('history.')
      && key.endsWith('.json')
      && key !== 'history._index.json'
      && key !== 'history._files.json'
    ));

    if (removedHistoryFile) {
      return;
    }

    await flushMicrotasks();
  }

  expect(mockFileStorage.removeItem.mock.calls.some(([key]) => (
    key.startsWith('history.')
    && key.endsWith('.json')
    && key !== 'history._index.json'
    && key !== 'history._files.json'
  ))).toBe(true);
}

async function waitForCallCount(mockFn: { mock: { calls: unknown[][] } }, expectedCount: number): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (mockFn.mock.calls.length === expectedCount) {
      return;
    }

    await flushMicrotasks();
  }

  expect(mockFn.mock.calls.length).toBe(expectedCount);
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

  it('resolves page name from block page id when name is missing', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockImplementation(async (pageRef: string | number) => {
      if (pageRef === 42) {
        return { uuid: 'page-uuid', name: 'resolved page' };
      }

      return { uuid: 'page-uuid', name: String(pageRef) };
    });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { id: 42 } }]), defaultSettings);

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('resolved page');
    expect(await getSnapshots('resolved page')).toHaveLength(1);
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
          [101, ':block/name', 'test page', 1001, true],
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
    mockEditor.getPage.mockImplementation(async (pageRef: string | number) => {
      if (pageRef === 'page-entity-1' || pageRef === 201) {
        return { uuid: 'page-uuid', name: 'tx page' };
      }

      return { uuid: 'page-uuid', name: 'tx page' };
    });

    handleDbChanged(
      {
        blocks: [{ uuid: 'b1' }],
        txData: [
          [102, ':block/page', 201, 1002, true],
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
    await waitForSnapshots('test page', 1);

    expect(mockEditor.getPage).toHaveBeenCalledTimes(1);
    expect(await getSnapshots('test page')).toHaveLength(1);
  });

  it('continues processing block-derived pages when txData page lookup fails', async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };

    processEvents.on('unhandledRejection', onUnhandledRejection);

    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'Hello', children: [] },
    ]);
    mockEditor.getPage.mockImplementation(async (pageRef: string | number) => {
      if (pageRef === 'missing-page-ref' || pageRef === 999) {
        throw new Error('lookup failed');
      }

      return { uuid: 'page-uuid', name: 'test page' };
    });

    handleDbChanged(
      {
        blocks: [{ uuid: 'b1', page: { name: 'test page' } }],
        txData: [
          [103, ':block/page', 999, 1003, true],
        ],
      },
      defaultSettings
    );

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    processEvents.off('unhandledRejection', onUnhandledRejection);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('test page');
    expect(await getSnapshots('test page')).toHaveLength(1);
    expect(unhandledRejections).toEqual([]);
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
        key.startsWith('history.')
        && key.endsWith('.json')
        && key !== 'history._index.json'
        && key !== 'history._files.json'
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

  it('keeps same-page captures serialized across reset generations', async () => {
    let resolveOldWrite: (() => void) | undefined;
    const originalSetItem = mockFileStorage.setItem.getMockImplementation();

    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'b1', content: 'updated', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockFileStorage.setItem.mockImplementation(async (key: string, value: string) => {
      if (
        key.startsWith('history.')
        && key.endsWith('.json')
        && key !== 'history._index.json'
        && key !== 'history._files.json'
        && !resolveOldWrite
      ) {
        await new Promise<void>((resolve) => {
          resolveOldWrite = resolve;
        });
      }

      await originalSetItem?.(key, value);
    });

    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), { ...defaultSettings, debounceMs: 1 });
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    resetState();
    handleDbChanged(makeChange([{ uuid: 'b1', page: { name: 'test page' } }]), { ...defaultSettings, debounceMs: 1 });
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    expect(mockEditor.getPage).toHaveBeenCalledTimes(1);

    resolveOldWrite?.();
    await waitForHistoryFileRemoval();
    await waitForCallCount(mockEditor.getPage, 2);
    await waitForSnapshots('test page', 1);

    expect(mockEditor.getPage).toHaveBeenCalledTimes(2);
    expect(await getSnapshots('test page')).toHaveLength(1);
    expect((await getSnapshots('test page'))[0].blocks).toEqual([{ uuid: 'b1', content: 'updated' }]);
  });
});
