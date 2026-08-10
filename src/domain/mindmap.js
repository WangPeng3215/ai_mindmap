const CURRENT_VERSION = 1;

export const DEFAULT_NODE_STYLE = {
  shape: 'rounded', fill: '#ffffff', border: '#d9dad5', radius: 10,
  width: 148, height: 48, textColor: '#20221f', fontSize: 12.5,
  fontWeight: 620, fontStyle: 'normal', textDecoration: 'none', textAlign: 'center',
};
export const DEFAULT_EDGE_STYLE = { color: '#a7a9a5', width: 1.8, type: 'smoothstep', arrow: false };
function cleanStyle(value, defaults) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key in defaults));
}

export const DEFAULT_RELATIONSHIP_STYLE = {
  color: '#ef654f',
  lineType: 'dashed',
  arrow: true,
};

function ensureExpressionCollections(document) {
  if (!Array.isArray(document.relationships)) document.relationships = [];
  if (!Array.isArray(document.boundaries)) document.boundaries = [];
  if (!Array.isArray(document.summaries)) document.summaries = [];
  return document;
}

function assertExpression(document, collection, id, label) {
  const index = document[collection].findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`${label}不存在: ${id}`);
  return index;
}

function normalizeRangeNodeIds(document, nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length < 2) throw new Error('请选择至少两个连续同级节点');
  const unique = [...new Set(nodeIds)];
  if (unique.length !== nodeIds.length) throw new Error('请选择至少两个连续同级节点');
  unique.forEach((id) => assertNode(document, id));
  const parentId = document.nodes[unique[0]].parentId;
  if (!parentId || unique.some((id) => document.nodes[id].parentId !== parentId)) {
    throw new Error('请选择连续同级节点');
  }
  const siblings = document.nodes[parentId].children;
  const indexes = unique.map((id) => siblings.indexOf(id)).sort((a, b) => a - b);
  if (indexes.some((index, offset) => index !== indexes[0] + offset)) {
    throw new Error('请选择连续同级节点');
  }
  return siblings.slice(indexes[0], indexes[indexes.length - 1] + 1);
}

function cleanRelationship(document, input, current = {}) {
  if (!input || typeof input !== 'object') throw new Error('关系线必须是对象');
  const sourceId = input.sourceId ?? current.sourceId;
  const targetId = input.targetId ?? current.targetId;
  assertNode(document, sourceId, '起点');
  assertNode(document, targetId, '终点');
  if (sourceId === targetId) throw new Error('关系线起点和终点不能相同');
  const lineType = input.lineType ?? current.lineType ?? DEFAULT_RELATIONSHIP_STYLE.lineType;
  if (!['solid', 'dashed', 'dotted'].includes(lineType)) throw new Error('关系线类型无效');
  return {
    ...current,
    ...input,
    sourceId,
    targetId,
    label: String(input.label ?? current.label ?? '').trim(),
    color: input.color ?? current.color ?? DEFAULT_RELATIONSHIP_STYLE.color,
    lineType,
    arrow: Boolean(input.arrow ?? current.arrow ?? DEFAULT_RELATIONSHIP_STYLE.arrow),
  };
}

function cleanRangeExpression(document, input, current, kind) {
  if (!input || typeof input !== 'object') throw new Error(`${kind}必须是对象`);
  const nodeIds = normalizeRangeNodeIds(document, input.nodeIds ?? current?.nodeIds);
  const output = { ...current, ...input, nodeIds };
  if (kind === '概要') output.text = String(input.text ?? current?.text ?? '概要').trim() || '概要';
  else output.label = String(input.label ?? current?.label ?? '').trim();
  output.color = input.color ?? current?.color ?? (kind === '外框' ? '#8b96a0' : '#ef654f');
  return output;
}

