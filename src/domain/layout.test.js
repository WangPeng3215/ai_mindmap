import { describe, expect, it } from 'vitest';
import { createDocumentFromTree } from './mindmap.js';
import { layoutDocument } from './layout.js';

describe('mind-map layout', () => {
  it('places root branches on both sides and descendants farther outward', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'a', text: 'A', children: [{ id: 'a1', text: 'A1' }] },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ],
    });

    const positions = layoutDocument(document);

    expect(positions.root).toEqual({ x: 0, y: 0 });
    expect(positions.a.x).toBeGreaterThan(0);
    expect(positions.b.x).toBeGreaterThan(0);
    expect(positions.c.x).toBeLessThan(0);
    expect(positions.d.x).toBeLessThan(0);
    expect(positions.a1.x).toBeGreaterThan(positions.a.x);
  });

  it('keeps manually positioned nodes unless a forced layout is requested', () => {
    const document = createDocumentFromTree({ id: 'root', text: '主题' });
    document.nodes.root.position = { x: 42, y: 86 };

    expect(layoutDocument(document).root).toEqual({ x: 42, y: 86 });
    expect(layoutDocument(document, { force: true }).root).toEqual({ x: 0, y: 0 });
  });
});
