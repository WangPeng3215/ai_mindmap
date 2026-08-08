const CURRENT_VERSION = 1;

function makeId(prefix = 'node') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanTreeNode(node) {
  if (!node || typeof node !== 'object') throw new Error('节点必须是对象');
  if (typeof node.text !== 'string' || !node.text.trim()) throw new Error('节点内容不能为空');
  if (node.children !== undefined && !Array.isArray(node.children)) {
    throw new Error('children 必须是数组');
  }
}

export function createDocumentFromTree(tree, options = {}) {
  cleanTreeNode(tree);
  const nodes = {};

  function visit(input, parentId = null) {
    cleanTreeNode(input);
    const id = input.id || makeId(parentId ? 'node' : 'root');
    if (nodes[id]) throw new Error(`节点 ID 重复: ${id}`);
    const childIds = [];
    nodes[id] = {
      id,
      parentId,
      text: input.text.trim(),
      children: childIds,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.collapsed ? { collapsed: true } : {}),
      ...(input.color ? { color: input.color } : {}),
      ...(input.position ? { position: { ...input.position } } : {}),
      ...(input.side ? { side: input.side } : {}),
    };
    for (const child of input.children || []) {
      childIds.push(visit(child, id));
    }
    return id;
  }

  const rootId = visit(tree);
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    revision: Number.isInteger(options.revision) ? options.revision : 0,
    id: options.id || makeId('map'),
    title: options.title || tree.text.trim(),
    rootId,
    nodes,
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
    ...(options.layoutMode ? { layoutMode: options.layoutMode } : {}),
  };
}

export function documentToTree(document) {
  const result = validateDocument(document);
  if (!result.valid) throw new Error(result.errors.join('; '));

  function visit(id) {
    const node = document.nodes[id];
    const output = {
      id: node.id,
      text: node.text,
      ...(node.notes ? { notes: node.notes } : {}),
      ...(node.collapsed ? { collapsed: true } : {}),
      ...(node.color ? { color: node.color } : {}),
    ...(node.position ? { position: { ...node.position } } : {}),
      ...(node.side ? { side: node.side } : {}),
    };
    if (node.children.length) output.children = node.children.map(visit);
    return output;
  }

  return visit(document.rootId);
}

function descendantIds(document, id) {
  const found = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    found.push(current);
    stack.push(...document.nodes[current].children);
  }
  return found;
}

function assertNode(document, id, label = '节点') {
  if (!document.nodes[id]) throw new Error(`${label}不存在: ${id}`);
}

function addNode(document, operation) {
  assertNode(document, operation.parentId, '父节点');
  cleanTreeNode(operation.node);
  const id = operation.node.id || makeId('node');
  if (document.nodes[id]) throw new Error(`节点 ID 重复: ${id}`);
  document.nodes[id] = {
    id,
    parentId: operation.parentId,
    text: operation.node.text.trim(),
    children: [],
    ...(operation.node.notes ? { notes: operation.node.notes } : {}),
    ...(operation.node.color ? { color: operation.node.color } : {}),
    ...(operation.node.side ? { side: operation.node.side } : {}),
  };
  const siblings = document.nodes[operation.parentId].children;
  const index = Number.isInteger(operation.index)
    ? Math.max(0, Math.min(operation.index, siblings.length))
    : siblings.length;
  siblings.splice(index, 0, id);
}

function updateNode(document, operation) {
  assertNode(document, operation.id);
  if (!operation.patch || typeof operation.patch !== 'object') throw new Error('patch 必须是对象');
  const allowed = ['text', 'notes', 'collapsed', 'color', 'position', 'side'];
  const patch = Object.fromEntries(
    Object.entries(operation.patch).filter(([key]) => allowed.includes(key)),
  );
  if ('text' in patch) {
    if (typeof patch.text !== 'string' || !patch.text.trim()) throw new Error('节点内容不能为空');
    patch.text = patch.text.trim();
  }
  document.nodes[operation.id] = { ...document.nodes[operation.id], ...patch };
}

