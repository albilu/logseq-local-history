import type { HistoryIndex, PageSnapshot } from '../types';
import { sanitizePageName } from '../utils';

const INDEX_KEY = 'history/_index.json';

function storageKey(pageName: string): string {
  return `history/${sanitizePageName(pageName)}.json`;
}

function toIndexEntries(snapshots: PageSnapshot[]) {
  return snapshots.map((snapshot) => ({ id: snapshot.id, timestamp: snapshot.timestamp }));
}

async function saveIndex(index: HistoryIndex): Promise<void> {
  await logseq.FileStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function getIndex(): Promise<HistoryIndex> {
  try {
    const hasItem = await logseq.FileStorage.hasItem(INDEX_KEY);
    if (!hasItem) {
      return {};
    }

    const raw = await logseq.FileStorage.getItem(INDEX_KEY);
    return JSON.parse(raw) as HistoryIndex;
  } catch {
    return {};
  }
}

export async function getSnapshots(pageName: string): Promise<PageSnapshot[]> {
  const key = storageKey(pageName);

  try {
    const hasItem = await logseq.FileStorage.hasItem(key);
    if (!hasItem) {
      return [];
    }

    const raw = await logseq.FileStorage.getItem(key);
    return JSON.parse(raw) as PageSnapshot[];
  } catch {
    return [];
  }
}

export async function addSnapshot(snapshot: PageSnapshot, maxVersions: number): Promise<void> {
  const snapshots = await getSnapshots(snapshot.pageName);
  snapshots.push(snapshot);

  while (snapshots.length > maxVersions) {
    snapshots.shift();
  }

  await logseq.FileStorage.setItem(storageKey(snapshot.pageName), JSON.stringify(snapshots));

  const index = await getIndex();
  index[sanitizePageName(snapshot.pageName)] = toIndexEntries(snapshots);
  await saveIndex(index);
}

export async function deleteSnapshot(pageName: string, snapshotId: string): Promise<void> {
  const filteredSnapshots = (await getSnapshots(pageName)).filter((snapshot) => snapshot.id !== snapshotId);
  const sanitizedPageName = sanitizePageName(pageName);

  if (filteredSnapshots.length === 0) {
    await logseq.FileStorage.removeItem(storageKey(pageName));
  } else {
    await logseq.FileStorage.setItem(storageKey(pageName), JSON.stringify(filteredSnapshots));
  }

  const index = await getIndex();
  if (filteredSnapshots.length === 0) {
    delete index[sanitizedPageName];
  } else {
    index[sanitizedPageName] = toIndexEntries(filteredSnapshots);
  }
  await saveIndex(index);
}

export async function clearHistory(pageName: string): Promise<void> {
  await logseq.FileStorage.removeItem(storageKey(pageName));

  const index = await getIndex();
  delete index[sanitizePageName(pageName)];
  await saveIndex(index);
}

export async function clearAllHistory(): Promise<void> {
  const index = await getIndex();

  for (const sanitizedPageName of Object.keys(index)) {
    await logseq.FileStorage.removeItem(`history/${sanitizedPageName}.json`);
  }

  await logseq.FileStorage.removeItem(INDEX_KEY);
}
