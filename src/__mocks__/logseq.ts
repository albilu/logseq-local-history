import type { PluginSettings } from '../types';
import { vi } from 'vitest';

const storage = new Map<string, string>();

export const mockFileStorage = {
  hasItem: vi.fn(async (key: string) => storage.has(key)),
  getItem: vi.fn(async (key: string) => {
    const value = storage.get(key);
    if (value === undefined) {
      throw new Error(`Key not found: ${key}`);
    }
    return value;
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    storage.delete(key);
  }),
  clear: () => storage.clear(),
};

export const mockEditor = {
  getCurrentPage: vi.fn(),
  getCurrentPageBlocksTree: vi.fn(),
  getPageBlocksTree: vi.fn(),
  getPage: vi.fn(),
  removeBlock: vi.fn(),
  appendBlockInPage: vi.fn(),
  insertBatchBlock: vi.fn(),
};

export const mockUI = {
  showMsg: vi.fn(),
};

export const mockApp = {
  registerCommandPalette: vi.fn(),
  registerCommandShortcut: vi.fn(),
  registerUIItem: vi.fn(),
  onCurrentGraphChanged: vi.fn(),
};

export const mockDB = {
  onChanged: vi.fn(),
};

export const mockLogseq = {
  ready: vi.fn(async (cb?: Function) => cb?.()),
  useSettingsSchema: vi.fn(),
  provideModel: vi.fn(),
  provideStyle: vi.fn(),
  showMainUI: vi.fn(),
  hideMainUI: vi.fn(),
  setMainUIInlineStyle: vi.fn(),
  onSettingsChanged: vi.fn(),
  beforeunload: vi.fn(),
  settings: { maxVersions: 50, debounceMs: 5000, excludePages: '', disabled: false } as PluginSettings,
  FileStorage: mockFileStorage,
  Editor: mockEditor,
  UI: mockUI,
  App: mockApp,
  DB: mockDB,
};

export function installMockLogseq(): void {
  (globalThis as unknown as { logseq?: typeof mockLogseq }).logseq = mockLogseq;
}

export function resetMockLogseq(): void {
  vi.resetAllMocks();
  mockFileStorage.clear();
  mockLogseq.ready.mockImplementation(async (cb?: Function) => cb?.());
  mockFileStorage.hasItem.mockImplementation(async (key: string) => storage.has(key));
  mockFileStorage.getItem.mockImplementation(async (key: string) => {
    const value = storage.get(key);
    if (value === undefined) {
      throw new Error(`Key not found: ${key}`);
    }
    return value;
  });
  mockFileStorage.setItem.mockImplementation(async (key: string, value: string) => {
    storage.set(key, value);
  });
  mockFileStorage.removeItem.mockImplementation(async (key: string) => {
    storage.delete(key);
  });
  mockLogseq.settings = { maxVersions: 50, debounceMs: 5000, excludePages: '', disabled: false };
}
