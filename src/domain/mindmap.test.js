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
});
