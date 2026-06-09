import '@logseq/libs';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setLocale, t } from './i18n';
import { handleDbChanged, resetState } from './services/change-detector';
import type { PluginSettings } from './types';

function getSettingsSchema() {
  return [
    {
      key: 'maxVersions',
      type: 'number',
      default: 50,
      title: t('settings.maxVersions.title'),
      description: t('settings.maxVersions.description'),
    },
    {
      key: 'debounceMs',
      type: 'number',
      default: 5000,
      title: t('settings.debounceMs.title'),
      description: t('settings.debounceMs.description'),
    },
    {
      key: 'excludePages',
      type: 'string',
      default: '',
      title: t('settings.excludePages.title'),
      description: t('settings.excludePages.description'),
    },
    {
      key: 'disabled',
      type: 'boolean',
      default: false,
      title: t('settings.disabled.title'),
      description: t('settings.disabled.description'),
    },
  ] as const;
}

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
  const userConfigs = await logseq.App.getUserConfigs();
  setLocale(typeof userConfigs?.preferredLanguage === 'string' ? userConfigs.preferredLanguage : 'en');

  logseq.useSettingsSchema([...getSettingsSchema()]);
  logseq.provideModel({
    toggleHistory: showLocalHistory,
  });

  logseq.App.registerUIItem('toolbar', {
    key: 'show-local-history',
    template: `
      <a class="button" data-on-click="toggleHistory" title="${t('toolbar.localHistory')}">
        <span class="ti ti-history"></span>
      </a>
    `,
  });

  logseq.App.registerCommandPalette(
    {
      key: 'show-local-history',
      label: t('command.showLocalHistory'),
      keybinding: {
        binding: 'mod+shift+l',
      },
    },
    showLocalHistory
  );

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
