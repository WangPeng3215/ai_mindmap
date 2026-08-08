import { layoutDocument } from './layout.js';

export function lockNodeChangesToColumns(changes, nodes, rootId) {
  const columns = new Map(nodes.map((node) => [node.id, node.position.x]));
  return changes.map((change) => {
    if (change.type !== 'position' || !change.position || change.id === rootId) return change;
    return {
      ...change,
      position: { x: columns.get(change.id), y: change.position.y },
    };
  });
}

export function createFlowModel(document) {
  const positions = layoutDocument(document, { force: true });
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
    return {
      id,
      type: 'mindNode',
      position,
      draggable: id !== document.rootId,
      data: {
        mindNode,
        isRoot: id === document.rootId,
        side: position.x < positions[document.rootId].x ? 'left' : 'right',
      },
    };
  });

  const visible = new Set(visibleIds);
  const edges = [];
  for (const id of visibleIds) {
    const node = document.nodes[id];
    if (!node.parentId || !visible.has(node.parentId)) continue;
    const side = positions[id].x < positions[document.rootId].x ? 'left' : 'right';
    edges.push({
      id: `${node.parentId}:${id}`,
      source: node.parentId,
      target: id,
      sourceHandle: side === 'left' ? 'source-left' : 'source-right',
      targetHandle: side === 'left' ? 'target-right' : 'target-left',
      type: 'smoothstep',
      animated: false,
      pathOptions: { borderRadius: 18, offset: 22 },
      style: { stroke: node.color || '#a7a9a5', strokeWidth: 1.8 },
    });
  }

  return { nodes, edges };
}
