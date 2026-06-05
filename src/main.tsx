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
    toggleHistory: showLocalHistory,
  });

  logseq.App.registerUIItem('toolbar', {
    key: 'show-local-history',
    template: `
      <a class="button" data-on-click="toggleHistory" title="Local History">
        <span class="ti ti-history"></span>
      </a>
    `,
  });

  logseq.App.registerCommandPalette(
    {
      key: 'show-local-history',
      label: 'Show Local History',
      keybinding: {
        binding: 'mod+shift+l',
      },
    },
    showLocalHistory
  );

  logseq.App.registerCommandShortcut('mod+shift+l', showLocalHistory, {
    key: 'show-local-history-shortcut',
    label: 'Show Local History',
  });

  logseq.setMainUIInlineStyle({
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    width: '300px',
    zIndex: 999,
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
