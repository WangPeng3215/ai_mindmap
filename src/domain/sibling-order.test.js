import { describe, expect, it } from 'vitest';
import { applyOperations, createDocumentFromTree } from './mindmap.js';
import { layoutDocument, createSiblingReorderOperation } from './layout.js';

describe('drag-to-reorder siblings', () => {
  it('moves a sibling to the vertical slot where it was dropped', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [{
        id: 'parent',
        text: '父节点',
        children: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
        ],
      }],
    });
    const positions = layoutDocument(document, { force: true });

    const operation = createSiblingReorderOperation(
      document,
      'c',
      positions.a.y - 20,
      positions,
    );
    const reordered = applyOperations(document, [operation]);

    expect(reordered.nodes.parent.children).toEqual(['c', 'a', 'b']);
  });

  it('reorders root branches only inside their current side', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'right-a', text: '右 A' },
        { id: 'right-b', text: '右 B' },
        { id: 'left-a', text: '左 A' },
        { id: 'left-b', text: '左 B' },
      ],
    });
    const positions = layoutDocument(document, { force: true });

    const operation = createSiblingReorderOperation(
      document,
      'left-a',
      positions['left-b'].y + 20,
      positions,
    );
    const reordered = applyOperations(document, [operation]);

    expect(reordered.nodes.root.children).toEqual([
      'right-a',
      'right-b',
      'left-b',
      'left-a',
    ]);
  });
});
