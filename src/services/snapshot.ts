import type { SerializedBlock } from '../types';

function normalizeProperties(properties?: Record<string, unknown>): Record<string, unknown> {
  return properties && Object.keys(properties).length > 0 ? properties : {};
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    return a.every((value, index) => areValuesEqual(value, b[index]));
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).sort();
    const bKeys = Object.keys(bRecord).sort();

    if (!areValuesEqual(aKeys, bKeys)) {
      return false;
    }

    return aKeys.every((key) => areValuesEqual(aRecord[key], bRecord[key]));
  }

  return false;
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

    if (!areValuesEqual(normalizeProperties(aBlock.properties), normalizeProperties(bBlock.properties))) {
      return false;
    }

    if (!areSnapshotsEqual(aBlock.children ?? [], bBlock.children ?? [])) {
      return false;
    }
  }

  return true;
}
