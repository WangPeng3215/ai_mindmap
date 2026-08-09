import { describe, expect, it } from 'vitest';
import {
  applyOperations,
  createDocumentFromTree,
  documentToTree,
  validateDocument,
} from './mindmap.js';

const sampleTree = {
  id: 'root',
  text: '新产品规划',
  children: [
    {
      id: 'users',
      text: '目标用户',
      children: [{ id: 'creators', text: '内容创作者' }],
    },
    { id: 'value', text: '核心价值' },
  ],
};

describe('mind-map document', () => {
  it('normalizes a nested tree and can restore the same hierarchy', () => {
    const document = createDocumentFromTree(sampleTree, { id: 'map-1', title: '产品脑图' });

    expect(document.rootId).toBe('root');
    expect(document.nodes.creators.parentId).toBe('users');
    expect(document.nodes.root.children).toEqual(['users', 'value']);
    expect(documentToTree(document)).toEqual(sampleTree);
  });

  it('rejects duplicate node ids in nested input', () => {
    const invalid = {
      id: 'root',
      text: '主题',
      children: [{ id: 'root', text: '重复' }],
    };

    expect(() => createDocumentFromTree(invalid)).toThrow('节点 ID 重复');
  });

  it('applies add, update, move and cascading delete operations immutably', () => {
    const original = createDocumentFromTree(sampleTree, { id: 'map-1' });
    const updated = applyOperations(original, [
      { type: 'add_node', parentId: 'value', node: { id: 'speed', text: '更快完成' } },
      { type: 'update_node', id: 'value', patch: { text: '价值主张' } },
      { type: 'move_node', id: 'creators', parentId: 'value', index: 0 },
      { type: 'delete_node', id: 'users' },
    ]);

    expect(original.nodes.value.text).toBe('核心价值');
    expect(updated.nodes.value.text).toBe('价值主张');
    expect(updated.nodes.value.children).toEqual(['creators', 'speed']);
    expect(updated.nodes.users).toBeUndefined();
    expect(updated.nodes.creators.parentId).toBe('value');
    expect(updated.revision).toBe(original.revision + 1);
  });

  it('prevents moving a node below its own descendant', () => {
    const document = createDocumentFromTree(sampleTree);

    expect(() =>
      applyOperations(document, [
        { type: 'move_node', id: 'users', parentId: 'creators' },
      ]),
    ).toThrow('不能移动到自己的后代节点');
  });

  it('reports broken parent and child references', () => {
    const document = createDocumentFromTree(sampleTree);
    const broken = structuredClone(document);
    broken.nodes.users.parentId = 'missing';

    expect(validateDocument(broken)).toEqual({
      valid: false,
      errors: expect.arrayContaining([expect.stringContaining('missing')]),
    });
  });

  it('restores a node to its default visual style', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [{ id: 'child', text: '子节点', color: '#ff0000', style: { width: 300, fill: '#000000' } }],
    });

    const reset = applyOperations(document, [{
      type: 'update_node',
      id: 'child',
      patch: { style: undefined, color: undefined },
    }]);

    expect(reset.nodes.child.style).toBeUndefined();
    expect(reset.nodes.child.color).toBeUndefined();
  });});

describe('mind-map relationship expressions', () => {
  it('creates and edits relationship lines between any two nodes', () => {
    const document = createDocumentFromTree(sampleTree);
    const added = applyOperations(document, [{
      type: 'add_relationship',
      relationship: {
        id: 'rel-1', sourceId: 'creators', targetId: 'value', label: '影响',
        color: '#d45a43', lineType: 'dashed', arrow: true,
      },
    }]);
    expect(added.relationships).toEqual([expect.objectContaining({ id: 'rel-1', label: '影响' })]);
    const updated = applyOperations(added, [{
      type: 'update_relationship', id: 'rel-1', patch: { label: '促进', lineType: 'solid' },
    }]);
    expect(updated.relationships[0]).toMatchObject({ label: '促进', lineType: 'solid' });
    const removed = applyOperations(updated, [{ type: 'delete_relationship', id: 'rel-1' }]);
    expect(removed.relationships).toEqual([]);
  });

  it('adds boundaries and summaries only for consecutive siblings', () => {
    const document = createDocumentFromTree({
      id: 'root', text: '主题', children: [
        { id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' },
      ],
    });
    const decorated = applyOperations(document, [
      { type: 'add_boundary', boundary: { id: 'box-1', nodeIds: ['a', 'b'], label: '第一组' } },
      { type: 'add_summary', summary: { id: 'sum-1', nodeIds: ['b', 'c'], text: '共同结果' } },
    ]);
    expect(decorated.boundaries[0]).toMatchObject({ id: 'box-1', nodeIds: ['a', 'b'] });
    expect(decorated.summaries[0]).toMatchObject({ id: 'sum-1', text: '共同结果' });
    expect(() => applyOperations(document, [
      { type: 'add_boundary', boundary: { nodeIds: ['a', 'c'] } },
    ])).toThrow('连续同级节点');
  });

  it('removes relationships and ranges that reference deleted nodes', () => {
    const document = createDocumentFromTree({
      id: 'root', text: '主题', children: [
        { id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' },
      ],
    });
    const decorated = applyOperations(document, [
      { type: 'add_relationship', relationship: { id: 'rel-1', sourceId: 'a', targetId: 'b' } },
      { type: 'add_boundary', boundary: { id: 'box-1', nodeIds: ['a', 'b'] } },
      { type: 'add_summary', summary: { id: 'sum-1', nodeIds: ['b', 'c'] } },
    ]);
    const next = applyOperations(decorated, [{ type: 'delete_node', id: 'b' }]);
    expect(next.relationships).toEqual([]);
    expect(next.boundaries).toEqual([]);
    expect(next.summaries).toEqual([]);
  });
});

describe('relationship expression reorder behavior', () => {
  it('keeps range expressions valid when sibling order changes', () => {
    const document = createDocumentFromTree({
      id: 'root', text: '主题', children: [
        { id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' },
      ],
    });
    const decorated = applyOperations(document, [
      { type: 'add_boundary', boundary: { id: 'box-1', nodeIds: ['a', 'b'] } },
      { type: 'add_summary', summary: { id: 'sum-1', nodeIds: ['a', 'b'] } },
    ]);

    const reordered = applyOperations(decorated, [
      { type: 'move_node', id: 'a', parentId: 'root', index: 2 },
    ]);

    expect(reordered.nodes.root.children).toEqual(['b', 'c', 'a']);
    expect(reordered.boundaries[0].nodeIds).toEqual(['b', 'c', 'a']);
    expect(reordered.summaries[0].nodeIds).toEqual(['b', 'c', 'a']);
  });
});
