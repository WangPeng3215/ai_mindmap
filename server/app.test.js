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
  it('accepts a nested tree and increments the document revision', async () => {
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
    expect(applied.body.document.revision).toBe(1);
    expect(Object.keys(applied.body.document.nodes)).toHaveLength(2);
  });

  it('applies incremental operations transactionally', async () => {
    const baseUrl = await startApi();
    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    const rootId = current.body.document.rootId;

    const updated = await json(baseUrl, '/api/v1/mindmaps/operations', {
      method: 'POST',
      body: JSON.stringify({
        operations: [{ type: 'add_node', parentId: rootId, node: { id: 'new-node', text: '新分支' } }],
      }),
    });
    expect(updated.response.status).toBe(200);
    expect(updated.body.document.nodes['new-node'].parentId).toBe(rootId);

    const invalid = await json(baseUrl, '/api/v1/mindmaps/operations', {
      method: 'POST',
      body: JSON.stringify({ operations: [{ type: 'delete_node', id: rootId }] }),
    });
    expect(invalid.response.status).toBe(400);
    const unchanged = await json(baseUrl, '/api/v1/mindmaps/current');
    expect(unchanged.body.document.nodes['new-node']).toBeDefined();
  });

  it('stages an AI proposal for review before applying it', async () => {
    const baseUrl = await startApi();
    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    const rootId = current.body.document.rootId;
    const queued = await json(baseUrl, '/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify({ message: '补充发布阶段', scope: 'map' }),
    });

    const reviewed = await json(baseUrl, `/api/v1/requests/${queued.body.request.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        reply: '建议新增发布阶段',
        operations: [{ type: 'add_node', parentId: rootId, node: { id: 'launch', text: '发布阶段' } }],
      }),
    });
    expect(reviewed.response.status).toBe(200);
    expect(reviewed.body.request.status).toBe('review');
    expect(reviewed.body.previewDocument.nodes.launch).toBeDefined();
    expect(reviewed.body.document.nodes.launch).toBeUndefined();

    const applied = await json(baseUrl, `/api/v1/requests/${queued.body.request.id}/apply`, { method: 'POST' });
    expect(applied.response.status).toBe(200);
    expect(applied.body.request.status).toBe('completed');
    expect(applied.body.document.nodes.launch.text).toBe('发布阶段');
  });

  it('limits branch proposals to the selected subtree', async () => {
    const baseUrl = await startApi();
    const queued = await json(baseUrl, '/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify({ message: '扩展目标分支', scope: 'branch', targetNodeId: 'clarify' }),
    });
    const invalid = await json(baseUrl, `/api/v1/requests/${queued.body.request.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        operations: [{ type: 'update_node', id: 'structure', patch: { text: '越界修改' } }],
      }),
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.body.error).toContain('分支之外');
  });

  it('rejects stale AI results after a manual edit', async () => {
    const baseUrl = await startApi();
    const queued = await json(baseUrl, '/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify({ message: '分析现有脑图' }),
    });
    await json(baseUrl, '/api/v1/mindmaps/operations', {
      method: 'POST',
      body: JSON.stringify({ operations: [{ type: 'update_node', id: 'clarify', patch: { text: '人工修改' } }] }),
    });
    const stale = await json(baseUrl, `/api/v1/requests/${queued.body.request.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ operations: [{ type: 'update_node', id: 'clarify', patch: { text: 'AI 修改' } }] }),
    });
    expect(stale.response.status).toBe(400);
    expect(stale.body.error).toContain('人工修改');
  });

  it('accepts a Codex proposal without a pending web request', async () => {
    const baseUrl = await startApi();
    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    const rootId = current.body.document.rootId;
    const proposed = await json(baseUrl, '/api/v1/proposals', {
      method: 'POST',
      body: JSON.stringify({
        baseRevision: current.body.document.revision,
        scope: 'map',
        message: 'Generate the delivery plan',
        operations: [{ type: 'add_node', parentId: rootId, node: { id: 'delivery', text: 'Delivery' } }],
      }),
    });

    expect(proposed.response.status).toBe(201);
    expect(proposed.body.request.source).toBe('codex');
    expect(proposed.body.request.status).toBe('review');
    expect(proposed.body.previewDocument.nodes.delivery).toBeDefined();
    expect(proposed.body.document.nodes.delivery).toBeUndefined();
  });

  it('can safely apply a Codex proposal immediately', async () => {
    const baseUrl = await startApi();
    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    const applied = await json(baseUrl, '/api/v1/proposals', {
      method: 'POST',
      body: JSON.stringify({
        baseRevision: current.body.document.revision,
        mode: 'apply',
        operations: [{ type: 'update_node', id: 'clarify', patch: { text: 'Clarified requirements' } }],
      }),
    });

    expect(applied.response.status).toBe(200);
    expect(applied.body.request.status).toBe('completed');
    expect(applied.body.document.nodes.clarify.text).toBe('Clarified requirements');
  });

  it('returns the latest document when a Codex proposal is stale', async () => {
    const baseUrl = await startApi();
    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    await json(baseUrl, '/api/v1/mindmaps/operations', {
      method: 'POST',
      body: JSON.stringify({ operations: [{ type: 'update_node', id: 'clarify', patch: { text: 'Manual change' } }] }),
    });
    const stale = await json(baseUrl, '/api/v1/proposals', {
      method: 'POST',
      body: JSON.stringify({
        baseRevision: current.body.document.revision,
        operations: [{ type: 'update_node', id: 'clarify', patch: { text: 'Old AI change' } }],
      }),
    });

    expect(stale.response.status).toBe(409);
    expect(stale.body.code).toBe('REVISION_CONFLICT');
    expect(stale.body.currentRevision).toBe(current.body.document.revision + 1);
    expect(stale.body.document.nodes.clarify.text).toBe('Manual change');
  });

  it('applies only selected operations from a review proposal', async () => {
    const baseUrl = await startApi();
    const current = await json(baseUrl, '/api/v1/mindmaps/current');
    const proposed = await json(baseUrl, '/api/v1/proposals', {
      method: 'POST',
      body: JSON.stringify({
        baseRevision: current.body.document.revision,
        operations: [
          { type: 'update_node', id: 'clarify', patch: { text: 'Selected change' } },
          { type: 'update_node', id: 'structure', patch: { text: 'Skipped change' } },
        ],
      }),
    });
    const applied = await json(baseUrl, `/api/v1/requests/${proposed.body.request.id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ operationIndexes: [0] }),
    });

    expect(applied.response.status).toBe(200);
    expect(applied.body.document.nodes.clarify.text).toBe('Selected change');
    expect(applied.body.document.nodes.structure.text).not.toBe('Skipped change');
    expect(applied.body.request.appliedOperationIndexes).toEqual([0]);
    expect(applied.body.request.skippedOperationIndexes).toEqual([1]);
  });

  it('creates automatic snapshots and restores a historical version safely', async () => {
    const baseUrl = await startApi();
    const first = await json(baseUrl, '/api/v1/mindmaps/current', {
      method: 'PUT',
      body: JSON.stringify({ title: 'First version', root: { id: 'first-root', text: 'First version' } }),
    });
    await json(baseUrl, '/api/v1/mindmaps/current', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Second version', root: { id: 'second-root', text: 'Second version' } }),
    });

    const history = await json(baseUrl, '/api/v1/mindmaps/snapshots');
    expect(history.response.status).toBe(200);
    const firstSnapshot = history.body.snapshots.find((snapshot) => snapshot.revision === first.body.document.revision);
    expect(firstSnapshot.title).toBe('First version');
    expect(firstSnapshot.nodeCount).toBe(1);

    const restored = await json(baseUrl, `/api/v1/mindmaps/snapshots/${firstSnapshot.id}/restore`, { method: 'POST' });
    expect(restored.response.status).toBe(200);
    expect(restored.body.document.title).toBe('First version');
    expect(restored.body.document.revision).toBe(3);

    const afterRestore = await json(baseUrl, '/api/v1/mindmaps/snapshots');
    expect(afterRestore.body.snapshots.some((snapshot) => snapshot.title === 'Second version')).toBe(true);

    const revisionBeforeNoop = restored.body.document.revision;
    const countBeforeNoop = afterRestore.body.snapshots.length;
    const noOpRestore = await json(baseUrl, `/api/v1/mindmaps/snapshots/${firstSnapshot.id}/restore`, { method: 'POST' });
    expect(noOpRestore.response.status).toBe(200);
    expect(noOpRestore.body.unchanged).toBe(true);
    expect(noOpRestore.body.message).toContain('完全一致');
    expect(noOpRestore.body.document.revision).toBe(revisionBeforeNoop);
    const afterNoOpRestore = await json(baseUrl, '/api/v1/mindmaps/snapshots');
    expect(afterNoOpRestore.body.snapshots).toHaveLength(countBeforeNoop);
  });

  it('keeps only the five newest historical snapshots', async () => {
    const baseUrl = await startApi();
    for (let index = 1; index <= 7; index += 1) {
      const applied = await json(baseUrl, '/api/v1/mindmaps/current', {
        method: 'PUT',
        body: JSON.stringify({ title: `Version ${index}`, root: { id: 'root', text: `Version ${index}` } }),
      });
      expect(applied.response.status).toBe(200);
    }

    const history = await json(baseUrl, '/api/v1/mindmaps/snapshots');
    expect(history.response.status).toBe(200);
    expect(history.body.snapshots).toHaveLength(5);
    expect(history.body.snapshots.map((snapshot) => snapshot.revision).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6]);
  });
});
