const HORIZONTAL_GAP = 260;
const VERTICAL_GAP = 108;

function visibleLeafCount(document, id) {
  const node = document.nodes[id];
  if (node.collapsed || node.children.length === 0) return 1;
  return node.children.reduce((sum, childId) => sum + visibleLeafCount(document, childId), 0);
}

export function layoutDocument(document, options = {}) {
  const positions = {};
  const force = Boolean(options.force);

  function remember(id, calculated) {
    positions[id] = !force && document.nodes[id].position
      ? { ...document.nodes[id].position }
      : calculated;
  }

  remember(document.rootId, { x: 0, y: 0 });
  const root = document.nodes[document.rootId];
  const rightCount = Math.ceil(root.children.length / 2);
  const right = root.children.slice(0, rightCount);
  const left = root.children.slice(rightCount);

  function layoutSide(branches, direction) {
    const totalLeaves = branches.reduce(
      (sum, id) => sum + visibleLeafCount(document, id),
      0,
    );
    let cursor = -(Math.max(totalLeaves, 1) - 1) * VERTICAL_GAP * 0.5;

    function layoutBranch(id, depth, startY) {
      const node = document.nodes[id];
      const leaves = visibleLeafCount(document, id);
      const height = leaves * VERTICAL_GAP;
      const centerY = startY + (height - VERTICAL_GAP) * 0.5;
      remember(id, { x: direction * depth * HORIZONTAL_GAP, y: centerY });
      if (!node.collapsed) {
        let childCursor = startY;
        for (const childId of node.children) {
          layoutBranch(childId, depth + 1, childCursor);
          childCursor += visibleLeafCount(document, childId) * VERTICAL_GAP;
        }
      }
    }

    for (const id of branches) {
      layoutBranch(id, 1, cursor);
      cursor += visibleLeafCount(document, id) * VERTICAL_GAP;
    }
  }

  layoutSide(right, 1);
  layoutSide(left, -1);
  return positions;
}

export function createSiblingReorderOperation(document, id, dropY, providedPositions) {
  const node = document.nodes[id];
  if (!node || id === document.rootId) throw new Error('根节点不能排序');
  const parent = document.nodes[node.parentId];
  const positions = providedPositions || layoutDocument(document, { force: true });
  const rootX = positions[document.rootId].x;
  const draggedSide = positions[id].x < rootX ? 'left' : 'right';

  const groupSlots = parent.children
    .map((childId, index) => ({ childId, index }))
    .filter(({ childId }) => {
      if (parent.id !== document.rootId) return true;
      const side = positions[childId].x < rootX ? 'left' : 'right';
      return side === draggedSide;
    });
  const remaining = groupSlots
    .map(({ childId }) => childId)
    .filter((childId) => childId !== id);
  let insertionIndex = remaining.findIndex((childId) => dropY < positions[childId].y);
  if (insertionIndex === -1) insertionIndex = remaining.length;
  remaining.splice(insertionIndex, 0, id);

  const desired = [...parent.children];
  groupSlots.forEach(({ index }, groupIndex) => {
    desired[index] = remaining[groupIndex];
  });

  return {
    type: 'move_node',
    id,
    parentId: parent.id,
    index: desired.indexOf(id),
  };
}
