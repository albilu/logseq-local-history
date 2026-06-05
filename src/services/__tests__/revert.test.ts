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
    mockEditor.getPageBlocksTree.mockResolvedValue([
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
    mockEditor.getPageBlocksTree.mockResolvedValue([
      { uuid: 'cur-b1', content: 'Current', children: [] },
    ]);
    mockEditor.getPage.mockResolvedValue({ uuid: 'page-uuid', name: 'test page' });
    mockEditor.removeBlock.mockResolvedValue(undefined);
    mockEditor.appendBlockInPage.mockResolvedValue({ uuid: 'new-b1' });
    mockEditor.insertBatchBlock.mockResolvedValue([]);

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
    mockEditor.insertBatchBlock.mockResolvedValue([]);

    await revertToSnapshot(targetSnapshot);

    expect(mockEditor.getPageBlocksTree).toHaveBeenCalledWith('test page');
    expect(mockEditor.removeBlock).toHaveBeenCalledWith('target-b1');
    expect(mockEditor.removeBlock).not.toHaveBeenCalledWith('other-b1');

    const pageHistoryWrites = mockFileStorage.setItem.mock.calls
      .filter(([key]) => key.startsWith('history/') && key.endsWith('.json'));
      
    const snapshotWrites = pageHistoryWrites.filter(([key]) => (
      key !== 'history/_index.json' && key !== 'history/_files.json'
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
});
