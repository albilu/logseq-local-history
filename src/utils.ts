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
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (days === 1) {
    return 'yesterday';
  }

  if (days < 30) {
    return `${days} days ago`;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
  }).format(timestamp);
}

export function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
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
