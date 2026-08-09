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

  it('supports top-bottom and architecture layouts', () => {
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

    const topBottom = layoutDocument(document, { force: true, layout: 'top-bottom' });
    expect(topBottom.a.y).toBeGreaterThan(0);
    expect(topBottom.c.y).toBeLessThan(0);
    expect(topBottom.a1.y).toBeGreaterThan(topBottom.a.y);

    const architecture = layoutDocument(document, { force: true, layout: 'architecture' });
    expect(architecture.a.y).toBe(108);
    expect(architecture.a1.y).toBe(216);
    expect(architecture.a.x).toBeLessThan(architecture.d.x);
  });

  it('uses an explicit branch side when a new node is added', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [{ id: 'left', text: '左侧', side: 'left' }],
    });
    const positions = layoutDocument(document, { force: true });
    expect(positions.left.x).toBeLessThan(0);
  });

  it('keeps custom-sized siblings from overlapping while preserving alignment', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'a', text: 'A', side: 'right', style: { width: 360, height: 160 }, children: [{ id: 'a1', text: 'A1', style: { width: 320, height: 80 } }] },
        { id: 'b', text: 'B', side: 'right', style: { width: 280, height: 140 } },
      ],
    });

    const positions = layoutDocument(document, { force: true });

    expect(positions.b.y - positions.a.y).toBeGreaterThanOrEqual(160);
    expect(positions.a1.x - positions.a.x).toBeGreaterThanOrEqual(360);
  });

  it('uses node widths to prevent overlap in top-bottom layouts', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'a', text: 'A', side: 'bottom', style: { width: 360, height: 80 } },
        { id: 'b', text: 'B', side: 'bottom', style: { width: 300, height: 80 } },
      ],
    });

    const positions = layoutDocument(document, { force: true, layout: 'top-bottom' });

    expect(positions.b.x - positions.a.x).toBeGreaterThanOrEqual(360);
    expect(positions.a.y).toBeGreaterThan(0);
  });});
