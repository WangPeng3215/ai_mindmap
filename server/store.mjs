import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import {
  applyOperations,
  createDocumentFromTree,
  isMindMapDocument,
} from '../src/domain/mindmap.js';

const DEFAULT_TREE = {
  id: 'root',
  text: 'AI 思维导图工作台',
  children: [
    {
      id: 'clarify',
      text: '澄清需求',
      children: [
        { id: 'goal', text: '目标与结果' },
        { id: 'audience', text: '对象与场景' },
      ],
    },
    {
      id: 'structure',
      text: '组织结构',
      children: [
        { id: 'themes', text: '归纳主题' },
        { id: 'priorities', text: '确定优先级' },
      ],
    },
    {
      id: 'agent',
      text: '连接 AI 智能体',
      children: [
        { id: 'full-map', text: '推送完整脑图' },
        { id: 'operations', text: '发送增量修改' },
      ],
    },
    {
      id: 'edit',
      text: '自由编辑',
      children: [
        { id: 'drag', text: '拖拽与排版' },
        { id: 'export', text: '导入与导出' },
      ],
    },
  ],
};

const MAX_SNAPSHOTS = 5;

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

function currentRevision(document) {
  return Number.isInteger(document.revision) ? document.revision : 0;
}

function revisionConflict(document) {
  const error = new Error('思维导图已被修改，请读取最新版本后重新生成方案');
  error.code = 'REVISION_CONFLICT';
  error.status = 409;
  error.details = {
    currentRevision: currentRevision(document),
    document: structuredClone(document),
  };
  return error;
}

function assertBaseRevision(document, baseRevision) {
  if (!Number.isInteger(baseRevision)) {
    const error = new Error('baseRevision 必须是读取当前导图时获得的整数版本号');
    error.code = 'INVALID_BASE_REVISION';
    throw error;
  }
  if (baseRevision !== currentRevision(document)) throw revisionConflict(document);
}

function normalizeIncoming(value, revision = 0) {
  const payload = value?.document || value;
  if (isMindMapDocument(payload)) {
    const document = structuredClone(payload);
    document.revision = revision;
    document.updatedAt = new Date().toISOString();
    return document;
  }
  if (payload?.root) {
    return createDocumentFromTree(payload.root, {
      id: payload.id,
      title: payload.title,
      layoutMode: payload.layoutMode,
      revision,
    });
  }
  if (payload?.text) {
    return createDocumentFromTree(payload, { title: payload.text, revision });
  }
  throw new Error('请提供规范化 document，或者包含 root 的嵌套树');
}

function descendants(document, id) {
  const result = new Set();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    result.add(current);
    stack.push(...document.nodes[current].children);
  }
  return result;
}

function assertProposalScope(document, request, operations) {
  if (request.scope !== 'branch') return;
  const allowed = descendants(document, request.targetNodeId);
  for (const operation of operations) {
    if (operation.type === 'add_node') {
      if (!allowed.has(operation.parentId)) throw new Error('分支请求不能在选中分支之外新增节点');
      if (operation.node?.id) allowed.add(operation.node.id);
      continue;
    }
    if (!allowed.has(operation.id)) throw new Error('分支请求不能修改选中分支之外的节点');
    if (operation.type === 'move_node' && !allowed.has(operation.parentId)) {
      throw new Error('分支请求不能把节点移动到选中分支之外');
    }
  }
}

function proposalSummary(document, proposal) {
  if (proposal.document) {
    const payload = proposal.document?.document || proposal.document;
    function countTree(node) {
      if (!node) return 0;
      return 1 + (node.children || []).reduce((sum, child) => sum + countTree(child), 0);
    }
    const count = payload?.nodes
      ? Object.keys(payload.nodes).length
      : (payload?.root ? countTree(payload.root) : (payload?.text ? countTree(payload) : null));
    return {
      kind: 'document',
      label: '替换整张脑图',
      ...(count !== null ? { nodeCount: count } : {}),
    };
  }
  const counts = { add_node: 0, update_node: 0, move_node: 0, delete_node: 0 };
  const items = proposal.operations.slice(0, 20).map((operation) => {
    counts[operation.type] = (counts[operation.type] || 0) + 1;
    const current = document.nodes[operation.id];
    return {
      type: operation.type,
      id: operation.id || operation.node?.id || '',
      text: operation.node?.text || operation.patch?.text || current?.text || operation.id || '',
    };
  });
  return { kind: 'operations', counts, items, total: proposal.operations.length };
}

