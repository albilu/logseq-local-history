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

export async function revertToSnapshot(
  snapshot: PageSnapshot,
  maxVersions: number = 50
): Promise<void> {
  const existingBlocks = await logseq.Editor.getPageBlocksTree(snapshot.pageName);
  const currentBlocks = Array.isArray(existingBlocks) ? existingBlocks : [];

  if (currentBlocks.length > 0) {
    const page = await logseq.Editor.getPage(snapshot.pageName);

    await addSnapshot({
      id: crypto.randomUUID(),
      pageName: snapshot.pageName,
      pageUuid: typeof page?.uuid === 'string' ? page.uuid : snapshot.pageUuid,
      timestamp: Date.now(),
      blocks: serializeBlockTree(currentBlocks as Array<Record<string, unknown>>),
    }, maxVersions);
  }

  for (const block of currentBlocks) {
    await logseq.Editor.removeBlock(block.uuid);
  }

  if (snapshot.blocks.length === 0) {
    await logseq.UI.showMsg(
      `Reverted to version from ${new Date(snapshot.timestamp).toLocaleString()}`,
      'success'
    );
    return;
  }

  const [firstBlock, ...remainingBlocks] = snapshot.blocks;
  const insertedFirstBlock = await logseq.Editor.appendBlockInPage(snapshot.pageName, firstBlock.content, {
    properties: firstBlock.properties ?? {},
  });

  if (!insertedFirstBlock) {
    throw new Error(`Failed to restore first root block for page "${snapshot.pageName}"`);
  }

  if (firstBlock.children && firstBlock.children.length > 0) {
    await logseq.Editor.insertBatchBlock(insertedFirstBlock.uuid, toBatchBlocks(firstBlock.children), {
      sibling: false,
    });
  }

  if (remainingBlocks.length > 0) {
    await logseq.Editor.insertBatchBlock(insertedFirstBlock.uuid, toBatchBlocks(remainingBlocks), {
      sibling: true,
    });
  }

  await logseq.UI.showMsg(
    `Reverted to version from ${new Date(snapshot.timestamp).toLocaleString()}`,
    'success'
  );
}
