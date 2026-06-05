import { beforeEach, describe, expect, it } from 'vitest';
import {
  installMockLogseq,
  mockEditor,
  mockFileStorage,
  mockUI,
  resetMockLogseq,
} from '../../__mocks__/logseq';
import type { PageSnapshot } from '../../types';
import { revertToSnapshot } from '../revert';

beforeEach(() => {
  installMockLogseq();
  resetMockLogseq();
});

const targetSnapshot: PageSnapshot = {
  id: 'snap-1',
  pageName: 'test page',
  pageUuid: 'page-uuid',
  timestamp: 1000,
  blocks: [
    {
      uuid: 'old-b1',
      content: 'Old content',
      children: [{ uuid: 'old-b2', content: 'Old child' }],
    },
  ],
};

describe('revertToSnapshot', () => {
  it('removes existing blocks and inserts snapshot blocks', async () => {
    mockEditor.getCurrentPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
      { uuid: 'cur-b2', content: 'Current 2', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBatchBlock.mockResolvedValue([]);

    await revertToSnapshot(targetSnapshot);

    expect(mockEditor.removeBlock).toHaveBeenCalledWith('cur-b1');
    expect(mockEditor.removeBlock).toHaveBeenCalledWith('cur-b2');
    expect(mockEditor.appendBlockInPage).toHaveBeenCalledWith(
      'test page',
      'Old content',
      expect.any(Object)
    );
    expect(mockEditor.insertBatchBlock).toHaveBeenCalledWith(
      'new-b1',
      [{ content: 'Old child', properties: {}, children: [] }],
      { sibling: false }
    );
    expect(mockUI.showMsg).toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });

  it('creates a pre-revert snapshot for safety', async () => {
    mockEditor.getCurrentPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBatchBlock.mockResolvedValue([]);

    await revertToSnapshot(targetSnapshot);

    expect(mockFileStorage.setItem).toHaveBeenCalled();
  });
});