function selectProposalOperations(request, operationIndexes) {
  const operations = request.proposal.operations;
  if (operationIndexes === undefined) {
    return { operations, indexes: operations.map((_operation, index) => index) };
  }
  if (!Array.isArray(operationIndexes) || operationIndexes.length === 0) {
    throw new Error('请至少选择一项要应用的修改');
  }
  const unique = [...new Set(operationIndexes)];
  if (unique.some((index) => !Number.isInteger(index) || index < 0 || index >= operations.length)) {
    throw new Error('包含无效的修改项序号');
  }
  unique.sort((left, right) => left - right);
  return { operations: unique.map((index) => operations[index]), indexes: unique };
}

function prepareProposal(document, input, scope) {
  const hasDocument = Boolean(input?.document);
  const hasOperations = Array.isArray(input?.operations) && input.operations.length > 0;
  if (hasDocument === hasOperations) throw new Error('请仅提供 document 或 operations 中的一种修改方案');
  if (scope === 'branch' && hasDocument) throw new Error('分支修改必须使用增量 operations');

  const proposal = hasDocument
    ? { document: structuredClone(input.document) }
    : { operations: structuredClone(input.operations) };
  const scopeRequest = { scope, targetNodeId: input.targetNodeId };
  if (proposal.operations) {
    assertProposalScope(document, scopeRequest, proposal.operations);
    return { proposal, previewDocument: applyOperations(document, proposal.operations) };
  }
  return {
    proposal,
    previewDocument: normalizeIncoming(proposal.document, currentRevision(document) + 1),
  };
}

