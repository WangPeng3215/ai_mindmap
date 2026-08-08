import {
  applyOperations,
  createDocumentFromTree,
  isMindMapDocument,
} from './mindmap.js';

function normalizeProposalDocument(current, value) {
  const payload = value?.document || value;
  if (isMindMapDocument(payload)) {
    const document = structuredClone(payload);
    document.revision = current.revision + 1;
    return document;
  }
  if (payload?.root) {
    return createDocumentFromTree(payload.root, {
      id: payload.id,
      title: payload.title,
      layoutMode: payload.layoutMode,
      revision: current.revision + 1,
    });
  }
  if (payload?.text) {
    return createDocumentFromTree(payload, {
      title: payload.text,
      revision: current.revision + 1,
    });
  }
  throw new Error('完整导图方案格式无效');
}

function markChange(changes, id, type) {
  const priority = { updated: 1, moved: 2, added: 3 };
  if (!changes[id] || priority[type] > priority[changes[id]]) changes[id] = type;
}

export function createProposalPreview(current, request, operationIndexes) {
  if (!request?.proposal) throw new Error('请求没有可预览的修改方案');
  if (request.baseRevision !== current.revision) throw new Error('方案基于旧版本，请让 Codex 重新生成');

  if (request.proposal.document) {
    const document = normalizeProposalDocument(current, request.proposal.document);
    return {
      document,
      kind: 'document',
      changes: Object.fromEntries(Object.keys(document.nodes).map((id) => [id, 'preview'])),
      deletedIds: Object.keys(current.nodes).filter((id) => !document.nodes[id]),
    };
  }

  const allOperations = request.proposal.operations || [];
  const indexes = operationIndexes === undefined
    ? allOperations.map((_operation, index) => index)
    : [...new Set(operationIndexes)].sort((left, right) => left - right);
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= allOperations.length)) {
    throw new Error('包含无效的修改项序号');
  }
  const operations = indexes.map((index) => allOperations[index]);
  if (operations.length === 0) {
    return { document: structuredClone(current), kind: 'operations', changes: {}, deletedIds: [] };
  }

  const document = applyOperations(current, operations);
  const changes = {};
  for (const operation of operations) {
    if (operation.type === 'add_node') markChange(changes, operation.node.id, 'added');
    if (operation.type === 'update_node') markChange(changes, operation.id, 'updated');
    if (operation.type === 'move_node') markChange(changes, operation.id, 'moved');
  }
  return {
    document,
    kind: 'operations',
    changes,
    deletedIds: Object.keys(current.nodes).filter((id) => !document.nodes[id]),
  };
}
