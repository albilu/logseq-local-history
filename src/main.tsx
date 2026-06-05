import '@logseq/libs';
import { createRoot } from 'react-dom/client';
import App from './App';
import { handleDbChanged, resetState } from './services/change-detector';
import type { PluginSettings } from './types';

const SETTINGS_SCHEMA = [
  {
    key: 'maxVersions',
    type: 'number',
    default: 50,
    title: 'Maximum versions per page',
    description: 'How many snapshots to keep for each page before pruning older entries.',
  },
  {
    key: 'debounceMs',
    type: 'number',
    default: 5000,
    title: 'Snapshot debounce (ms)',
    description: 'Wait time after edits before capturing a new snapshot.',
  },
  {
    key: 'excludePages',
    type: 'string',
    default: '',
    title: 'Excluded pages',
    description: 'Comma-separated page names to skip when recording history.',
  },
  {
    key: 'disabled',
    type: 'boolean',
    default: false,
    title: 'Disable plugin',
    description: 'Pause history capture without uninstalling the plugin.',
  },
] as const;

function getSettings(): PluginSettings {
  const settings = logseq.settings as Partial<PluginSettings> | undefined;

  return {
    maxVersions: typeof settings?.maxVersions === 'number' ? settings.maxVersions : 50,
    debounceMs: typeof settings?.debounceMs === 'number' ? settings.debounceMs : 5000,
    excludePages: typeof settings?.excludePages === 'string' ? settings.excludePages : '',
    disabled: settings?.disabled === true,
  };
}

function showLocalHistory(): void {
  logseq.showMainUI({ autoFocus: true });
}

async function main(): Promise<void> {
  logseq.useSettingsSchema([...SETTINGS_SCHEMA]);
  logseq.provideModel({
    showLocalHistory,
  });

  logseq.App.registerUIItem('toolbar', {
    key: 'logseq-local-history-toolbar',
    template: `
      <a class="button" data-on-click="showLocalHistory" title="Open local history">
        <span class="ti ti-history"></span>
      </a>
    `,
  });

  logseq.App.registerCommandPalette(
    {
      key: 'logseq-local-history-open',
      label: 'Open local history',
      keybinding: {
        mode: 'global',
        binding: 'mod+shift+h',
      },
    },
    showLocalHistory
  );

  logseq.App.registerCommandShortcut('mod+shift+h', showLocalHistory, {
    key: 'logseq-local-history-open-shortcut',
    label: 'Open local history',
  });

  logseq.setMainUIInlineStyle({
    position: 'fixed',
    right: '1rem',
    top: '3.5rem',
    width: 'min(720px, calc(100vw - 2rem))',
    height: 'min(80vh, 640px)',
    zIndex: 11,
  });

  logseq.DB.onChanged((data) => {
    const settings = getSettings();
    if (settings.disabled) {
      return;
    }

    handleDbChanged(data, settings);
  });

  logseq.App.onCurrentGraphChanged(() => {
    resetState();
  });

  logseq.beforeunload(async () => {
    resetState();
  });

  const container = document.getElementById('app');
  if (!container) {
    throw new Error('App root element not found');
  }

  createRoot(container).render(<App />);
}

logseq.ready(main).catch(console.error);
