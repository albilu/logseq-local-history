type TranslationKey =
  | 'settings.maxVersions.title'
  | 'settings.maxVersions.description'
  | 'settings.debounceMs.title'
  | 'settings.debounceMs.description'
  | 'settings.excludePages.title'
  | 'settings.excludePages.description'
  | 'settings.disabled.title'
  | 'settings.disabled.description'
  | 'toolbar.localHistory'
  | 'command.showLocalHistory'
  | 'sidebar.loadError'
  | 'sidebar.loadErrorToast'
  | 'sidebar.clearErrorToast'
  | 'sidebar.title'
  | 'sidebar.closeAria'
  | 'sidebar.pageLabel'
  | 'sidebar.loading'
  | 'sidebar.navigateToPage'
  | 'sidebar.noHistory'
  | 'sidebar.selectVersionAria'
  | 'sidebar.versionCount'
  | 'sidebar.versionCount_plural'
  | 'sidebar.compareCurrent'
  | 'sidebar.compareSelected'
  | 'sidebar.clearHistory'
  | 'diff.currentVersion'
  | 'diff.copied'
  | 'diff.copyFailed'
  | 'diff.revertFailed'
  | 'diff.back'
  | 'diff.splitView'
  | 'diff.copyOld'
  | 'diff.reverting'
  | 'diff.revert'
  | 'app.currentPageChanged'
  | 'app.compareLoadFailed'
  | 'revert.success'
  | 'time.justNow'
  | 'time.minutesAgo'
  | 'time.hoursAgo'
  | 'time.hoursAgo_plural'
  | 'time.yesterday'
  | 'time.daysAgo';

type Locale = 'en' | 'fr' | 'de' | 'nl' | 'zh-CN';

type TranslationMap = Record<Locale, Record<TranslationKey, string>>;

