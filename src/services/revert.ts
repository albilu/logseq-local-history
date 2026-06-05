import type { IBatchBlock } from '@logseq/libs/dist/LSPlugin';
import type { PageSnapshot, SerializedBlock } from '../types';
import { addSnapshot } from './history-store';
import { serializeBlockTree } from './snapshot';

function toBatchBlocks(blocks: SerializedBlock[]): IBatchBlock[] {
  return blocks.map((block) => ({
    content: block.content,
    properties: block.properties ?? {},
    children: toBatchBlocks(block.children ?? []),
  }));
}

function hasInsertedBlocks(result: unknown): boolean {
  return Array.isArray(result) && result.length > 0;
}

async function replacePageBlocks(pageName: string, blocks: SerializedBlock[]): Promise<void> {
  const existingBlocks = await logseq.Editor.getPageBlocksTree(pageName);
  const currentBlocks = Array.isArray(existingBlocks) ? existingBlocks : [];

  for (const block of currentBlocks) {
    await logseq.Editor.removeBlock(block.uuid);
  }

  if (blocks.length === 0) {
    return;
  }

  const [firstBlock, ...remainingBlocks] = blocks;
  const insertedFirstBlock = await logseq.Editor.appendBlockInPage(pageName, firstBlock.content, {
    properties: firstBlock.properties ?? {},
  });

  if (!insertedFirstBlock) {
    throw new Error(`Failed to restore first root block for page "${pageName}"`);
  }

  if (firstBlock.children && firstBlock.children.length > 0) {
    const insertedChildren = await logseq.Editor.insertBatchBlock(insertedFirstBlock.uuid, toBatchBlocks(firstBlock.children), {
      sibling: false,
    });

    if (!hasInsertedBlocks(insertedChildren)) {
      throw new Error(`Failed to restore child blocks for page "${pageName}"`);
    }
  }

  if (remainingBlocks.length > 0) {
    const insertedRemainingBlocks = await logseq.Editor.insertBatchBlock(insertedFirstBlock.uuid, toBatchBlocks(remainingBlocks), {
      sibling: true,
    });

    if (!hasInsertedBlocks(insertedRemainingBlocks)) {
      throw new Error(`Failed to restore remaining root blocks for page "${pageName}"`);
    }
  }
}

export async function revertToSnapshot(
  snapshot: PageSnapshot,
  maxVersions: number = 50
): Promise<void> {
  const existingBlocks = await logseq.Editor.getPageBlocksTree(snapshot.pageName);
  const currentBlocks = Array.isArray(existingBlocks) ? existingBlocks : [];
  const preRevertBlocks = serializeBlockTree(currentBlocks as Array<Record<string, unknown>>);

  if (currentBlocks.length > 0) {
    const page = await logseq.Editor.getPage(snapshot.pageName);

    await addSnapshot({
      id: crypto.randomUUID(),
      pageName: snapshot.pageName,
      pageUuid: typeof page?.uuid === 'string' ? page.uuid : snapshot.pageUuid,
      timestamp: Date.now(),
      blocks: preRevertBlocks,
    }, maxVersions);
  }

  try {
    await replacePageBlocks(snapshot.pageName, snapshot.blocks);
  } catch (error) {
    await replacePageBlocks(snapshot.pageName, preRevertBlocks);
    throw error;
  }

  await logseq.UI.showMsg(
    `Reverted to version from ${new Date(snapshot.timestamp).toLocaleString()}`,
    'success'
  );
}
