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

  it('applies the document edge style to every connection', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'a', text: 'A', edgeStyle: { color: '#ff0000' } },
        { id: 'b', text: 'B' },
      ],
    });
    document.edgeStyle = { color: '#2468ff', width: 3, type: 'dashed', arrow: true };

    const model = createFlowModel(document);

    expect(model.edges).toHaveLength(2);
    for (const edge of model.edges) {
      expect(edge.style.stroke).toBe('#2468ff');
      expect(edge.style.strokeWidth).toBe(3);
      expect(edge.style.strokeDasharray).toBe('6 4');
      expect(edge.markerEnd).toBeTruthy();
    }
  });

  it('resolves theme defaults while preserving node-level overrides', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'a', text: 'A', style: { fill: '#ffcc00' } },
        { id: 'b', text: 'B' },
      ],
    });
    document.theme = {
      background: '#f0f3f6',
      fontFamily: 'Arial, sans-serif',
      defaultNodeStyle: { fill: '#ffffff', textColor: '#112233', radius: 6 },
    };

    const model = createFlowModel(document);
    const a = model.nodes.find((node) => node.id === 'a');
    const b = model.nodes.find((node) => node.id === 'b');

    expect(model.theme.background).toBe('#f0f3f6');
    expect(a.data.nodeStyle.fill).toBe('#ffcc00');
    expect(a.data.nodeStyle.textColor).toBe('#112233');
    expect(b.data.nodeStyle.fill).toBe('#ffffff');
    expect(b.data.nodeStyle.fontFamily).toBe('Arial, sans-serif');
  });

  it('colors every edge in a root branch from the rainbow palette', () => {
    const document = createDocumentFromTree({
      id: 'root',
      text: '主题',
      children: [
        { id: 'a', text: 'A', children: [{ id: 'a1', text: 'A1' }] },
        { id: 'b', text: 'B' },
      ],
    });
    document.theme = {
      branchStrategy: 'rainbow',
      palette: ['#e5484d', '#2f7ed8'],
    };

    const model = createFlowModel(document);
    const edgeA = model.edges.find((edge) => edge.target === 'a');
    const edgeA1 = model.edges.find((edge) => edge.target === 'a1');
    const edgeB = model.edges.find((edge) => edge.target === 'b');

    expect(edgeA.style.stroke).toBe('#e5484d');
    expect(edgeA1.style.stroke).toBe('#e5484d');
    expect(edgeB.style.stroke).toBe('#2f7ed8');
  });});

describe('relationship expression flow model', () => {
  it('adds relationship edges and range decoration nodes', () => {
    const document = createDocumentFromTree({
      id: 'root', text: '主题', children: [
        { id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' },
      ],
    });
    document.relationships.push({ id: 'rel-1', sourceId: 'a', targetId: 'c', label: '关联', color: '#ef654f', lineType: 'dashed', arrow: true });
    document.boundaries.push({ id: 'box-1', nodeIds: ['a', 'b'], label: '外框' });
    document.summaries.push({ id: 'sum-1', nodeIds: ['b', 'c'], text: '概要' });
    const model = createFlowModel(document);
    const relationship = model.edges.find((edge) => edge.id === 'relationship:rel-1');
    expect(relationship).toMatchObject({ source: 'a', target: 'c', label: '关联' });
    expect(relationship.style.strokeDasharray).toBe('6 4');
    expect(model.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'boundary:box-1', type: 'boundaryNode' }),
      expect.objectContaining({ id: 'summary:sum-1', type: 'summaryNode' }),
    ]));
  });
});