function deleteNode(document, operation) {
  assertNode(document, operation.id);
  if (operation.id === document.rootId) throw new Error('不能删除根节点');
  const node = document.nodes[operation.id];
  document.nodes[node.parentId].children = document.nodes[node.parentId].children.filter(
    (childId) => childId !== operation.id,
  );
  for (const id of descendantIds(document, operation.id)) delete document.nodes[id];
}

function moveNode(document, operation) {
  assertNode(document, operation.id);
  assertNode(document, operation.parentId, '父节点');
  if (operation.id === document.rootId) throw new Error('不能移动根节点');
  if (descendantIds(document, operation.id).includes(operation.parentId)) {
    throw new Error('不能移动到自己的后代节点');
  }

  const node = document.nodes[operation.id];
  const oldParent = document.nodes[node.parentId];
  oldParent.children = oldParent.children.filter((childId) => childId !== operation.id);
  const newSiblings = document.nodes[operation.parentId].children;
  const index = Number.isInteger(operation.index)
    ? Math.max(0, Math.min(operation.index, newSiblings.length))
    : newSiblings.length;
  newSiblings.splice(index, 0, operation.id);
  node.parentId = operation.parentId;
  if (operation.side) node.side = operation.side;
  for (const id of descendantIds(document, operation.id)) delete document.nodes[id].position;
}

export function applyOperations(document, operations) {
  const initial = validateDocument(document);
  if (!initial.valid) throw new Error(initial.errors.join('; '));
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('operations 必须是非空数组');
  }

  const next = structuredClone(document);
  for (const operation of operations) {
    switch (operation.type) {
      case 'add_node':
        addNode(next, operation);
        break;
      case 'update_node':
        updateNode(next, operation);
        break;
      case 'delete_node':
        deleteNode(next, operation);
        break;
      case 'move_node':
        moveNode(next, operation);
        break;
      default:
        throw new Error(`不支持的操作类型: ${operation.type}`);
    }
  }
  next.revision = (Number.isInteger(document.revision) ? document.revision : 0) + 1;
  next.updatedAt = new Date().toISOString();
  const result = validateDocument(next);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return next;
}

export function validateDocument(document) {
  const errors = [];
  if (!document || typeof document !== 'object') return { valid: false, errors: ['文档必须是对象'] };
  if (!document.nodes || typeof document.nodes !== 'object') return { valid: false, errors: ['nodes 必须是对象'] };
  if (!document.rootId || !document.nodes[document.rootId]) errors.push('根节点不存在');

  for (const [id, node] of Object.entries(document.nodes)) {
    if (node.id !== id) errors.push(`节点键与 ID 不一致: ${id}`);
    if (typeof node.text !== 'string' || !node.text.trim()) errors.push(`节点内容不能为空: ${id}`);
    if (!Array.isArray(node.children)) {
      errors.push(`children 必须是数组: ${id}`);
      continue;
    }
    if (new Set(node.children).size !== node.children.length) errors.push(`子节点重复: ${id}`);
    if (id === document.rootId && node.parentId !== null) errors.push('根节点 parentId 必须为 null');
    if (id !== document.rootId && !document.nodes[node.parentId]) {
      errors.push(`父节点不存在: ${id} -> ${node.parentId}`);
    }
    for (const childId of node.children) {
      const child = document.nodes[childId];
      if (!child) errors.push(`子节点不存在: ${id} -> ${childId}`);
      else if (child.parentId !== id) errors.push(`父子引用不一致: ${id} -> ${childId}`);
    }
  }

  if (document.rootId && document.nodes[document.rootId]) {
    const seen = new Set();
    const active = new Set();
    function walk(id) {
      if (active.has(id)) {
        errors.push(`检测到循环引用: ${id}`);
        return;
      }
      if (seen.has(id)) return;
      seen.add(id);
      active.add(id);
      for (const childId of document.nodes[id]?.children || []) {
        if (document.nodes[childId]) walk(childId);
      }
      active.delete(id);
    }
    walk(document.rootId);
    for (const id of Object.keys(document.nodes)) {
      if (!seen.has(id)) errors.push(`节点未连接到根节点: ${id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isMindMapDocument(value) {
  return validateDocument(value).valid;
}
