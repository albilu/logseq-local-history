import type { PageSnapshot, PluginSettings, SerializedBlock } from '../types';
import { parseExcludePages } from '../utils';
import { addSnapshot, getSnapshots } from './history-store';
import { areSnapshotsEqual, serializeBlockTree } from './snapshot';

type DbChangedBlock = {
  page?: {
    name?: string;
  };
};

type DbChangedData = {
  blocks: DbChangedBlock[];
  txData: unknown[];
  txMeta?: unknown;
};

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

    const attribute = entry[2];
    const value = entry[3];
    if ((attribute === ':block/name' || attribute === ':block/original-name') && typeof value === 'string') {
      pageNames.add(value);
      continue;
    }

    if (attribute === ':block/page' && (typeof value === 'string' || typeof value === 'number')) {
      pageRefs.add(value);
    }
  }

  for (const pageRef of pageRefs) {
    const page = await logseq.Editor.getPage(pageRef);
    if (typeof page?.name === 'string') {
      pageNames.add(page.name);
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
    if (isCurrentGeneration(currentGeneration)) {
      lastSnapshots.set(pageName, serialized);
    }
  } catch (error) {
    console.error(`Failed to capture snapshot for "${pageName}"`, error);
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

  for (const block of data.blocks) {
    const pageName = block.page?.name;
    if (!pageName) {
      continue;
    }

    if (excludedPages.includes(pageName.toLowerCase())) {
      continue;
    }

    affectedPages.add(pageName);
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
  captureQueue.clear();
}

export function handleDbChanged(data: DbChangedData, settings: PluginSettings): void {
  const currentGeneration = generation;

  void collectAffectedPages(data, settings, currentGeneration).then((affectedPages) => {
    if (!isCurrentGeneration(currentGeneration)) {
      return;
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
  });
}
