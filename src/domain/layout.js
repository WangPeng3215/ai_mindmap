import { resolveNodeStyle } from './theme.js';
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
  const root = document.nodes[document.rootId];
  const depthSizes = [];

  function nodeSize(id) {
    const node = document.nodes[id];
    const style = resolveNodeStyle(node, document.theme, id === document.rootId);
    return { width: Number(style.width), height: Number(style.height) };
  }

  function collectDepthSizes(id, depth) {
    const size = nodeSize(id);
    const current = depthSizes[depth] || { width: 0, height: 0 };
    depthSizes[depth] = {
      width: Math.max(current.width, size.width),
      height: Math.max(current.height, size.height),
    };
    const node = document.nodes[id];
    if (!node.collapsed) node.children.forEach((childId) => collectDepthSizes(childId, depth + 1));
  }
  collectDepthSizes(document.rootId, 0);

  function remember(id, calculated) {
    positions[id] = !force && document.nodes[id].position
      ? { ...document.nodes[id].position }
      : calculated;
  }

  function mainAxisPosition(depth, direction) {
    let position = 0;
    for (let level = 1; level <= depth; level += 1) {
      if (mode === LAYOUT_MODES.LEFT_RIGHT) {
        const reference = direction > 0 ? depthSizes[level - 1]?.width : depthSizes[level]?.width;
        position += Math.max(HORIZONTAL_GAP, (reference || 148) + 80);
      } else {
        const reference = direction > 0 ? depthSizes[level - 1]?.height : depthSizes[level]?.height;
        position += Math.max(VERTICAL_GAP, (reference || 48) + 40);
      }
    }
    return direction * position;
  }

  function subtreeSpan(id) {
    const node = document.nodes[id];
    const size = nodeSize(id);
    const crossSize = mode === LAYOUT_MODES.LEFT_RIGHT ? size.height : size.width;
    const minimum = Math.max(
      mode === LAYOUT_MODES.LEFT_RIGHT ? VERTICAL_GAP : HORIZONTAL_GAP,
      crossSize + 32,
    );
    if (node.collapsed || node.children.length === 0) return minimum;
    return Math.max(minimum, node.children.reduce((sum, childId) => sum + subtreeSpan(childId), 0));
  }

  function layoutBranch(id, depth, start, direction) {
    const node = document.nodes[id];
    const size = nodeSize(id);
    const span = subtreeSpan(id);
    const crossSize = mode === LAYOUT_MODES.LEFT_RIGHT ? size.height : size.width;
    const crossPosition = start + (span - crossSize) * 0.5;
    const mainPosition = mainAxisPosition(depth, direction);
    remember(id, mode === LAYOUT_MODES.LEFT_RIGHT
      ? { x: mainPosition, y: crossPosition }
      : { x: crossPosition, y: mainPosition });
    if (!node.collapsed) {
      let childCursor = start;
      for (const childId of node.children) {
        layoutBranch(childId, depth + 1, childCursor, direction);
        childCursor += subtreeSpan(childId);
      }
    }
  }

  remember(document.rootId, { x: 0, y: 0 });
  const rootCrossCenter = mode === LAYOUT_MODES.LEFT_RIGHT
    ? nodeSize(document.rootId).height * 0.5
    : nodeSize(document.rootId).width * 0.5;

  function layoutGroup(branches, direction) {
    const total = branches.reduce((sum, id) => sum + subtreeSpan(id), 0);
    let cursor = rootCrossCenter - total * 0.5;
    for (const id of branches) {
      layoutBranch(id, 1, cursor, direction);
      cursor += subtreeSpan(id);
    }
  }

  if (mode === LAYOUT_MODES.ARCHITECTURE) {
    layoutGroup(root.children, 1);
    return positions;
  }

  const groups = mode === LAYOUT_MODES.TOP_BOTTOM
    ? { top: [], bottom: [] }
    : { left: [], right: [] };
  root.children.forEach((id) => groups[getRootBranchSide(document, id, mode)].push(id));

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
