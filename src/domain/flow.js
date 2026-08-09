import { MarkerType } from '@xyflow/react';
import {
  getLayoutMode,
  getRootBranchSide,
  layoutDocument,
  LAYOUT_MODES,
} from './layout.js';
import { resolveBranchColor, resolveNodeStyle, resolveTheme } from './theme.js';

export function lockNodeChangesToLayout(changes, nodes, rootId, layout = LAYOUT_MODES.LEFT_RIGHT) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  return changes.map((change) => {
    if (change.type !== 'position' || !change.position || change.id === rootId) return change;
    const node = nodeMap.get(change.id);
    if (!node || node.data?.isRootChild) return change;
    if (layout === LAYOUT_MODES.TOP_BOTTOM || layout === LAYOUT_MODES.ARCHITECTURE) {
      return { ...change, position: { x: change.position.x, y: node.position.y } };
    }
    return { ...change, position: { x: node.position.x, y: change.position.y } };
  });
}

export function lockNodeChangesToColumns(changes, nodes, rootId) {
  return lockNodeChangesToLayout(changes, nodes, rootId, LAYOUT_MODES.LEFT_RIGHT);
}

function edgeHandles(mode, side) {
  if (mode === LAYOUT_MODES.TOP_BOTTOM) {
    return side === 'top'
      ? { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
      : { sourceHandle: 'source-bottom', targetHandle: 'target-top' };
  }
  if (mode === LAYOUT_MODES.ARCHITECTURE) {
    return { sourceHandle: 'source-bottom', targetHandle: 'target-top' };
  }
  return side === 'left'
    ? { sourceHandle: 'source-left', targetHandle: 'target-right' }
    : { sourceHandle: 'source-right', targetHandle: 'target-left' };
}

function relationshipHandles(source, target) {
  const dx = target.position.x - source.position.x;
  const dy = target.position.y - source.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : { sourceHandle: 'source-left', targetHandle: 'target-right' };
  }
  return dy >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' };
}

function expressionBounds(nodeIds, nodeById) {
  const items = nodeIds.map((id) => nodeById.get(id)).filter(Boolean);
  if (items.length !== nodeIds.length) return null;
  const minX = Math.min(...items.map((item) => item.position.x));
  const minY = Math.min(...items.map((item) => item.position.y));
  const maxX = Math.max(...items.map((item) => item.position.x + Number(item.style?.width || 148)));
  const maxY = Math.max(...items.map((item) => item.position.y + Number(item.style?.minHeight || 48)));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function createFlowModel(document) {
  const layout = getLayoutMode(document);
  const positions = layoutDocument(document, { force: true, layout });
  const visibleIds = [];
  const edgeStyle = document.edgeStyle || {};
  const theme = resolveTheme(document.theme);

  function visit(id) {
    visibleIds.push(id);
    const node = document.nodes[id];
    if (!node.collapsed) node.children.forEach(visit);
  }
  visit(document.rootId);

  const treeNodes = visibleIds.map((id) => {
    const mindNode = document.nodes[id];
    const position = positions[id];
    const nodeStyle = resolveNodeStyle(mindNode, theme, id === document.rootId);
    const side = id === document.rootId
      ? (layout === LAYOUT_MODES.TOP_BOTTOM ? 'bottom' : 'right')
      : (layout === LAYOUT_MODES.ARCHITECTURE ? 'bottom' : getRootBranchSide(document, id, layout));
    return {
      id,
      type: 'mindNode',
      position,
      style: { width: nodeStyle.width, minHeight: nodeStyle.height },
      draggable: id !== document.rootId,
      data: {
        mindNode,
        nodeStyle,
        isRoot: id === document.rootId,
        isRootChild: mindNode.parentId === document.rootId,
        side,
        layout,
      },
    };
  });

  const visible = new Set(visibleIds);
  const nodeById = new Map(treeNodes.map((node) => [node.id, node]));
  const decorationNodes = [];

  for (const boundary of document.boundaries || []) {
    const bounds = expressionBounds(boundary.nodeIds, nodeById);
    if (!bounds) continue;
    decorationNodes.push({
      id: `boundary:${boundary.id}`,
      type: 'boundaryNode',
      position: { x: bounds.minX - 18, y: bounds.minY - 14 },
      style: { width: bounds.width + 36, height: bounds.height + 28, zIndex: -1 },
      draggable: false,
      selectable: true,
      data: { kind: 'boundary', expressionId: boundary.id, boundary },
    });
  }

  for (const summary of document.summaries || []) {
    const bounds = expressionBounds(summary.nodeIds, nodeById);
    if (!bounds) continue;
    const rootNode = nodeById.get(document.rootId);
    const centerX = bounds.minX + bounds.width / 2;
    const rootCenterX = rootNode.position.x + Number(rootNode.style?.width || 148) / 2;
    const side = layout === LAYOUT_MODES.LEFT_RIGHT && centerX < rootCenterX ? 'left' : 'right';
    decorationNodes.push({
      id: `summary:${summary.id}`,
      type: 'summaryNode',
      position: {
        x: side === 'left' ? bounds.minX - 184 : bounds.maxX + 34,
        y: bounds.minY,
      },
      style: { width: 150, height: Math.max(48, bounds.height), zIndex: 1 },
      draggable: false,
      selectable: true,
      data: { kind: 'summary', expressionId: summary.id, summary, side },
    });
  }

  const nodes = [...decorationNodes, ...treeNodes];
  const edges = [];
  for (const id of visibleIds) {
    const node = document.nodes[id];
    if (!node.parentId || !visible.has(node.parentId)) continue;
    const side = layout === LAYOUT_MODES.ARCHITECTURE
      ? 'bottom'
      : getRootBranchSide(document, id, layout);
    const color = resolveBranchColor(document, id, theme);
    edges.push({
      id: `${node.parentId}:${id}`,
      source: node.parentId,
      target: id,
      ...edgeHandles(layout, side),
      type: edgeStyle.type === 'solid' ? 'straight' : 'smoothstep',
      animated: false,
      pathOptions: { borderRadius: 18, offset: 22 },
      style: { stroke: color, strokeWidth: edgeStyle.width || 1.8, strokeDasharray: edgeStyle.type === 'dashed' ? '6 4' : edgeStyle.type === 'dotted' ? '2 4' : undefined },
      ...(edgeStyle.arrow ? { markerEnd: { type: MarkerType.ArrowClosed, color } } : {}),
    });
  }

  for (const relationship of document.relationships || []) {
    if (!visible.has(relationship.sourceId) || !visible.has(relationship.targetId)) continue;
    const source = nodeById.get(relationship.sourceId);
    const target = nodeById.get(relationship.targetId);
    const color = relationship.color || '#ef654f';
    edges.push({
      id: `relationship:${relationship.id}`,
      source: relationship.sourceId,
      target: relationship.targetId,
      ...relationshipHandles(source, target),
      type: 'default',
      label: relationship.label || '',
      selectable: true,
      zIndex: 3,
      style: {
        stroke: color,
        strokeWidth: 1.8,
        strokeDasharray: relationship.lineType === 'dashed' ? '6 4' : relationship.lineType === 'dotted' ? '2 4' : undefined,
      },
      labelStyle: { fill: color, fontSize: 11, fontWeight: 650 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [5, 3],
      labelBgBorderRadius: 4,
      ...(relationship.arrow ? { markerEnd: { type: MarkerType.ArrowClosed, color } } : {}),
      data: { kind: 'relationship', expressionId: relationship.id, relationship },
    });
  }

  return { nodes, edges, theme };
}
