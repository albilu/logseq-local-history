import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockEditor, mockFileStorage, mockLogseq, resetMockLogseq } from '../__mocks__/logseq';

beforeEach(() => {
  resetMockLogseq();
});

describe('resetMockLogseq', () => {
  it('removes custom mock implementations', () => {
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-1' });

    resetMockLogseq();

    expect(mockEditor.getPage()).toBeUndefined();
  });

  it('restores file storage defaults after reset', async () => {
    await mockFileStorage.setItem('history/test.json', 'value');

    resetMockLogseq();

    await expect(mockFileStorage.hasItem('history/test.json')).resolves.toBe(false);
    await mockFileStorage.setItem('history/test.json', 'value');
    await expect(mockFileStorage.getItem('history/test.json')).resolves.toBe('value');
  });

  it('restores ready callback execution after reset', async () => {
    const callback = vi.fn();

    resetMockLogseq();
    await mockLogseq.ready(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
