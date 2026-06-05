import { describe, expect, it } from 'vitest';
import type { SerializedBlock } from '../../types';
import {
  areSnapshotsEqual,
  deserializeToText,
  serializeBlockTree,
} from '../snapshot';

describe('serializeBlockTree', () => {
  it('serializes a flat list of blocks', () => {
    const blocks = [
      { uuid: 'a1', content: 'Hello', children: [] },
      { uuid: 'a2', content: 'World', children: [] },
    ];

    expect(serializeBlockTree(blocks)).toEqual([
      { uuid: 'a1', content: 'Hello' },
      { uuid: 'a2', content: 'World' },
    ]);
  });

  it('serializes nested blocks', () => {
    const blocks = [
      {
        uuid: 'a1',
        content: 'Parent',
        children: [
          { uuid: 'b1', content: 'Child 1', children: [] },
          { uuid: 'b2', content: 'Child 2', children: [] },
        ],
      },
    ];

    expect(serializeBlockTree(blocks)).toEqual([
      {
        uuid: 'a1',
        content: 'Parent',
        children: [
          { uuid: 'b1', content: 'Child 1' },
          { uuid: 'b2', content: 'Child 2' },
        ],
      },
    ]);
  });

  it('includes properties when present', () => {
    const blocks = [
      { uuid: 'a1', content: 'With props', properties: { key: 'value' }, children: [] },
    ];

    expect(serializeBlockTree(blocks)).toEqual([
      { uuid: 'a1', content: 'With props', properties: { key: 'value' } },
    ]);
  });

  it('omits empty properties', () => {
    const blocks = [
      { uuid: 'a1', content: 'No props', properties: {}, children: [] },
    ];

    expect(serializeBlockTree(blocks)).toEqual([{ uuid: 'a1', content: 'No props' }]);
  });

  it('handles missing content gracefully', () => {
    const blocks = [{ uuid: 'a1', children: [] }];

    expect(serializeBlockTree(blocks)).toEqual([{ uuid: 'a1', content: '' }]);
  });
});

describe('deserializeToText', () => {
  it('converts flat blocks to text', () => {
    const blocks: SerializedBlock[] = [
      { uuid: 'a1', content: 'Line 1' },
      { uuid: 'a2', content: 'Line 2' },
    ];

    expect(deserializeToText(blocks)).toBe('Line 1\nLine 2');
  });

  it('indents nested blocks', () => {
    const blocks: SerializedBlock[] = [
      {
        uuid: 'a1',
        content: 'Parent',
        children: [{ uuid: 'b1', content: 'Child' }],
      },
    ];

    expect(deserializeToText(blocks)).toBe('Parent\n  Child');
  });

  it('handles deeply nested blocks', () => {
    const blocks: SerializedBlock[] = [
      {
        uuid: 'a1',
        content: 'Level 0',
        children: [
          {
            uuid: 'b1',
            content: 'Level 1',
            children: [{ uuid: 'c1', content: 'Level 2' }],
          },
        ],
      },
    ];

    expect(deserializeToText(blocks)).toBe('Level 0\n  Level 1\n    Level 2');
  });

  it('returns empty string for empty array', () => {
    expect(deserializeToText([])).toBe('');
  });
});

describe('areSnapshotsEqual', () => {
  it('returns true for identical block trees', () => {
    const a: SerializedBlock[] = [{ uuid: 'a1', content: 'Hello' }];
    const b: SerializedBlock[] = [{ uuid: 'a1', content: 'Hello' }];

    expect(areSnapshotsEqual(a, b)).toBe(true);
  });

  it('returns false for different content', () => {
    const a: SerializedBlock[] = [{ uuid: 'a1', content: 'Hello' }];
    const b: SerializedBlock[] = [{ uuid: 'a1', content: 'World' }];

    expect(areSnapshotsEqual(a, b)).toBe(false);
  });

  it('returns false for different uuids', () => {
    const a: SerializedBlock[] = [{ uuid: 'a1', content: 'Hello' }];
    const b: SerializedBlock[] = [{ uuid: 'a2', content: 'Hello' }];

    expect(areSnapshotsEqual(a, b)).toBe(false);
  });

  it('returns false for different lengths', () => {
    const a: SerializedBlock[] = [{ uuid: 'a1', content: 'Hello' }];
    const b: SerializedBlock[] = [
      { uuid: 'a1', content: 'Hello' },
      { uuid: 'a2', content: 'World' },
    ];

    expect(areSnapshotsEqual(a, b)).toBe(false);
  });

  it('compares children recursively', () => {
    const a: SerializedBlock[] = [
      { uuid: 'a1', content: 'Parent', children: [{ uuid: 'b1', content: 'Child' }] },
    ];
    const b: SerializedBlock[] = [
      { uuid: 'a1', content: 'Parent', children: [{ uuid: 'b1', content: 'Changed' }] },
    ];

    expect(areSnapshotsEqual(a, b)).toBe(false);
  });

  it('treats missing children as empty array', () => {
    const a: SerializedBlock[] = [{ uuid: 'a1', content: 'Hello' }];
    const b: SerializedBlock[] = [{ uuid: 'a1', content: 'Hello', children: [] }];

    expect(areSnapshotsEqual(a, b)).toBe(true);
  });

  it('compares properties', () => {
    const a: SerializedBlock[] = [{ uuid: 'a1', content: 'X', properties: { k: 'v1' } }];
    const b: SerializedBlock[] = [{ uuid: 'a1', content: 'X', properties: { k: 'v2' } }];

    expect(areSnapshotsEqual(a, b)).toBe(false);
  });

  it('treats missing properties as empty', () => {
    const a: SerializedBlock[] = [{ uuid: 'a1', content: 'X' }];
    const b: SerializedBlock[] = [{ uuid: 'a1', content: 'X', properties: {} }];

    expect(areSnapshotsEqual(a, b)).toBe(true);
  });

  it('treats nested properties with different key order as equal', () => {
    const a: SerializedBlock[] = [{
      uuid: 'a1',
      content: 'X',
      properties: {
        z: [{ b: 2, a: 1 }],
        nested: { d: 4, c: 3 },
      },
    }];
    const b: SerializedBlock[] = [{
      uuid: 'a1',
      content: 'X',
      properties: {
        nested: { c: 3, d: 4 },
        z: [{ a: 1, b: 2 }],
      },
    }];

    expect(areSnapshotsEqual(a, b)).toBe(true);
  });
});
