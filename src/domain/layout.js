const HORIZONTAL_GAP = 260;
const VERTICAL_GAP = 108;

export const LAYOUT_MODES = {
  LEFT_RIGHT: 'left-right',
  TOP_BOTTOM: 'top-bottom',
  ARCHITECTURE: 'architecture',
};

export function getLayoutMode(document, requested) {
  const mode = requested || document?.layoutMode;
  return Object.values(LAYOUT_MODES).includes(mode) ? mode : LAYOUT_MODES.LEFT_RIGHT;
}

function visibleLeafCount(document, id) {
  const node = document.nodes[id];
  if (node.collapsed || node.children.length === 0) return 1;
  return node.children.reduce((sum, childId) => sum + visibleLeafCount(document, childId), 0);
}

function canonicalSide(side, mode) {
  if (!side) return null;
  if (mode === LAYOUT_MODES.LEFT_RIGHT) {
    if (side === 'top') return 'left';
    if (side === 'bottom') return 'right';
    return side === 'left' || side === 'right' ? side : null;
  }
  if (mode === LAYOUT_MODES.TOP_BOTTOM) {
    if (side === 'left') return 'top';
    if (side === 'right') return 'bottom';
    return side === 'top' || side === 'bottom' ? side : null;
  }
  return null;
}

function defaultRootSide(document, id, mode) {
  const root = document.nodes[document.rootId];
  const index = root.children.indexOf(id);
  const firstCount = Math.ceil(root.children.length / 2);
  if (mode === LAYOUT_MODES.TOP_BOTTOM) return index < firstCount ? 'bottom' : 'top';
  return index < firstCount ? 'right' : 'left';
}

export function getRootBranchSide(document, id, mode = getLayoutMode(document)) {
  if (!document?.nodes[id] || id === document.rootId) return null;
  let current = document.nodes[id];
  while (current.parentId && current.parentId !== document.rootId) {
    current = document.nodes[current.parentId];
  }
  if (current.parentId !== document.rootId) return null;
  const resolved = canonicalSide(current.side, mode);
  return resolved || defaultRootSide(document, current.id, mode);
}

export function getDefaultRootBranchSide(document, mode = getLayoutMode(document)) {
  const root = document.nodes[document.rootId];
  const counts = root.children.reduce((result, id) => {
    const side = getRootBranchSide(document, id, mode);
    if (side) result[side] += 1;
    return result;
  }, mode === LAYOUT_MODES.TOP_BOTTOM ? { top: 0, bottom: 0 } : { left: 0, right: 0 });
  if (mode === LAYOUT_MODES.TOP_BOTTOM) return counts.top <= counts.bottom ? 'top' : 'bottom';
  return counts.left <= counts.right ? 'left' : 'right';
}

export function layoutDocument(document, options = {}) {
  const positions = {};
  const force = Boolean(options.force);
  const mode = getLayoutMode(document, options.layout);

  function remember(id, calculated) {
    positions[id] = !force && document.nodes[id].position
      ? { ...document.nodes[id].position }
      : calculated;
  }

  remember(document.rootId, { x: 0, y: 0 });
  const root = document.nodes[document.rootId];

  if (mode === LAYOUT_MODES.ARCHITECTURE) {
    const totalLeaves = root.children.reduce(
      (sum, id) => sum + visibleLeafCount(document, id),
      0,
    );
    let cursor = -((Math.max(totalLeaves, 1) - 1) * HORIZONTAL_GAP * 0.5);

    function layoutBranch(id, depth, startX) {
      const node = document.nodes[id];
      const leaves = visibleLeafCount(document, id);
      const width = leaves * HORIZONTAL_GAP;
      const centerX = startX + (width - HORIZONTAL_GAP) * 0.5;
      remember(id, { x: centerX, y: depth * VERTICAL_GAP });
      if (!node.collapsed) {
        let childCursor = startX;
        for (const childId of node.children) {
          layoutBranch(childId, depth + 1, childCursor);
          childCursor += visibleLeafCount(document, childId) * HORIZONTAL_GAP;
        }
      }
    }

    for (const id of root.children) {
      layoutBranch(id, 1, cursor);
      cursor += visibleLeafCount(document, id) * HORIZONTAL_GAP;
    }
    return positions;
  }

  const groups = mode === LAYOUT_MODES.TOP_BOTTOM
    ? { top: [], bottom: [] }
    : { left: [], right: [] };
  root.children.forEach((id) => groups[getRootBranchSide(document, id, mode)].push(id));

  function layoutGroup(branches, direction) {
    const totalLeaves = branches.reduce(
      (sum, id) => sum + visibleLeafCount(document, id),
      0,
    );
    let cursor = -((Math.max(totalLeaves, 1) - 1) * (mode === LAYOUT_MODES.TOP_BOTTOM ? HORIZONTAL_GAP : VERTICAL_GAP) * 0.5);

    function layoutBranch(id, depth, start) {
      const node = document.nodes[id];
      const leaves = visibleLeafCount(document, id);
      const gap = mode === LAYOUT_MODES.TOP_BOTTOM ? HORIZONTAL_GAP : VERTICAL_GAP;
      const span = leaves * gap;
      const center = start + (span - gap) * 0.5;
      const calculated = mode === LAYOUT_MODES.TOP_BOTTOM
        ? { x: center, y: direction * depth * VERTICAL_GAP }
        : { x: direction * depth * HORIZONTAL_GAP, y: center };
      remember(id, calculated);
      if (!node.collapsed) {
        let childCursor = start;
        for (const childId of node.children) {
          layoutBranch(childId, depth + 1, childCursor);
          childCursor += visibleLeafCount(document, childId) * gap;
        }
      }
    }

    for (const id of branches) {
      layoutBranch(id, 1, cursor);
      cursor += visibleLeafCount(document, id) * (mode === LAYOUT_MODES.TOP_BOTTOM ? HORIZONTAL_GAP : VERTICAL_GAP);
    }
  }

  if (mode === LAYOUT_MODES.TOP_BOTTOM) {
    layoutGroup(groups.bottom, 1);
    layoutGroup(groups.top, -1);
  } else {
    layoutGroup(groups.right, 1);
    layoutGroup(groups.left, -1);
  }
  return positions;
}

