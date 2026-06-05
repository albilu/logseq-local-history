import { describe, expect, it } from 'vitest';
import { formatAbsoluteTime, formatRelativeTime, parseExcludePages, sanitizePageName } from '../utils';

describe('sanitizePageName', () => {
  it('replaces slashes with underscores', () => {
    expect(sanitizePageName('path/to/page')).toBe('path_to_page');
  });

  it('replaces backslashes with underscores', () => {
    expect(sanitizePageName('path\\to\\page')).toBe('path_to_page');
  });

  it('replaces all special characters and collapses consecutive underscores', () => {
    expect(sanitizePageName('page:with*special?"chars<>|')).toBe('page_with_special_chars_');
  });

  it('collapses consecutive underscores', () => {
    expect(sanitizePageName('a//b\\\\c')).toBe('a_b_c');
  });

  it('lowercases the result', () => {
    expect(sanitizePageName('My Page Name')).toBe('my page name');
  });

  it('handles already clean names', () => {
    expect(sanitizePageName('simple-page')).toBe('simple-page');
  });

  it('handles empty string', () => {
    expect(sanitizePageName('')).toBe('');
  });
});

describe('parseExcludePages', () => {
  it('parses comma-separated page names', () => {
    expect(parseExcludePages('page1, page2, page3')).toEqual(['page1', 'page2', 'page3']);
  });

  it('trims whitespace and lowercases', () => {
    expect(parseExcludePages('  Page1 ,  PAGE2  ')).toEqual(['page1', 'page2']);
  });

  it('filters empty strings', () => {
    expect(parseExcludePages('page1,,page2,')).toEqual(['page1', 'page2']);
  });

  it('returns empty array for empty input', () => {
    expect(parseExcludePages('')).toEqual([]);
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for times less than 60 seconds ago', () => {
    const result = formatRelativeTime(Date.now() - 30_000);
    expect(result).toBe('just now');
  });

  it('returns minutes for times less than 60 minutes ago', () => {
    const result = formatRelativeTime(Date.now() - 5 * 60_000);
    expect(result).toBe('5 min ago');
  });

  it('returns hours for times less than 24 hours ago', () => {
    const result = formatRelativeTime(Date.now() - 3 * 3600_000);
    expect(result).toBe('3 hours ago');
  });

  it('returns "1 hour ago" singular', () => {
    const result = formatRelativeTime(Date.now() - 3600_000);
    expect(result).toBe('1 hour ago');
  });

  it('returns "yesterday" for times 24-48 hours ago', () => {
    const result = formatRelativeTime(Date.now() - 36 * 3600_000);
    expect(result).toBe('yesterday');
  });

  it('returns "N days ago" for times 2-30 days ago', () => {
    const result = formatRelativeTime(Date.now() - 5 * 86400_000);
    expect(result).toBe('5 days ago');
  });

  it('returns a deterministic long date for times 30 days or older', () => {
    const timestamp = new Date(2026, 3, 1, 9, 15, 0).getTime();
    const expected = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
    }).format(timestamp);

    expect(formatRelativeTime(timestamp)).toBe(expected);
  });
});

describe('formatAbsoluteTime', () => {
  it('formats timestamps as a long US date with short time for the tooltip', () => {
    const timestamp = new Date(2026, 5, 5, 16, 23, 0).getTime();
    const expected = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(timestamp);

    expect(formatAbsoluteTime(timestamp)).toBe(expected);
  });
});
