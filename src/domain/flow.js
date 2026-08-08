import {
  getLayoutMode,
  getRootBranchSide,
  layoutDocument,
  LAYOUT_MODES,
} from './layout.js';

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

export function createFlowModel(document) {
  const layout = getLayoutMode(document);
  const positions = layoutDocument(document, { force: true, layout });
  const visibleIds = [];

  function visit(id) {
    visibleIds.push(id);
    const node = document.nodes[id];
    if (!node.collapsed) node.children.forEach(visit);
  }
  visit(document.rootId);

  const nodes = visibleIds.map((id) => {
    const mindNode = document.nodes[id];
    const position = positions[id];
    const side = id === document.rootId
      ? (layout === LAYOUT_MODES.TOP_BOTTOM ? 'bottom' : 'right')
      : (layout === LAYOUT_MODES.ARCHITECTURE ? 'bottom' : getRootBranchSide(document, id, layout));
    return {
      id,
      type: 'mindNode',
      position,
      draggable: id !== document.rootId,
      data: {
        mindNode,
        isRoot: id === document.rootId,
        isRootChild: mindNode.parentId === document.rootId,
        side,
        layout,
      },
    };
  });

  const visible = new Set(visibleIds);
  const edges = [];
  for (const id of visibleIds) {
    const node = document.nodes[id];
    if (!node.parentId || !visible.has(node.parentId)) continue;
    const side = layout === LAYOUT_MODES.ARCHITECTURE
      ? 'bottom'
      : getRootBranchSide(document, id, layout);
    edges.push({
      id: `${node.parentId}:${id}`,
      source: node.parentId,
      target: id,
      ...edgeHandles(layout, side),
      type: 'smoothstep',
      animated: false,
      pathOptions: { borderRadius: 18, offset: 22 },
      style: { stroke: node.color || '#a7a9a5', strokeWidth: 1.8 },
    });
  }

  return { nodes, edges };
}
