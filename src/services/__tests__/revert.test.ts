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

const multiRootSnapshot: PageSnapshot = {
  id: 'snap-2',
  pageName: 'test page',
  pageUuid: 'page-uuid',
  timestamp: 2000,
  blocks: [
    {
      uuid: 'root-a',
      content: 'Root A',
    },
    {
      uuid: 'root-b',
      content: 'Root B',
    },
  ],
};

describe('revertToSnapshot', () => {
  it('removes existing blocks and inserts snapshot blocks using insertBlock for children', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
      { uuid: 'cur-b2', content: 'Current 2', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBlock.mockResolvedValue({ uuid: 'new-child-1' });

    await revertToSnapshot(targetSnapshot);

    expect(mockEditor.removeBlock).toHaveBeenCalledWith('cur-b1');
    expect(mockEditor.removeBlock).toHaveBeenCalledWith('cur-b2');
    expect(mockEditor.appendBlockInPage).toHaveBeenCalledWith(
      'page-uuid',
      'Old content',
      expect.any(Object)
    );
    expect(mockEditor.insertBlock).toHaveBeenCalledWith(
      'new-b1',
      'Old child',
      expect.objectContaining({ sibling: false })
    );
    expect(mockUI.showMsg).toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });

  it('creates a pre-revert snapshot for safety', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBlock.mockResolvedValue({ uuid: 'new-child-1' });

    await revertToSnapshot(targetSnapshot);

    expect(mockFileStorage.setItem).toHaveBeenCalled();
  });

  it('restores multiple root blocks by appending each one', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage
      .mockResolvedValueOnce({ uuid: 'new-root-a' })
      .mockResolvedValueOnce({ uuid: 'new-root-b' });

    await revertToSnapshot(multiRootSnapshot);

    expect(mockEditor.appendBlockInPage).toHaveBeenNthCalledWith(
      1,
      'page-uuid',
      'Root A',
      expect.any(Object)
    );
    expect(mockEditor.appendBlockInPage).toHaveBeenNthCalledWith(
      2,
      'page-uuid',
      'Root B',
      expect.any(Object)
    );
    expect(mockUI.showMsg).toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });

  it('uses the resolved page uuid for appendBlockInPage', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBlock.mockResolvedValue({ uuid: 'new-child-1' });

    await revertToSnapshot(targetSnapshot);

    expect(mockEditor.appendBlockInPage).toHaveBeenCalledWith(
      'page-uuid',
      'Old content',
      expect.any(Object)
    );
  });

  it('fails when the first block cannot be reinserted after deletion', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'target-b1', content: 'Target page block', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue(null);

    await expect(revertToSnapshot(targetSnapshot)).rejects.toThrow(
      'Failed to restore root block for page "test page"'
    );

    expect(mockUI.showMsg).not.toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });

  it('restores backup blocks when child insertion fails', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      {
        uuid: 'backup-b1',
        content: 'Backup root',
        children: [{ uuid: 'backup-b2', content: 'Backup child' }],
      },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage
      .mockResolvedValueOnce({ uuid: 'new-target-root' })
      .mockResolvedValueOnce({ uuid: 'restored-backup-root' });
    mockEditor.insertBlock
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValueOnce({ uuid: 'restored-backup-child' });

    await expect(revertToSnapshot(targetSnapshot)).rejects.toThrow('insert failed');

    expect(mockEditor.appendBlockInPage).toHaveBeenNthCalledWith(
      2,
      'page-uuid',
      'Backup root',
      expect.any(Object)
    );
    expect(mockUI.showMsg).not.toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });
});
