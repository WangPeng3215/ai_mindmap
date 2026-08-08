import { describe, expect, it } from 'vitest';
import { createDocumentFromTree } from './mindmap.js';
import { createFlowModel } from './flow.js';

describe('aligned flow layout', () => {
  it('ignores arbitrary saved coordinates and keeps siblings aligned by depth', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [{
        id: 'parent',
        text: '父节点',
        children: [
          { id: 'first', text: '第一个' },
          { id: 'second', text: '第二个' },
        ],
      }],
    });
    document.nodes.first.position = { x: 980, y: 640 };
    document.nodes.second.position = { x: -420, y: -720 };

    const model = createFlowModel(document);
    const first = model.nodes.find((node) => node.id === 'first');
    const second = model.nodes.find((node) => node.id === 'second');
    const root = model.nodes.find((node) => node.id === 'root');

    expect(first.position.x).toBe(second.position.x);
    expect(first.position.y).toBeLessThan(second.position.y);
    expect(root.draggable).toBe(false);
  });
});