function pruneExpressions(document) {
  const ids = new Set(Object.keys(document.nodes));
  document.relationships = document.relationships.filter((item) => ids.has(item.sourceId) && ids.has(item.targetId));
  document.boundaries = document.boundaries.filter((item) => item.nodeIds.every((id) => ids.has(id)));
  document.summaries = document.summaries.filter((item) => item.nodeIds.every((id) => ids.has(id)));
}

function reconcileRangeExpressions(document) {
  const repaired = repairDocumentExpressions(document);
  document.boundaries = repaired.boundaries;
  document.summaries = repaired.summaries;
}

export function repairDocumentExpressions(value) {
  const document = ensureExpressionCollections(structuredClone(value));
  document.relationships = document.relationships.filter((item) => (
    item?.id && document.nodes[item.sourceId] && document.nodes[item.targetId] && item.sourceId !== item.targetId
  ));

  for (const collection of ['boundaries', 'summaries']) {
    document[collection] = document[collection].flatMap((item) => {
      const ids = [...new Set(Array.isArray(item?.nodeIds) ? item.nodeIds : [])];
      if (!item?.id || ids.length < 2) return [];
      const nodes = ids.map((id) => document.nodes[id]);
      if (nodes.some((node) => !node?.parentId)) return [];
      const parentId = nodes[0].parentId;
      if (nodes.some((node) => node.parentId !== parentId)) return [];
      const siblings = document.nodes[parentId].children;
      const indexes = ids.map((id) => siblings.indexOf(id));
      if (indexes.some((index) => index < 0)) return [];
      const start = Math.min(...indexes);
      const end = Math.max(...indexes);
      return [{ ...item, nodeIds: siblings.slice(start, end + 1) }];
    });
  }
  return document;
}

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
      ...(cleanStyle(input.style, DEFAULT_NODE_STYLE) ? { style: cleanStyle(input.style, DEFAULT_NODE_STYLE) } : {}),
      ...(cleanStyle(input.edgeStyle, DEFAULT_EDGE_STYLE) ? { edgeStyle: cleanStyle(input.edgeStyle, DEFAULT_EDGE_STYLE) } : {}),
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
    relationships: [],
    boundaries: [],
    summaries: [],
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
    ...(options.layoutMode ? { layoutMode: options.layoutMode } : {}),
    ...(cleanStyle(options.edgeStyle, DEFAULT_EDGE_STYLE) ? { edgeStyle: cleanStyle(options.edgeStyle, DEFAULT_EDGE_STYLE) } : {}),
    ...(options.theme && typeof options.theme === 'object' ? { theme: structuredClone(options.theme) } : {}),
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
      ...(node.style ? { style: { ...node.style } } : {}),
      ...(node.edgeStyle ? { edgeStyle: { ...node.edgeStyle } } : {}),
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
    ...(cleanStyle(operation.node.style, DEFAULT_NODE_STYLE) ? { style: cleanStyle(operation.node.style, DEFAULT_NODE_STYLE) } : {}),
    ...(cleanStyle(operation.node.edgeStyle, DEFAULT_EDGE_STYLE) ? { edgeStyle: cleanStyle(operation.node.edgeStyle, DEFAULT_EDGE_STYLE) } : {}),
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
  const allowed = ['text', 'notes', 'collapsed', 'color', 'position', 'side', 'style', 'edgeStyle'];
  const patch = Object.fromEntries(
    Object.entries(operation.patch).filter(([key]) => allowed.includes(key)),
  );
  if ('text' in patch) {
    if (typeof patch.text !== 'string' || !patch.text.trim()) throw new Error('节点内容不能为空');
    patch.text = patch.text.trim();
  }
  if ('style' in patch) patch.style = cleanStyle(patch.style, DEFAULT_NODE_STYLE);
  if ('edgeStyle' in patch) patch.edgeStyle = cleanStyle(patch.edgeStyle, DEFAULT_EDGE_STYLE);
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
  pruneExpressions(document);
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
  reconcileRangeExpressions(document);
}

