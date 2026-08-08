import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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

function normalizeIncoming(value) {
  const payload = value?.document || value;
  if (isMindMapDocument(payload)) {
    const document = structuredClone(payload);
    document.updatedAt = new Date().toISOString();
    return document;
  }
  if (payload?.root) {
    return createDocumentFromTree(payload.root, {
      id: payload.id,
      title: payload.title,
    });
  }
  if (payload?.text) {
    return createDocumentFromTree(payload, { title: payload.text });
  }
  throw new Error('请提供规范化 document，或包含 root 的嵌套树');
}

export async function createStore(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const documentPath = join(dataDir, 'current-map.json');
  const requestsPath = join(dataDir, 'requests.json');
  let document = await readJson(
    documentPath,
    createDocumentFromTree(DEFAULT_TREE, { id: 'welcome-map', title: 'AI 思维导图工作台' }),
  );
  let requests = await readJson(requestsPath, []);

  async function replaceDocument(payload) {
    document = normalizeIncoming(payload);
    await writeJson(documentPath, document);
    return structuredClone(document);
  }

  async function applyDocumentOperations(operations) {
    document = applyOperations(document, operations);
    await writeJson(documentPath, document);
    return structuredClone(document);
  }

  async function createRequest(message) {
    if (typeof message !== 'string' || !message.trim()) throw new Error('请求内容不能为空');
    const now = new Date().toISOString();
    const request = {
      id: globalThis.crypto.randomUUID(),
      message: message.trim(),
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
    if (request.status === 'completed') throw new Error('请求已经完成');
    if (result.document) await replaceDocument(result.document);
    if (result.operations) await applyDocumentOperations(result.operations);
    request.status = 'completed';
    request.reply = typeof result.reply === 'string' ? result.reply.trim() : '';
    request.updatedAt = new Date().toISOString();
    await writeJson(requestsPath, requests);
    return { request: structuredClone(request), document: structuredClone(document) };
  }

  return {
    current: () => structuredClone(document),
    requests: (status) => structuredClone(status ? requests.filter((item) => item.status === status) : requests),
    replaceDocument,
    applyDocumentOperations,
    createRequest,
    completeRequest,
  };
}
