import type { SerializedBlock } from '../types';

function normalizeProperties(properties?: Record<string, unknown>): Record<string, unknown> {
  return properties && Object.keys(properties).length > 0 ? properties : {};
}

export function serializeBlockTree(blocks: Array<Record<string, unknown>>): SerializedBlock[] {
  return blocks.map((block) => {
    const serialized: SerializedBlock = {
      uuid: String(block.uuid ?? ''),
      content: typeof block.content === 'string' ? block.content : '',
    };

    const properties = normalizeProperties(block.properties as Record<string, unknown> | undefined);
    if (Object.keys(properties).length > 0) {
      serialized.properties = { ...properties };
    }

    const children = Array.isArray(block.children) ? block.children : [];
    if (children.length > 0) {
      serialized.children = serializeBlockTree(children as Array<Record<string, unknown>>);
    }

    return serialized;
  });
}

export function deserializeToText(blocks: SerializedBlock[], indent: number = 0): string {
  const lines: string[] = [];

  for (const block of blocks) {
    lines.push(`${'  '.repeat(indent)}${block.content}`);

    if (block.children && block.children.length > 0) {
      lines.push(deserializeToText(block.children, indent + 1));
    }
  }

  return lines.join('\n');
}

export function areSnapshotsEqual(a: SerializedBlock[], b: SerializedBlock[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const aBlock = a[index];
    const bBlock = b[index];

    if (aBlock.uuid !== bBlock.uuid || aBlock.content !== bBlock.content) {
      return false;
    }

    if (
      JSON.stringify(normalizeProperties(aBlock.properties)) !==
      JSON.stringify(normalizeProperties(bBlock.properties))
    ) {
      return false;
    }

    if (!areSnapshotsEqual(aBlock.children ?? [], bBlock.children ?? [])) {
      return false;
    }
  }

  return true;
}
