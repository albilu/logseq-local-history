import type { HistoryIndex, PageSnapshot } from '../types';
import { sanitizePageName } from '../utils';

const INDEX_KEY = 'history/_index.json';
const FILE_KEYS_KEY = 'history/_files.json';

function storageKey(pageName: string): string {
  const safeName = sanitizePageName(pageName);
  const encodedName = encodeURIComponent(pageName);

  return `history/${safeName}__${encodedName}.json`;
}

function toIndexEntries(snapshots: PageSnapshot[]) {
  return snapshots.map((snapshot) => ({ id: snapshot.id, timestamp: snapshot.timestamp }));
}

async function saveIndex(index: HistoryIndex): Promise<void> {
  await logseq.FileStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

async function getFileKeys(): Promise<string[]> {
  try {
    const hasItem = await logseq.FileStorage.hasItem(FILE_KEYS_KEY);
    if (!hasItem) {
      return [];
    }

    const raw = await logseq.FileStorage.getItem(FILE_KEYS_KEY);
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function saveFileKeys(fileKeys: string[]): Promise<void> {
  await logseq.FileStorage.setItem(FILE_KEYS_KEY, JSON.stringify(fileKeys));
}

async function addFileKey(fileKey: string): Promise<void> {
  const fileKeys = await getFileKeys();
  if (!fileKeys.includes(fileKey)) {
    fileKeys.push(fileKey);
    await saveFileKeys(fileKeys);
  }
}

async function removeFileKey(fileKey: string): Promise<void> {
  const fileKeys = (await getFileKeys()).filter((key) => key !== fileKey);

  if (fileKeys.length === 0) {
    await logseq.FileStorage.removeItem(FILE_KEYS_KEY);
    return;
  }

  await saveFileKeys(fileKeys);
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
  const fileKey = storageKey(snapshot.pageName);
  const snapshots = await getSnapshots(snapshot.pageName);
  snapshots.push(snapshot);

  while (snapshots.length > maxVersions) {
    snapshots.shift();
  }

  await logseq.FileStorage.setItem(fileKey, JSON.stringify(snapshots));
  await addFileKey(fileKey);

  const index = await getIndex();
  index[snapshot.pageName] = toIndexEntries(snapshots);
  await saveIndex(index);
}

export async function deleteSnapshot(pageName: string, snapshotId: string): Promise<void> {
  const fileKey = storageKey(pageName);
  const filteredSnapshots = (await getSnapshots(pageName)).filter((snapshot) => snapshot.id !== snapshotId);

  if (filteredSnapshots.length === 0) {
    await logseq.FileStorage.removeItem(fileKey);
    await removeFileKey(fileKey);
  } else {
    await logseq.FileStorage.setItem(fileKey, JSON.stringify(filteredSnapshots));
  }

  const index = await getIndex();
  if (filteredSnapshots.length === 0) {
    delete index[pageName];
  } else {
    index[pageName] = toIndexEntries(filteredSnapshots);
  }
  await saveIndex(index);
}

export async function clearHistory(pageName: string): Promise<void> {
  const fileKey = storageKey(pageName);

  await logseq.FileStorage.removeItem(fileKey);
  await removeFileKey(fileKey);

  const index = await getIndex();
  delete index[pageName];
  await saveIndex(index);
}

export async function clearAllHistory(): Promise<void> {
  const index = await getIndex();
  const fileKeys = await getFileKeys();

  for (const pageName of Object.keys(index)) {
    const fileKey = storageKey(pageName);
    if (!fileKeys.includes(fileKey)) {
      fileKeys.push(fileKey);
    }
  }

  for (const fileKey of fileKeys) {
    await logseq.FileStorage.removeItem(fileKey);
  }

  await logseq.FileStorage.removeItem(INDEX_KEY);
  await logseq.FileStorage.removeItem(FILE_KEYS_KEY);
}