function axisFor(mode, position) {
  if (typeof position === 'number') return position;
  return mode === LAYOUT_MODES.LEFT_RIGHT ? position?.y : position?.x;
}

function sideForDrop(mode, position, rootPosition) {
  if (!position || typeof position === 'number' || mode === LAYOUT_MODES.ARCHITECTURE) return null;
  if (mode === LAYOUT_MODES.TOP_BOTTOM) return position.y < rootPosition.y ? 'top' : 'bottom';
  return position.x < rootPosition.x ? 'left' : 'right';
}

export function createSiblingReorderOperation(document, id, dropPosition, providedPositions, options = {}) {
  const node = document.nodes[id];
  if (!node || id === document.rootId) throw new Error('Root node cannot be reordered');
  const mode = getLayoutMode(document, options.layout);
  const parent = document.nodes[node.parentId];
  const positions = providedPositions || layoutDocument(document, { force: true, layout: mode });
  const root = document.nodes[document.rootId];
  const isRootBranch = parent.id === document.rootId;
  const currentSide = isRootBranch ? getRootBranchSide(document, id, mode) : null;
  const targetSide = isRootBranch
    ? (sideForDrop(mode, dropPosition, positions[document.rootId]) || currentSide)
    : null;
  const siblings = parent.children.filter((childId) => childId !== id);
  const group = isRootBranch
    ? siblings.filter((childId) => getRootBranchSide(document, childId, mode) === targetSide)
    : siblings;
  const axis = axisFor(mode, dropPosition);
  let insertionIndex = group.findIndex((childId) => axis < axisFor(mode, positions[childId]));
  if (insertionIndex === -1) insertionIndex = group.length;
  group.splice(insertionIndex, 0, id);

  const desired = siblings.slice();
  if (isRootBranch) {
    if (targetSide !== currentSide) {
      const targetIds = siblings.filter((childId) => getRootBranchSide(document, childId, mode) === targetSide);
      const beforeId = group[insertionIndex + 1];
      let index = beforeId ? desired.indexOf(beforeId) : -1;
      if (index < 0 && targetIds.length) index = desired.indexOf(targetIds[targetIds.length - 1]) + 1;
      if (index < 0) index = targetSide === (mode === LAYOUT_MODES.TOP_BOTTOM ? 'top' : 'left') ? 0 : desired.length;
      desired.splice(index, 0, id);
    } else {
    const slots = parent.children
      .map((childId, index) => ({ childId, index }))
      .filter(({ childId }) => getRootBranchSide(document, childId, mode) === targetSide);
    const originalDesired = parent.children.slice();
    slots.forEach(({ index }, slotIndex) => { originalDesired[index] = group[slotIndex]; });
    desired.splice(0, desired.length, ...originalDesired.filter((childId) => childId !== id));
    if (!desired.includes(id)) desired.splice(Math.max(0, originalDesired.indexOf(id)), 0, id);
    if (!slots.length) {
      const index = targetSide === (mode === LAYOUT_MODES.TOP_BOTTOM ? 'top' : 'left') ? 0 : desired.length;
      desired.splice(index, 0, id);
    }
    }
  } else {
    desired.splice(insertionIndex, 0, id);
  }

  const operation = {
    type: 'move_node',
    id,
    parentId: parent.id,
    index: Math.max(0, desired.indexOf(id)),
  };
  if (isRootBranch && targetSide && targetSide !== currentSide) {
    operation.side = targetSide;
  }
  return operation;
}