function addRelationship(document, operation) {
  const value = cleanRelationship(document, operation.relationship);
  const id = value.id || makeId('relationship');
  if (document.relationships.some((item) => item.id === id)) throw new Error(`关系线 ID 重复: ${id}`);
  document.relationships.push({ ...value, id });
}

function updateRelationship(document, operation) {
  const index = assertExpression(document, 'relationships', operation.id, '关系线');
  document.relationships[index] = cleanRelationship(document, operation.patch, document.relationships[index]);
}

function deleteRelationship(document, operation) {
  const index = assertExpression(document, 'relationships', operation.id, '关系线');
  document.relationships.splice(index, 1);
}

function addRangeExpression(document, operation, collection, field, kind, prefix) {
  const value = cleanRangeExpression(document, operation[field], null, kind);
  const id = value.id || makeId(prefix);
  if (document[collection].some((item) => item.id === id)) throw new Error(`${kind} ID 重复: ${id}`);
  document[collection].push({ ...value, id });
}

function updateRangeExpression(document, operation, collection, kind) {
  const index = assertExpression(document, collection, operation.id, kind);
  document[collection][index] = cleanRangeExpression(
    document,
    operation.patch,
    document[collection][index],
    kind,
  );
}

function deleteRangeExpression(document, operation, collection, kind) {
  const index = assertExpression(document, collection, operation.id, kind);
  document[collection].splice(index, 1);
}

export function applyOperations(document, operations) {
  const repaired = repairDocumentExpressions(document);
  const initial = validateDocument(repaired);
  if (!initial.valid) throw new Error(initial.errors.join('; '));
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('operations 必须是非空数组');
  }

  const next = ensureExpressionCollections(structuredClone(repaired));
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
      case 'add_relationship':
        addRelationship(next, operation);
        break;
      case 'update_relationship':
        updateRelationship(next, operation);
        break;
      case 'delete_relationship':
        deleteRelationship(next, operation);
        break;
      case 'add_boundary':
        addRangeExpression(next, operation, 'boundaries', 'boundary', '外框', 'boundary');
        break;
      case 'update_boundary':
        updateRangeExpression(next, operation, 'boundaries', '外框');
        break;
      case 'delete_boundary':
        deleteRangeExpression(next, operation, 'boundaries', '外框');
        break;
      case 'add_summary':
        addRangeExpression(next, operation, 'summaries', 'summary', '概要', 'summary');
        break;
      case 'update_summary':
        updateRangeExpression(next, operation, 'summaries', '概要');
        break;
      case 'delete_summary':
        deleteRangeExpression(next, operation, 'summaries', '概要');
        break;
      default:
        throw new Error(`不支持的操作类型: ${operation.type}`);
    }
  }
  next.revision = (Number.isInteger(repaired.revision) ? repaired.revision : 0) + 1;
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
  for (const collection of ['relationships', 'boundaries', 'summaries']) {
    if (document[collection] !== undefined && !Array.isArray(document[collection])) {
      errors.push(`${collection} 必须是数组`);
    }
  }

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

  for (const relationship of document.relationships || []) {
    if (!relationship?.id) errors.push('关系线 ID 不能为空');
    if (!document.nodes[relationship?.sourceId]) errors.push(`关系线起点不存在: ${relationship?.id}`);
    if (!document.nodes[relationship?.targetId]) errors.push(`关系线终点不存在: ${relationship?.id}`);
  }
  for (const [collection, label] of [['boundaries', '外框'], ['summaries', '概要']]) {
    for (const item of document[collection] || []) {
      if (!item?.id) errors.push(`${label} ID 不能为空`);
      try {
        normalizeRangeNodeIds(document, item?.nodeIds);
      } catch (cause) {
        errors.push(`${label}范围无效: ${item?.id || 'unknown'} - ${cause.message}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isMindMapDocument(value) {
  return validateDocument(value).valid;
}