export async function createStore(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const documentPath = join(dataDir, 'current-map.json');
  const requestsPath = join(dataDir, 'requests.json');
  const snapshotsPath = join(dataDir, 'snapshots');
  await mkdir(snapshotsPath, { recursive: true });
  let document = await readJson(
    documentPath,
    createDocumentFromTree(DEFAULT_TREE, { id: 'welcome-map', title: 'AI 思维导图工作台' }),
  );
  if (!Number.isInteger(document.revision)) document.revision = 0;
  let requests = await readJson(requestsPath, []);

  async function createSnapshot(previous, metadata = {}) {
    const now = new Date().toISOString();
    const snapshot = {
      id: globalThis.crypto.randomUUID(),
      revision: currentRevision(previous),
      title: previous.title,
      createdAt: now,
      source: metadata.source || 'unknown',
      reason: metadata.reason || '导图更新前自动保存',
      document: structuredClone(previous),
    };
    await writeJson(join(snapshotsPath, `snapshot-${Date.now()}-${snapshot.id}.json`), snapshot);
    await pruneSnapshots();
    return snapshot;
  }

  async function pruneSnapshots() {
    const names = (await readdir(snapshotsPath))
      .filter((name) => name.startsWith('snapshot-') && name.endsWith('.json'));
    const snapshots = [];
    for (const name of names) {
      try {
        const snapshot = await readJson(join(snapshotsPath, name), null);
        if (snapshot?.id && snapshot.document) snapshots.push({ name, ...snapshot });
      } catch {
        // Ignore a partially written or manually damaged snapshot.
      }
    }
    snapshots.sort((left, right) => (
      (right.createdAt || '').localeCompare(left.createdAt || '')
      || right.revision - left.revision
      || right.name.localeCompare(left.name)
    ));
    for (const snapshot of snapshots.slice(MAX_SNAPSHOTS)) {
      try {
        await unlink(join(snapshotsPath, snapshot.name));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  async function persistDocument(next, metadata = {}) {
    const previous = document;
    if (previous && currentRevision(next) > currentRevision(previous)) {
      await createSnapshot(previous, metadata);
    }
    document = next;
    await writeJson(documentPath, document);
    return structuredClone(document);
  }

  async function listSnapshots() {
    const names = (await readdir(snapshotsPath)).filter((name) => name.startsWith('snapshot-') && name.endsWith('.json'));
    const snapshots = [];
    for (const name of names) {
      try {
        const snapshot = await readJson(join(snapshotsPath, name), null);
        if (!snapshot?.id || !snapshot.document) continue;
        snapshots.push({
          id: snapshot.id,
          revision: snapshot.revision,
          title: snapshot.title,
          createdAt: snapshot.createdAt,
          source: snapshot.source,
          reason: snapshot.reason,
          nodeCount: Object.keys(snapshot.document.nodes || {}).length,
        });
      } catch {
        // Ignore a partially written or manually removed snapshot.
      }
    }
    return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async function readSnapshot(id) {
    const names = (await readdir(snapshotsPath)).filter((name) => name.startsWith('snapshot-') && name.endsWith('.json'));
    for (const name of names) {
      const snapshot = await readJson(join(snapshotsPath, name), null);
      if (snapshot?.id === id) return snapshot;
    }
    throw new Error(`历史版本不存在: ${id}`);
  }

  async function restoreSnapshot(id) {
    const snapshot = await readSnapshot(id);
    const currentComparable = structuredClone(document);
    const snapshotComparable = structuredClone(snapshot.document);
    delete currentComparable.revision;
    delete currentComparable.updatedAt;
    delete snapshotComparable.revision;
    delete snapshotComparable.updatedAt;
    if (isDeepStrictEqual(currentComparable, snapshotComparable)) {
      return {
        unchanged: true,
        message: '历史版本内容与当前版本完全一致，无需恢复',
        snapshot: { id: snapshot.id, revision: snapshot.revision, title: snapshot.title },
        document: structuredClone(document),
      };
    }
    const restored = normalizeIncoming(snapshot.document, currentRevision(document) + 1);
    const next = await persistDocument(restored, {
      source: 'restore',
      reason: `从历史版本 ${snapshot.revision} 恢复`,
    });
    return { snapshot: { id: snapshot.id, revision: snapshot.revision, title: snapshot.title }, document: next };
  }

  await pruneSnapshots();

  async function replaceDocument(payload, metadata = {}) {
    return persistDocument(normalizeIncoming(payload, currentRevision(document) + 1), {
      source: metadata.source || 'manual',
      reason: metadata.reason || '手动替换导图',
    });
  }

  async function applyDocumentOperations(operations, metadata = {}) {
    return persistDocument(applyOperations(document, operations), {
      source: metadata.source || 'manual',
      reason: metadata.reason || '手动编辑导图',
    });
  }

  async function createRequest(payload) {
    const input = typeof payload === 'string' ? { message: payload } : payload || {};
    if (typeof input.message !== 'string' || !input.message.trim()) throw new Error('请求内容不能为空');
    const scope = input.scope === 'branch' ? 'branch' : 'map';
    if (scope === 'branch' && !document.nodes[input.targetNodeId]) throw new Error('请选择有效的分支节点');
    const now = new Date().toISOString();
    const request = {
      id: globalThis.crypto.randomUUID(),
      message: input.message.trim(),
      scope,
      ...(scope === 'branch' ? {
        targetNodeId: input.targetNodeId,
        targetNodeText: document.nodes[input.targetNodeId].text,
      } : {}),
      baseRevision: currentRevision(document),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    requests.unshift(request);
    await writeJson(requestsPath, requests);
    return structuredClone(request);
  }

  async function completeRequest(id, result) {
    const request = requests.find((item) => item.id === id);
    if (!request) throw new Error(`请求不存在: ${id}`);
    if (request.status !== 'pending') throw new Error('请求当前状态不能提交 AI 结果');
    const baseRevision = Number.isInteger(request.baseRevision)
      ? request.baseRevision
      : currentRevision(document);
    if (baseRevision !== currentRevision(document)) {
      throw new Error('脑图已被人工修改，请重新读取最新脑图后生成修改方案');
    }
    const hasDocument = Boolean(result?.document);
    const hasOperations = Array.isArray(result?.operations) && result.operations.length > 0;
    if (hasDocument === hasOperations) throw new Error('请仅提供 document 或 operations 中的一种修改方案');
    if (request.scope === 'branch' && hasDocument) throw new Error('分支请求必须使用增量 operations');

    const proposal = hasDocument
      ? { document: structuredClone(result.document) }
      : { operations: structuredClone(result.operations) };
    let previewDocument;
    if (proposal.operations) {
      assertProposalScope(document, request, proposal.operations);
      previewDocument = applyOperations(document, proposal.operations);
    } else {
      previewDocument = normalizeIncoming(proposal.document, currentRevision(document) + 1);
    }

    request.status = 'review';
    request.reply = typeof result.reply === 'string' ? result.reply.trim() : '';
    request.proposal = proposal;
    request.summary = proposalSummary(document, proposal);
    request.updatedAt = new Date().toISOString();
    await writeJson(requestsPath, requests);
    return {
      request: structuredClone(request),
      previewDocument: structuredClone(previewDocument),
      document: structuredClone(document),
    };
  }

  async function applyRequest(id, options = {}) {
    const request = requests.find((item) => item.id === id);
    if (!request) throw new Error(`请求不存在: ${id}`);
    if (request.status !== 'review' || !request.proposal) throw new Error('请求没有可应用的修改方案');
    if (request.baseRevision !== currentRevision(document)) {
      throw new Error('脑图已被人工修改，当前 AI 修改方案已过期');
    }

    let nextDocument;
    if (request.proposal.operations) {
      const selected = selectProposalOperations(request, options.operationIndexes);
      assertProposalScope(document, request, selected.operations);
      nextDocument = applyOperations(document, selected.operations);
      request.appliedOperationIndexes = selected.indexes;
      request.skippedOperationIndexes = request.proposal.operations
        .map((_operation, index) => index)
        .filter((index) => !selected.indexes.includes(index));
    } else {
      if (options.operationIndexes !== undefined) throw new Error('完整导图方案必须整体应用');
      nextDocument = normalizeIncoming(request.proposal.document, currentRevision(document) + 1);
    }
    document = await persistDocument(nextDocument, {
      source: request.source || 'agent',
      reason: options.operationIndexes ? '应用部分 AI 修改' : '应用 AI 修改',
    });
    request.status = 'completed';
    request.appliedAt = new Date().toISOString();
    request.updatedAt = request.appliedAt;
    await writeJson(requestsPath, requests);
    return { request: structuredClone(request), document: structuredClone(document) };
  }

  async function rejectRequest(id) {
    const request = requests.find((item) => item.id === id);
    if (!request) throw new Error(`请求不存在: ${id}`);
    if (!['pending', 'review'].includes(request.status)) throw new Error('请求当前状态不能拒绝');
    request.status = 'rejected';
    request.updatedAt = new Date().toISOString();
    await writeJson(requestsPath, requests);
    return structuredClone(request);
  }

  async function submitProposal(payload = {}) {
    const scope = payload.scope === 'branch' ? 'branch' : 'map';
    const mode = payload.mode === 'apply' ? 'apply' : 'review';
    assertBaseRevision(document, payload.baseRevision);
    if (scope === 'branch' && !document.nodes[payload.targetNodeId]) {
      throw new Error('请选择有效的分支节点');
    }

    const { proposal, previewDocument } = prepareProposal(document, payload, scope);
    const now = new Date().toISOString();
    const request = {
      id: globalThis.crypto.randomUUID(),
      source: 'codex',
      message: typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : 'Codex 提交的思维导图方案',
      scope,
      ...(scope === 'branch' ? {
        targetNodeId: payload.targetNodeId,
        targetNodeText: document.nodes[payload.targetNodeId].text,
      } : {}),
      baseRevision: payload.baseRevision,
      status: mode === 'apply' ? 'completed' : 'review',
      reply: typeof payload.reply === 'string' ? payload.reply.trim() : '',
      proposal,
      summary: proposalSummary(document, proposal),
      createdAt: now,
      updatedAt: now,
      ...(mode === 'apply' ? { appliedAt: now } : {}),
    };

    if (mode === 'apply') {
      document = await persistDocument(previewDocument, {
        source: 'codex',
        reason: '安全直写 Codex 方案',
      });
    }
    requests.unshift(request);
    await writeJson(requestsPath, requests);
    return {
      request: structuredClone(request),
      ...(mode === 'review' ? { previewDocument: structuredClone(previewDocument) } : {}),
      document: structuredClone(document),
    };
  }

  return {
    current: () => structuredClone(document),
    requests: (status) => structuredClone(status ? requests.filter((item) => item.status === status) : requests),
    replaceDocument,
    applyDocumentOperations,
    createRequest,
    completeRequest,
    applyRequest,
    rejectRequest,
    submitProposal,
    listSnapshots,
    restoreSnapshot,
  };
}
