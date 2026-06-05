import { beforeEach, describe, expect, it } from 'vitest';
import { installMockLogseq, mockFileStorage, resetMockLogseq } from '../../__mocks__/logseq';
import type { PageSnapshot } from '../../types';
import {
  addSnapshot,
  clearAllHistory,
  clearHistory,
  deleteSnapshot,
  getIndex,
  getSnapshots,
} from '../history-store';

beforeEach(() => {
  installMockLogseq();
  resetMockLogseq();
});

function makeSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    pageName: overrides.pageName ?? 'test page',
    pageUuid: overrides.pageUuid ?? 'uuid-1',
    timestamp: overrides.timestamp ?? Date.now(),
    blocks: overrides.blocks ?? [{ uuid: 'b1', content: 'Hello' }],
  };
}

describe('getSnapshots', () => {
  it('returns empty array when no history exists', async () => {
    const result = await getSnapshots('nonexistent');

    expect(result).toEqual([]);
  });

  it('returns stored snapshots', async () => {
    const snapshot = makeSnapshot({ pageName: 'my page' });

    await addSnapshot(snapshot, 50);

    const result = await getSnapshots('my page');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(snapshot.id);
  });
});

describe('addSnapshot', () => {
  it('persists a snapshot', async () => {
    const snapshot = makeSnapshot();

    await addSnapshot(snapshot, 50);

    const stored = await getSnapshots(snapshot.pageName);

    expect(stored).toHaveLength(1);
    expect(stored[0].blocks).toEqual(snapshot.blocks);
  });

  it('appends multiple snapshots in order', async () => {
    const first = makeSnapshot({ timestamp: 1000 });
    const second = makeSnapshot({ timestamp: 2000 });

    await addSnapshot(first, 50);
    await addSnapshot(second, 50);

    const stored = await getSnapshots(first.pageName);

    expect(stored).toHaveLength(2);
    expect(stored[0].timestamp).toBe(1000);
    expect(stored[1].timestamp).toBe(2000);
  });

  it('prunes oldest snapshots when exceeding maxVersions', async () => {
    for (let index = 0; index < 5; index += 1) {
      await addSnapshot(makeSnapshot({ timestamp: index }), 3);
    }

    const stored = await getSnapshots('test page');

    expect(stored).toHaveLength(3);
    expect(stored[0].timestamp).toBe(2);
    expect(stored[2].timestamp).toBe(4);
  });

  it('updates the index', async () => {
    const snapshot = makeSnapshot();

    await addSnapshot(snapshot, 50);

    const index = await getIndex();
    const entries = Object.values(index)[0];

    expect(Object.keys(index)).toHaveLength(1);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(snapshot.id);
  });

  it('keeps snapshots separate when page names sanitize to the same value', async () => {
    const first = makeSnapshot({ id: 'snapshot-1', pageName: 'My/Page' });
    const second = makeSnapshot({ id: 'snapshot-2', pageName: 'my?page' });

    await addSnapshot(first, 50);
    await addSnapshot(second, 50);

    expect(await getSnapshots(first.pageName)).toEqual([first]);
    expect(await getSnapshots(second.pageName)).toEqual([second]);

    const index = await getIndex();

    expect(index[first.pageName][0].id).toBe(first.id);
    expect(index[second.pageName][0].id).toBe(second.id);
  });
});

describe('deleteSnapshot', () => {
  it('removes a specific snapshot', async () => {
    const first = makeSnapshot({ id: 'snapshot-1', timestamp: 1000 });
    const second = makeSnapshot({ id: 'snapshot-2', timestamp: 2000 });

    await addSnapshot(first, 50);
    await addSnapshot(second, 50);
    await deleteSnapshot(first.pageName, first.id);

    const stored = await getSnapshots(first.pageName);

    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(second.id);
  });

  it('removes storage key when last snapshot is deleted', async () => {
    const snapshot = makeSnapshot();

    await addSnapshot(snapshot, 50);
    await deleteSnapshot(snapshot.pageName, snapshot.id);

    const stored = await getSnapshots(snapshot.pageName);

    expect(stored).toEqual([]);
  });
});

describe('clearHistory', () => {
  it('removes all snapshots for a page', async () => {
    await addSnapshot(makeSnapshot({ id: 'snapshot-1' }), 50);
    await addSnapshot(makeSnapshot({ id: 'snapshot-2' }), 50);
    await clearHistory('test page');

    const stored = await getSnapshots('test page');

    expect(stored).toEqual([]);
  });

  it('removes page from index', async () => {
    await addSnapshot(makeSnapshot(), 50);
    await clearHistory('test page');

    const index = await getIndex();

    expect(Object.keys(index)).toHaveLength(0);
  });
});

describe('clearAllHistory', () => {
  it('removes all history data', async () => {
    await addSnapshot(makeSnapshot({ pageName: 'page1' }), 50);
    await addSnapshot(makeSnapshot({ pageName: 'page2' }), 50);
    await clearAllHistory();

    expect(await getSnapshots('page1')).toEqual([]);
    expect(await getSnapshots('page2')).toEqual([]);
    expect(await getIndex()).toEqual({});
  });

  it('removes history files even when the index is stale', async () => {
    const first = makeSnapshot({ id: 'snapshot-1', pageName: 'page1' });
    const second = makeSnapshot({ id: 'snapshot-2', pageName: 'page2' });

    await addSnapshot(first, 50);
    await addSnapshot(second, 50);
    await mockFileStorage.setItem('history/_index.json', JSON.stringify({
      page1: [{ id: first.id, timestamp: first.timestamp }],
    }));

    await clearAllHistory();

    expect(await getSnapshots('page1')).toEqual([]);
    expect(await getSnapshots('page2')).toEqual([]);
    expect(await getIndex()).toEqual({});
  });
});