const translations: TranslationMap = {
  en: {
    'settings.maxVersions.title': 'Maximum versions per page',
    'settings.maxVersions.description': 'How many snapshots to keep for each page before pruning older entries.',
    'settings.debounceMs.title': 'Snapshot debounce (ms)',
    'settings.debounceMs.description': 'Wait time after edits before capturing a new snapshot.',
    'settings.excludePages.title': 'Excluded pages',
    'settings.excludePages.description': 'Comma-separated page names to skip when recording history.',
    'settings.disabled.title': 'Disable plugin',
    'settings.disabled.description': 'Pause history capture without uninstalling the plugin.',
    'toolbar.localHistory': 'Local History',
    'command.showLocalHistory': 'Show Local History',
    'sidebar.loadError': 'Failed to load history for this page.',
    'sidebar.loadErrorToast': 'Failed to load history for "{pageName}".',
    'sidebar.clearErrorToast': 'Failed to clear history for "{pageName}".',
    'sidebar.title': 'Local History',
    'sidebar.closeAria': 'Close local history',
    'sidebar.pageLabel': 'Page: {pageName}',
    'sidebar.loading': 'Loading...',
    'sidebar.navigateToPage': 'Navigate to a page to view its history.',
    'sidebar.noHistory': 'No history for this page yet.',
    'sidebar.selectVersionAria': 'Select version from {timestamp}',
    'sidebar.versionCount': '{count} version',
    'sidebar.versionCount_plural': '{count} versions',
    'sidebar.compareCurrent': 'Compare with Current',
    'sidebar.compareSelected': 'Compare Selected',
    'sidebar.clearHistory': 'Clear History',
    'diff.currentVersion': 'Current Version',
    'diff.copied': 'Copied to clipboard',
    'diff.copyFailed': 'Copy failed. Clipboard access is unavailable.',
    'diff.revertFailed': 'Revert failed. Your previous version was saved.',
    'diff.back': 'Back',
    'diff.splitView': 'Split view',
    'diff.copyOld': 'Copy Old',
    'diff.reverting': 'Reverting...',
    'diff.revert': 'Revert to This Version',
    'app.currentPageChanged': 'The current page changed. Close and reopen Local History for the new page.',
    'app.compareLoadFailed': 'Failed to load the current page for comparison.',
    'revert.success': 'Reverted to version from {timestamp}',
    'time.justNow': 'just now',
    'time.minutesAgo': '{count} min ago',
    'time.hoursAgo': '{count} hour ago',
    'time.hoursAgo_plural': '{count} hours ago',
    'time.yesterday': 'yesterday',
    'time.daysAgo': '{count} days ago',
  },
  fr: {
    'settings.maxVersions.title': 'Nombre maximal de versions par page',
    'settings.maxVersions.description': 'Nombre d’instantanés à conserver pour chaque page avant de supprimer les plus anciens.',
    'settings.debounceMs.title': 'Délai avant capture (ms)',
    'settings.debounceMs.description': 'Temps d’attente après les modifications avant de capturer un nouvel instantané.',
    'settings.excludePages.title': 'Pages exclues',
    'settings.excludePages.description': 'Noms de pages séparés par des virgules à ignorer lors de l’enregistrement de l’historique.',
    'settings.disabled.title': 'Désactiver le plugin',
    'settings.disabled.description': 'Met en pause la capture de l’historique sans désinstaller le plugin.',
    'toolbar.localHistory': 'Historique local',
    'command.showLocalHistory': 'Afficher l’historique local',
    'sidebar.loadError': 'Impossible de charger l’historique de cette page.',
    'sidebar.loadErrorToast': 'Impossible de charger l’historique pour "{pageName}".',
    'sidebar.clearErrorToast': 'Impossible d’effacer l’historique pour "{pageName}".',
    'sidebar.title': 'Historique local',
    'sidebar.closeAria': 'Fermer l’historique local',
    'sidebar.pageLabel': 'Page : {pageName}',
    'sidebar.loading': 'Chargement...',
    'sidebar.navigateToPage': 'Ouvrez une page pour voir son historique.',
    'sidebar.noHistory': 'Aucun historique pour cette page.',
    'sidebar.selectVersionAria': 'Sélectionner la version du {timestamp}',
    'sidebar.versionCount': '{count} version',
    'sidebar.versionCount_plural': '{count} versions',
    'sidebar.compareCurrent': 'Comparer avec la version actuelle',
    'sidebar.compareSelected': 'Comparer la sélection',
    'sidebar.clearHistory': 'Effacer l’historique',
    'diff.currentVersion': 'Version actuelle',
    'diff.copied': 'Copié dans le presse-papiers',
    'diff.copyFailed': 'Échec de la copie. L’accès au presse-papiers est indisponible.',
    'diff.revertFailed': 'Échec de la restauration. Votre version précédente a été sauvegardée.',
    'diff.back': 'Retour',
    'diff.splitView': 'Vue scindée',
    'diff.copyOld': 'Copier l’ancienne',
    'diff.reverting': 'Restauration...',
    'diff.revert': 'Restaurer cette version',
    'app.currentPageChanged': 'La page actuelle a changé. Fermez puis rouvrez l’historique local pour la nouvelle page.',
    'app.compareLoadFailed': 'Impossible de charger la page actuelle pour la comparaison.',
    'revert.success': 'Version restaurée depuis {timestamp}',
    'time.justNow': 'à l’instant',
    'time.minutesAgo': 'il y a {count} min',
    'time.hoursAgo': 'il y a {count} h',
    'time.hoursAgo_plural': 'il y a {count} h',
    'time.yesterday': 'hier',
    'time.daysAgo': 'il y a {count} jours',
  },
  de: {
    'settings.maxVersions.title': 'Maximale Versionen pro Seite',
    'settings.maxVersions.description': 'Wie viele Snapshots pro Seite gespeichert werden, bevor ältere Einträge entfernt werden.',
    'settings.debounceMs.title': 'Snapshot-Verzögerung (ms)',
    'settings.debounceMs.description': 'Wartezeit nach Änderungen, bevor ein neuer Snapshot erstellt wird.',
    'settings.excludePages.title': 'Ausgeschlossene Seiten',
    'settings.excludePages.description': 'Kommagetrennte Seitennamen, die bei der Verlaufserfassung übersprungen werden.',
    'settings.disabled.title': 'Plugin deaktivieren',
    'settings.disabled.description': 'Pausiert die Verlaufserfassung, ohne das Plugin zu deinstallieren.',
    'toolbar.localHistory': 'Lokaler Verlauf',
    'command.showLocalHistory': 'Lokalen Verlauf anzeigen',
    'sidebar.loadError': 'Der Verlauf dieser Seite konnte nicht geladen werden.',
    'sidebar.loadErrorToast': 'Der Verlauf für "{pageName}" konnte nicht geladen werden.',
    'sidebar.clearErrorToast': 'Der Verlauf für "{pageName}" konnte nicht gelöscht werden.',
    'sidebar.title': 'Lokaler Verlauf',
    'sidebar.closeAria': 'Lokalen Verlauf schließen',
    'sidebar.pageLabel': 'Seite: {pageName}',
    'sidebar.loading': 'Lädt...',
    'sidebar.navigateToPage': 'Öffnen Sie eine Seite, um ihren Verlauf zu sehen.',
    'sidebar.noHistory': 'Für diese Seite gibt es noch keinen Verlauf.',
    'sidebar.selectVersionAria': 'Version von {timestamp} auswählen',
    'sidebar.versionCount': '{count} Version',
    'sidebar.versionCount_plural': '{count} Versionen',
    'sidebar.compareCurrent': 'Mit aktueller Version vergleichen',
    'sidebar.compareSelected': 'Auswahl vergleichen',
    'sidebar.clearHistory': 'Verlauf löschen',
    'diff.currentVersion': 'Aktuelle Version',
    'diff.copied': 'In die Zwischenablage kopiert',
    'diff.copyFailed': 'Kopieren fehlgeschlagen. Kein Zugriff auf die Zwischenablage.',
    'diff.revertFailed': 'Wiederherstellung fehlgeschlagen. Ihre vorherige Version wurde gespeichert.',
    'diff.back': 'Zurück',
    'diff.splitView': 'Geteilte Ansicht',
    'diff.copyOld': 'Alte Version kopieren',
    'diff.reverting': 'Wird wiederhergestellt...',
    'diff.revert': 'Diese Version wiederherstellen',
    'app.currentPageChanged': 'Die aktuelle Seite hat sich geändert. Schließen und öffnen Sie den lokalen Verlauf für die neue Seite erneut.',
    'app.compareLoadFailed': 'Die aktuelle Seite konnte nicht für den Vergleich geladen werden.',
    'revert.success': 'Version von {timestamp} wiederhergestellt',
    'time.justNow': 'gerade eben',
    'time.minutesAgo': 'vor {count} Min.',
    'time.hoursAgo': 'vor {count} Std.',
    'time.hoursAgo_plural': 'vor {count} Std.',
    'time.yesterday': 'gestern',
    'time.daysAgo': 'vor {count} Tagen',
  },
  nl: {
    'settings.maxVersions.title': 'Maximum aantal versies per pagina',
    'settings.maxVersions.description': 'Hoeveel snapshots per pagina bewaard blijven voordat oudere items worden verwijderd.',
    'settings.debounceMs.title': 'Snapshot-vertraging (ms)',
    'settings.debounceMs.description': 'Wachttijd na bewerkingen voordat een nieuwe snapshot wordt gemaakt.',
    'settings.excludePages.title': 'Uitgesloten pagina’s',
    'settings.excludePages.description': 'Komma-gescheiden paginanamen die worden overgeslagen bij het opslaan van geschiedenis.',
    'settings.disabled.title': 'Plugin uitschakelen',
    'settings.disabled.description': 'Pauzeert het vastleggen van geschiedenis zonder de plugin te verwijderen.',
    'toolbar.localHistory': 'Lokale geschiedenis',
    'command.showLocalHistory': 'Lokale geschiedenis tonen',
    'sidebar.loadError': 'Kan de geschiedenis van deze pagina niet laden.',
    'sidebar.loadErrorToast': 'Kan de geschiedenis voor "{pageName}" niet laden.',
    'sidebar.clearErrorToast': 'Kan de geschiedenis voor "{pageName}" niet wissen.',
    'sidebar.title': 'Lokale geschiedenis',
    'sidebar.closeAria': 'Lokale geschiedenis sluiten',
    'sidebar.pageLabel': 'Pagina: {pageName}',
    'sidebar.loading': 'Laden...',
    'sidebar.navigateToPage': 'Open een pagina om de geschiedenis te bekijken.',
    'sidebar.noHistory': 'Nog geen geschiedenis voor deze pagina.',
    'sidebar.selectVersionAria': 'Versie van {timestamp} selecteren',
    'sidebar.versionCount': '{count} versie',
    'sidebar.versionCount_plural': '{count} versies',
    'sidebar.compareCurrent': 'Vergelijk met huidige versie',
    'sidebar.compareSelected': 'Vergelijk selectie',
    'sidebar.clearHistory': 'Geschiedenis wissen',
    'diff.currentVersion': 'Huidige versie',
    'diff.copied': 'Gekopieerd naar klembord',
    'diff.copyFailed': 'Kopiëren mislukt. Klembordtoegang is niet beschikbaar.',
    'diff.revertFailed': 'Terugzetten mislukt. Uw vorige versie is opgeslagen.',
    'diff.back': 'Terug',
    'diff.splitView': 'Gesplitste weergave',
    'diff.copyOld': 'Oude versie kopiëren',
    'diff.reverting': 'Bezig met terugzetten...',
    'diff.revert': 'Deze versie terugzetten',
    'app.currentPageChanged': 'De huidige pagina is gewijzigd. Sluit en open Lokale geschiedenis opnieuw voor de nieuwe pagina.',
    'app.compareLoadFailed': 'Kan de huidige pagina niet laden voor vergelijking.',
    'revert.success': 'Versie van {timestamp} hersteld',
    'time.justNow': 'zojuist',
    'time.minutesAgo': '{count} min geleden',
    'time.hoursAgo': '{count} uur geleden',
    'time.hoursAgo_plural': '{count} uur geleden',
    'time.yesterday': 'gisteren',
    'time.daysAgo': '{count} dagen geleden',
  },
  'zh-CN': {
    'settings.maxVersions.title': '每页最大版本数',
    'settings.maxVersions.description': '每页保留多少个快照，超过后会删除较旧的记录。',
    'settings.debounceMs.title': '快照防抖时间（毫秒）',
    'settings.debounceMs.description': '编辑后等待多久再捕获新快照。',
    'settings.excludePages.title': '排除页面',
    'settings.excludePages.description': '用逗号分隔的不记录历史的页面名称。',
    'settings.disabled.title': '禁用插件',
    'settings.disabled.description': '暂停历史记录捕获而不卸载插件。',
    'toolbar.localHistory': '本地历史',
    'command.showLocalHistory': '显示本地历史',
    'sidebar.loadError': '无法加载此页面的历史记录。',
    'sidebar.loadErrorToast': '无法加载“{pageName}”的历史记录。',
    'sidebar.clearErrorToast': '无法清除“{pageName}”的历史记录。',
    'sidebar.title': '本地历史',
    'sidebar.closeAria': '关闭本地历史',
    'sidebar.pageLabel': '页面：{pageName}',
    'sidebar.loading': '加载中...',
    'sidebar.navigateToPage': '请先打开一个页面以查看其历史记录。',
    'sidebar.noHistory': '此页面还没有历史记录。',
    'sidebar.selectVersionAria': '选择 {timestamp} 的版本',
    'sidebar.versionCount': '{count} 个版本',
    'sidebar.versionCount_plural': '{count} 个版本',
    'sidebar.compareCurrent': '与当前版本比较',
    'sidebar.compareSelected': '比较所选版本',
    'sidebar.clearHistory': '清除历史记录',
    'diff.currentVersion': '当前版本',
    'diff.copied': '已复制到剪贴板',
    'diff.copyFailed': '复制失败。无法访问剪贴板。',
    'diff.revertFailed': '恢复失败。您之前的版本已保存。',
    'diff.back': '返回',
    'diff.splitView': '分栏视图',
    'diff.copyOld': '复制旧版本',
    'diff.reverting': '正在恢复...',
    'diff.revert': '恢复到此版本',
    'app.currentPageChanged': '当前页面已更改。请关闭并重新打开本地历史以查看新页面。',
    'app.compareLoadFailed': '无法加载当前页面进行比较。',
    'revert.success': '已恢复到 {timestamp} 的版本',
    'time.justNow': '刚刚',
    'time.minutesAgo': '{count} 分钟前',
    'time.hoursAgo': '{count} 小时前',
    'time.hoursAgo_plural': '{count} 小时前',
    'time.yesterday': '昨天',
    'time.daysAgo': '{count} 天前',
  },
};

let currentLocale: Locale = 'en';

function normalizeLocale(locale: string | undefined): Locale {
  switch ((locale ?? '').toLowerCase()) {
    case 'fr':
    case 'fr-fr':
      return 'fr';
    case 'de':
    case 'de-de':
      return 'de';
    case 'nl':
    case 'nl-nl':
      return 'nl';
    case 'zh':
    case 'zh-cn':
    case 'zh-hans':
    case 'zh-hans-cn':
      return 'zh-CN';
    default:
      return 'en';
  }
}

export function setLocale(locale: string | undefined): void {
  currentLocale = normalizeLocale(locale);
}

export function getLocale(): string {
  return currentLocale;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const template = translations[currentLocale][key] ?? translations.en[key] ?? key;
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((result, [paramKey, value]) => (
    result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value))
  ), template);
}

export function tPlural(baseKey: 'sidebar.versionCount', count: number): string {
  const key = count === 1 ? baseKey : `${baseKey}_plural` as const;
  return t(key, { count });
}

export function tTimeHours(count: number): string {
  const key = count === 1 ? 'time.hoursAgo' : 'time.hoursAgo_plural';
  return t(key, { count });
}
