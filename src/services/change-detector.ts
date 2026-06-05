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

let timers: TimerMap = new Map();
let lastSnapshots = new Map<string, SerializedBlock[]>();

async function captureSnapshot(pageName: string, maxVersions: number): Promise<void> {
  try {
    const blocks = await logseq.Editor.getPageBlocksTree(pageName);
    if (!Array.isArray(blocks) || blocks.length === 0) {
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
      lastSnapshots.set(pageName, serialized);
      return;
    }

    const page = await logseq.Editor.getPage(pageName);
    const snapshot: PageSnapshot = {
      id: crypto.randomUUID(),
      pageName,
      pageUuid: typeof page?.uuid === 'string' ? page.uuid : '',
      timestamp: Date.now(),
      blocks: serialized,
    };

    await addSnapshot(snapshot, maxVersions);
    lastSnapshots.set(pageName, serialized);
  } catch (error) {
    console.error(`Failed to capture snapshot for "${pageName}"`, error);
  }
}

export function resetState(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }

  timers.clear();
  lastSnapshots.clear();
}

export function handleDbChanged(data: DbChangedData, settings: PluginSettings): void {
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

  for (const pageName of affectedPages) {
    const existingTimer = timers.get(pageName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      timers.delete(pageName);
      void captureSnapshot(pageName, settings.maxVersions);
    }, settings.debounceMs);

    timers.set(pageName, timer);
  }
}
