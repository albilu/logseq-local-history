import type { PageSnapshot, PluginSettings, SerializedBlock } from '../types';
import { parseExcludePages } from '../utils';
import { addSnapshot, deleteSnapshot, getSnapshots } from './history-store';
import { areSnapshotsEqual, serializeBlockTree } from './snapshot';

type DbChangedBlock = {
  uuid?: string;
  page?: {
    name?: string;
    id?: number;
    [key: string]: unknown;
  } | string | number | null;
};

type DbChangedData = {
  blocks: DbChangedBlock[];
  txData: unknown[];
  txMeta?: unknown;
};

function getBlockPageName(block: DbChangedBlock): string | undefined {
  if (!block.page || typeof block.page !== 'object') {
    return undefined;
  }

  return typeof block.page.name === 'string' ? block.page.name : undefined;
}

function getBlockPageId(block: DbChangedBlock): number | undefined {
  if (!block.page || typeof block.page !== 'object') {
    return undefined;
  }

  return typeof block.page.id === 'number' ? block.page.id : undefined;
}

type TimerMap = Map<string, ReturnType<typeof setTimeout>>;
type CaptureMap = Map<string, Promise<void>>;
type PageDatom = [unknown, unknown, unknown, unknown];

let timers: TimerMap = new Map();
let lastSnapshots = new Map<string, SerializedBlock[]>();
let captureQueue: CaptureMap = new Map();
let generation = 0;

function isCurrentGeneration(currentGeneration: number): boolean {
  return generation === currentGeneration;
}

function isPageDatom(entry: unknown): entry is PageDatom {
  return Array.isArray(entry) && entry.length >= 4;
}

async function getPageNamesFromTxData(txData: unknown[]): Promise<string[]> {
  const pageNames = new Set<string>();
  const pageRefs = new Set<string | number>();

  for (const entry of txData) {
    if (!isPageDatom(entry)) {
      continue;
    }

    const attribute = entry[1];
    const value = entry[2];
    if ((attribute === ':block/name' || attribute === ':block/original-name') && typeof value === 'string') {
      pageNames.add(value);
      continue;
    }

    if (attribute === ':block/page' && (typeof value === 'string' || typeof value === 'number')) {
      pageRefs.add(value);
    }
  }

  for (const pageRef of pageRefs) {
    try {
      const page = await logseq.Editor.getPage(pageRef);
      if (typeof page?.name === 'string') {
        pageNames.add(page.name);
      }
    } catch (error) {
      console.error(`Failed to resolve page from txData for "${String(pageRef)}"`, error);
    }
  }

  return [...pageNames];
}

async function captureSnapshot(pageName: string, maxVersions: number, currentGeneration: number): Promise<void> {
  try {
    if (!isCurrentGeneration(currentGeneration)) {
      return;
    }

    const blocks = await logseq.Editor.getPageBlocksTree(pageName);
    if (!isCurrentGeneration(currentGeneration) || !Array.isArray(blocks) || blocks.length === 0) {
      console.info('[local-history] no blocks for', pageName, '- blocks:', blocks);
      return;
    }

    const serialized = serializeBlockTree(blocks as Array<Record<string, unknown>>);
    const lastSnapshot = lastSnapshots.get(pageName);
    if (lastSnapshot && areSnapshotsEqual(lastSnapshot, serialized)) {
      return;
    }

    const storedSnapshots = await getSnapshots(pageName);
    const lastStoredSnapshot = storedSnapshots[storedSnapshots.length - 1];
    if (lastStoredSnapshot && areSnapshotsEqual(lastStoredSnapshot.blocks, serialized)) {
      if (isCurrentGeneration(currentGeneration)) {
        lastSnapshots.set(pageName, serialized);
      }
      return;
    }

    const page = await logseq.Editor.getPage(pageName);
    if (!isCurrentGeneration(currentGeneration)) {
      return;
    }

    const snapshot: PageSnapshot = {
      id: crypto.randomUUID(),
      pageName,
      pageUuid: typeof page?.uuid === 'string' ? page.uuid : '',
      timestamp: Date.now(),
      blocks: serialized,
    };

    await addSnapshot(snapshot, maxVersions);
    console.info('[local-history] snapshot saved for', pageName, '- total:', (await getSnapshots(pageName)).length);
    if (!isCurrentGeneration(currentGeneration)) {
      await deleteSnapshot(pageName, snapshot.id);
      return;
    }

    if (isCurrentGeneration(currentGeneration)) {
      lastSnapshots.set(pageName, serialized);
    }
  } catch (error) {
    console.error(`[local-history] Failed to capture snapshot for "${pageName}"`, error);
  }
}

function queueCapture(pageName: string, maxVersions: number, currentGeneration: number): void {
  const previousCapture = captureQueue.get(pageName) ?? Promise.resolve();
  const nextCapture = previousCapture
    .catch(() => undefined)
    .then(() => captureSnapshot(pageName, maxVersions, currentGeneration));

  captureQueue.set(pageName, nextCapture);

  void nextCapture.finally(() => {
    if (captureQueue.get(pageName) === nextCapture) {
      captureQueue.delete(pageName);
    }
  });
}

async function collectAffectedPages(data: DbChangedData, settings: PluginSettings, currentGeneration: number): Promise<Set<string>> {
  const excludedPages = parseExcludePages(settings.excludePages);
  const affectedPages = new Set<string>();
  const pageIdsToResolve = new Set<number>();

  for (const block of data.blocks) {
    const pageName = getBlockPageName(block);
    if (pageName) {
      if (!excludedPages.includes(pageName.toLowerCase())) {
        affectedPages.add(pageName);
      }
      continue;
    }

    const pageId = getBlockPageId(block);
    if (pageId !== undefined) {
      pageIdsToResolve.add(pageId);
    }
  }

  for (const pageId of pageIdsToResolve) {
    if (!isCurrentGeneration(currentGeneration)) {
      return new Set();
    }

    try {
      const page = await logseq.Editor.getPage(pageId);
      if (typeof page?.name === 'string' && !excludedPages.includes(page.name.toLowerCase())) {
        affectedPages.add(page.name);
      }
    } catch (error) {
      console.error(`Failed to resolve page from block page ID ${pageId}`, error);
    }
  }

  const txPageNames = await getPageNamesFromTxData(data.txData);
  if (!isCurrentGeneration(currentGeneration)) {
    return new Set();
  }

  for (const pageName of txPageNames) {
    if (excludedPages.includes(pageName.toLowerCase())) {
      continue;
    }

    affectedPages.add(pageName);
  }

  return affectedPages;
}

export function resetState(): void {
  generation += 1;

  for (const timer of timers.values()) {
    clearTimeout(timer);
  }

  timers.clear();
  lastSnapshots.clear();
}

export function handleDbChanged(data: DbChangedData, settings: PluginSettings): void {
  const currentGeneration = generation;

  void collectAffectedPages(data, settings, currentGeneration)
    .then((affectedPages) => {
      if (!isCurrentGeneration(currentGeneration)) {
        return;
      }

      if (affectedPages.size > 0) {
        console.info('[local-history] pages changed:', [...affectedPages]);
      }

      for (const pageName of affectedPages) {
        const existingTimer = timers.get(pageName);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          timers.delete(pageName);
          queueCapture(pageName, settings.maxVersions, currentGeneration);
        }, settings.debounceMs);

        timers.set(pageName, timer);
      }
    })
    .catch((error) => {
      console.error('Failed to collect affected pages from change event', error);
    });
}
