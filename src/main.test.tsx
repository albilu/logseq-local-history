import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockLogseq, mockLogseq, resetMockLogseq } from './__mocks__/logseq';
import type { PluginSettings } from './types';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const appElement = { id: 'app' };
const resetStateMock = vi.fn();
const handleDbChangedMock = vi.fn();

vi.mock('@logseq/libs', () => ({}));
vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));
vi.mock('./App', () => ({
  default: () => null,
}));
vi.mock('./services/change-detector', () => ({
  handleDbChanged: handleDbChangedMock,
  resetState: resetStateMock,
}));

function getDefaultSettings(): PluginSettings {
  return { maxVersions: 50, debounceMs: 5000, excludePages: '', disabled: false };
}

describe('plugin bootstrap', () => {
  beforeEach(() => {
    installMockLogseq();
    resetMockLogseq();

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        getElementById: vi.fn((id: string) => (id === 'app' ? appElement : null)),
      },
    });

    createRootMock.mockReset();
    createRootMock.mockImplementation(() => ({ render: renderMock }));
    renderMock.mockClear();
    resetStateMock.mockClear();
    handleDbChangedMock.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('registers plugin integrations and mounts the app when ready', async () => {
    await import('./main');

    expect(mockLogseq.useSettingsSchema).toHaveBeenCalledTimes(1);
    expect(mockLogseq.App.registerUIItem).toHaveBeenCalledWith('toolbar', expect.objectContaining({
      key: 'show-local-history',
      template: expect.stringMatching(/data-on-click="toggleHistory"[\s\S]*title="Local History"|title="Local History"[\s\S]*data-on-click="toggleHistory"/),
    }));
    expect(mockLogseq.App.registerCommandPalette).toHaveBeenCalledWith(expect.objectContaining({
      key: 'show-local-history',
      label: 'Show Local History',
      keybinding: expect.objectContaining({
        binding: 'mod+shift+l',
      }),
    }), expect.any(Function));
    expect(mockLogseq.App.registerCommandShortcut).not.toHaveBeenCalled();
    expect(mockLogseq.setMainUIInlineStyle).toHaveBeenCalledWith({
      position: 'fixed',
      top: '0',
      right: '0',
      bottom: '0',
      width: '300px',
      zIndex: 999,
    });
    expect(mockLogseq.DB.onChanged).toHaveBeenCalledTimes(1);
    expect(mockLogseq.App.onCurrentGraphChanged).toHaveBeenCalledTimes(1);
    expect(mockLogseq.beforeunload).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(appElement);
    expect(renderMock).toHaveBeenCalledTimes(1);

    const model = mockLogseq.provideModel.mock.calls[0]?.[0] as { toggleHistory: () => void };
    model.toggleHistory();
    expect(mockLogseq.showMainUI).toHaveBeenCalledWith({ autoFocus: true });

    const dbChangedHandler = mockLogseq.DB.onChanged.mock.calls[0]?.[0] as (data: unknown) => void;
    const settings = getDefaultSettings();
    const change = { blocks: [], txData: [], txMeta: { ok: true } };
    dbChangedHandler(change);
    expect(handleDbChangedMock).toHaveBeenCalledWith(change, settings);

    const graphChangedHandler = mockLogseq.App.onCurrentGraphChanged.mock.calls[0]?.[0] as () => void;
    graphChangedHandler();

    const beforeUnloadHandler = mockLogseq.beforeunload.mock.calls[0]?.[0] as () => Promise<void>;
    await beforeUnloadHandler();

    expect(resetStateMock).toHaveBeenCalledTimes(2);
  });

  it('skips DB change handling when the plugin is disabled', async () => {
    mockLogseq.settings = { ...getDefaultSettings(), disabled: true };

    await import('./main');

    const dbChangedHandler = mockLogseq.DB.onChanged.mock.calls[0]?.[0] as (data: unknown) => void;
    dbChangedHandler({ blocks: [], txData: [], txMeta: null });

    expect(handleDbChangedMock).not.toHaveBeenCalled();
  });
});
