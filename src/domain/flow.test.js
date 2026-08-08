import { describe, expect, it } from 'vitest';
import { createDocumentFromTree } from './mindmap.js';
import { createFlowModel } from './flow.js';

describe('flow view model', () => {
  it('creates directional handles for branches on both sides', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'right', text: '右侧' },
        { id: 'left', text: '左侧' },
      ],
    });

    const model = createFlowModel(document);
    const rightEdge = model.edges.find((edge) => edge.target === 'right');
    const leftEdge = model.edges.find((edge) => edge.target === 'left');

    expect(rightEdge.sourceHandle).toBe('source-right');
    expect(rightEdge.targetHandle).toBe('target-left');
    expect(leftEdge.sourceHandle).toBe('source-left');
    expect(leftEdge.targetHandle).toBe('target-right');
  });

  it('omits descendants of a collapsed node', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [{ id: 'branch', text: '分支', children: [{ id: 'hidden', text: '隐藏' }] }],
    });
    document.nodes.branch.collapsed = true;

    const model = createFlowModel(document);

    expect(model.nodes.map((node) => node.id)).toEqual(['root', 'branch']);
    expect(model.edges).toHaveLength(1);
  });
});
