import { getLocale, t, tTimeHours } from './i18n';

export function sanitizePageName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').replace(/_+/g, '_').toLowerCase();
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return t('time.justNow');
  }

  if (minutes < 60) {
    return t('time.minutesAgo', { count: minutes });
  }

  if (hours < 24) {
    return tTimeHours(hours);
  }

  if (days === 1) {
    return t('time.yesterday');
  }

  if (days < 30) {
    return t('time.daysAgo', { count: days });
  }

  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'long',
  }).format(timestamp);
}

export function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(timestamp);
}

export function parseExcludePages(excludePages: string): string[] {
  return excludePages
    .split(',')
    .map((page) => page.trim().toLowerCase())
    .filter((page) => page.length > 0);
}
