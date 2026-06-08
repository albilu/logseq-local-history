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
  it('removes existing blocks and inserts snapshot blocks', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
      { uuid: 'cur-b2', content: 'Current 2', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBatchBlock
      .mockResolvedValueOnce([{ uuid: 'new-b2' }])
      .mockResolvedValueOnce([{ uuid: 'new-b3' }]);

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
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBatchBlock.mockResolvedValue([{ uuid: 'new-b2' }]);

    await revertToSnapshot(targetSnapshot);

    expect(mockFileStorage.setItem).toHaveBeenCalled();
  });

  it('backs up and restores the snapshot page even when another page is current', async () => {
    mockEditor.getCurrentPageBlocksTree.mockResolvedValue([
      { uuid: 'other-b1', content: 'Other page block', children: [] },
    ]);
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'target-b1', content: 'Target page block', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBatchBlock.mockResolvedValue([{ uuid: 'new-b2' }]);

    await revertToSnapshot(targetSnapshot);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('test page');
    expect(mockEditor.removeBlock).toHaveBeenCalledWith('target-b1');
    expect(mockEditor.removeBlock).not.toHaveBeenCalledWith('other-b1');

    const pageHistoryWrites = mockFileStorage.setItem.mock.calls
      .filter(([key]) => key.startsWith('history.') && key.endsWith('.json'));
      
    const snapshotWrites = pageHistoryWrites.filter(([key]) => (
      key !== 'history._index.json' && key !== 'history._files.json'
    ));
    expect(snapshotWrites).toHaveLength(1);

    const [latestWrite] = snapshotWrites;
    const [, latestSnapshotsJson] = latestWrite;
    expect(JSON.parse(latestSnapshotsJson as string)[0].blocks).toEqual([
      { uuid: 'target-b1', content: 'Target page block' },
    ]);
  });

  it('fails when the first block cannot be reinserted after deletion', async () => {
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'target-b1', content: 'Target page block', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue(null);

    await expect(revertToSnapshot(targetSnapshot)).rejects.toThrow(
      'Failed to restore first root block for page "test page"'
    );

    expect(mockUI.showMsg).not.toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });

  it('restores the backup blocks when batch insertion fails after the first append', async () => {
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
    mockEditor.insertBatchBlock
      .mockRejectedValueOnce(new Error('batch insert failed'))
      .mockResolvedValueOnce([{ uuid: 'restored-backup-child' }]);

    await expect(revertToSnapshot(targetSnapshot)).rejects.toThrow('batch insert failed');

    expect(mockEditor.appendBlockInPage).toHaveBeenNthCalledWith(
      1,
      'test page',
      'Old content',
      expect.any(Object)
    );
    expect(mockEditor.appendBlockInPage).toHaveBeenNthCalledWith(
      2,
      'test page',
      'Backup root',
      expect.any(Object)
    );
    expect(mockEditor.insertBatchBlock).toHaveBeenNthCalledWith(
      2,
      'restored-backup-root',
      [{ content: 'Backup child', properties: {}, children: [] }],
      { sibling: false }
    );
    expect(mockUI.showMsg).not.toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });

  it('treats an empty batch insert result as failure and restores the backup blocks', async () => {
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
    mockEditor.insertBatchBlock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ uuid: 'restored-backup-child' }]);

    await expect(revertToSnapshot(targetSnapshot)).rejects.toThrow(
      'Failed to restore child blocks for page "test page"'
    );

    expect(mockEditor.appendBlockInPage).toHaveBeenNthCalledWith(
      2,
      'test page',
      'Backup root',
      expect.any(Object)
    );
    expect(mockEditor.insertBatchBlock).toHaveBeenNthCalledWith(
      2,
      'restored-backup-root',
      [{ content: 'Backup child', properties: {}, children: [] }],
      { sibling: false }
    );
    expect(mockUI.showMsg).not.toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });

  it('treats an empty remaining-root insert result as failure and restores the backup blocks', async () => {
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
    mockEditor.insertBatchBlock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ uuid: 'restored-backup-child' }]);

    await expect(revertToSnapshot(multiRootSnapshot)).rejects.toThrow(
      'Failed to restore remaining root blocks for page "test page"'
    );

    expect(mockEditor.insertBatchBlock).toHaveBeenNthCalledWith(
      1,
      'new-target-root',
      [{ content: 'Root B', properties: {}, children: [] }],
      { sibling: true }
    );
    expect(mockEditor.appendBlockInPage).toHaveBeenNthCalledWith(
      2,
      'test page',
      'Backup root',
      expect.any(Object)
    );
    expect(mockEditor.insertBatchBlock).toHaveBeenNthCalledWith(
      2,
      'restored-backup-root',
      [{ content: 'Backup child', properties: {}, children: [] }],
      { sibling: false }
    );
    expect(mockUI.showMsg).not.toHaveBeenCalledWith(
      expect.stringContaining('Reverted'),
      'success'
    );
  });
});
