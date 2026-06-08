import type { PageSnapshot, SerializedBlock } from '../types';
import { addSnapshot } from './history-store';
import { serializeBlockTree } from './snapshot';

async function insertChildrenRecursively(parentUuid: string, children: SerializedBlock[]): Promise<void> {
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    const inserted = await logseq.Editor.insertBlock(parentUuid, child.content, {
      sibling: false,
      before: true,
      properties: child.properties ?? {},
    });

    if (!inserted) {
      throw new Error(`Failed to insert child block "${child.content.slice(0, 40)}"`);
    }

    if (child.children && child.children.length > 0) {
      await insertChildrenRecursively(inserted.uuid, child.children);
    }
  }
}

async function replacePageBlocks(pageName: string, blocks: SerializedBlock[]): Promise<void> {
  const page = await logseq.Editor.getPage(pageName);
  const pageIdentity = typeof page?.uuid === 'string' ? page.uuid : pageName;
  const existingBlocks = await logseq.Editor.getPageBlocksTree(pageName);
  const currentBlocks = Array.isArray(existingBlocks) ? existingBlocks : [];

  for (const block of currentBlocks) {
    await logseq.Editor.removeBlock(block.uuid);
  }

  if (blocks.length === 0) {
    return;
  }

  for (const rootBlock of blocks) {
    const inserted = await logseq.Editor.appendBlockInPage(pageIdentity, rootBlock.content, {
      properties: rootBlock.properties ?? {},
    });

    if (!inserted) {
      throw new Error(`Failed to restore root block for page "${pageName}"`);
    }

    if (rootBlock.children && rootBlock.children.length > 0) {
      await insertChildrenRecursively(inserted.uuid, rootBlock.children);
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
    console.error('[local-history] revert failed, restoring backup', error);
    await replacePageBlocks(snapshot.pageName, preRevertBlocks);
    throw error;
  }

  await logseq.UI.showMsg(
    `Reverted to version from ${new Date(snapshot.timestamp).toLocaleString()}`,
    'success'
  );
}
