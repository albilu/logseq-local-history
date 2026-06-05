export interface SerializedBlock {
  uuid: string;
  content: string;
  properties?: Record<string, unknown>;
  children?: SerializedBlock[];
}

export interface PageSnapshot {
  id: string;
  pageName: string;
  pageUuid: string;
  timestamp: number;
  blocks: SerializedBlock[];
}

export interface HistoryIndexEntry {
  id: string;
  timestamp: number;
}

export interface HistoryIndex {
  [sanitizedPageName: string]: HistoryIndexEntry[];
}

export interface PluginSettings {
  maxVersions: number;
  debounceMs: number;
  excludePages: string;
  disabled?: boolean;
}
