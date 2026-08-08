import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.mjs';

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function startApi() {
  const dataDir = await mkdtemp(join(tmpdir(), 'mindflow-test-'));
  const { app } = await createApp({ dataDir });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  cleanups.push(
    () => new Promise((resolve) => server.close(resolve)),
    () => rm(dataDir, { recursive: true, force: true }),
  );
  return baseUrl;
}

async function json(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await response.json();
  return { response, body };
}

describe('local agent API', () => {
  it('accepts a nested tree and exposes the normalized current document', async () => {
    const baseUrl = await startApi();
    const applied = await json(baseUrl, '/api/v1/mindmaps/current', {
      method: 'PUT',
      body: JSON.stringify({
        title: '营销计划',
        root: { text: '营销计划', children: [{ text: '内容策略' }] },
      }),
    });

    expect(applied.response.status).toBe(200);
    expect(applied.body.document.title).toBe('营销计划');
    expect(Object.keys(applied.body.document.nodes)).toHaveLength(2);

    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    expect(current.body.document.id).toBe(applied.body.document.id);
  });

  it('applies incremental operations and returns useful validation errors', async () => {
    const baseUrl = await startApi();
    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    const rootId = current.body.document.rootId;

    const updated = await json(baseUrl, '/api/v1/mindmaps/operations', {
      method: 'POST',
      body: JSON.stringify({
        operations: [
          { type: 'add_node', parentId: rootId, node: { id: 'new-node', text: '新分支' } },
        ],
      }),
    });
    expect(updated.response.status).toBe(200);
    expect(updated.body.document.nodes['new-node'].parentId).toBe(rootId);

    const invalid = await json(baseUrl, '/api/v1/mindmaps/operations', {
      method: 'POST',
      body: JSON.stringify({ operations: [{ type: 'delete_node', id: rootId }] }),
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.body.error).toContain('根节点');
  });

  it('queues UI requests and lets an external agent complete one with a new map', async () => {
    const baseUrl = await startApi();
    const queued = await json(baseUrl, '/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify({ message: '帮我规划一次产品发布' }),
    });
    expect(queued.response.status).toBe(201);
    expect(queued.body.request.status).toBe('pending');

    const pending = await json(baseUrl, '/api/v1/requests?status=pending');
    expect(pending.body.requests).toHaveLength(1);

    const completed = await json(baseUrl, `/api/v1/requests/${queued.body.request.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        reply: '已经整理成三个阶段。',
        document: {
          title: '产品发布',
          root: { text: '产品发布', children: [{ text: '预热' }, { text: '发布日' }, { text: '复盘' }] },
        },
      }),
    });
    expect(completed.response.status).toBe(200);
    expect(completed.body.request.status).toBe('completed');
    expect(completed.body.document.title).toBe('产品发布');
  });
});
