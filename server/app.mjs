import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore } from './store.mjs';

function errorMessage(error) {
  return error instanceof Error ? error.message : '未知错误';
}

function sendError(response, error) {
  response.status(error?.status || 400).json({
    error: errorMessage(error),
    ...(error?.code ? { code: error.code } : {}),
    ...(error?.details || {}),
  });
}

export async function createApp(options = {}) {
  const dataDir = options.dataDir || resolve('data');
  const store = await createStore(dataDir);
  const clients = new Set();
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '2mb' }));

  function broadcast(type, data) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const response of clients) response.write(message);
  }

  app.get('/api/v1/health', (_request, response) => {
    response.json({ ok: true, service: 'mindflow-local' });
  });

  app.get('/api/v1/events', (request, response) => {
    response.setHeader('content-type', 'text/event-stream');
    response.setHeader('cache-control', 'no-cache');
    response.setHeader('connection', 'keep-alive');
    response.flushHeaders();
    response.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    clients.add(response);
    const heartbeat = setInterval(() => response.write(': ping\n\n'), 20000);
    request.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(response);
    });
  });

  app.get('/api/v1/mindmaps/current', (_request, response) => {
    response.json({ document: store.current() });
  });

  app.put('/api/v1/mindmaps/current', async (request, response) => {
    try {
      const document = await store.replaceDocument(request.body, { source: 'manual', reason: '网页编辑或导入' });
      broadcast('document_updated', {
        source: 'replace',
        clientId: request.get('x-mindflow-client') || null,
        document,
      });
      response.json({ document });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/v1/mindmaps/operations', async (request, response) => {
    try {
      const document = await store.applyDocumentOperations(request.body.operations, { source: 'manual', reason: '网页增量编辑' });
      broadcast('document_updated', {
        source: 'operations',
        clientId: request.get('x-mindflow-client') || null,
        document,
      });
      response.json({ document });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.get('/api/v1/requests', (request, response) => {
    response.json({ requests: store.requests(request.query.status) });
  });

  app.get('/api/v1/mindmaps/snapshots', async (_request, response) => {
    try {
      response.json({ snapshots: await store.listSnapshots() });
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post('/api/v1/mindmaps/snapshots/:id/restore', async (request, response) => {
    try {
      const result = await store.restoreSnapshot(request.params.id);
      broadcast('document_updated', {
        source: 'restore',
        clientId: request.get('x-mindflow-client') || null,
        document: result.document,
      });
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post('/api/v1/requests', async (request, response) => {
    try {
      const queued = await store.createRequest(request.body);
      broadcast('request_created', { request: queued });
      response.status(201).json({ request: queued });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/v1/requests/:id/complete', async (request, response) => {
    try {
      const result = await store.completeRequest(request.params.id, request.body);
      broadcast('request_updated', { request: result.request });
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/v1/requests/:id/apply', async (request, response) => {
    try {
      const result = await store.applyRequest(request.params.id, request.body || {});
      broadcast('request_completed', result);
      broadcast('document_updated', {
        source: 'agent-apply',
        clientId: request.get('x-mindflow-client') || null,
        document: result.document,
      });
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/v1/requests/:id/reject', async (request, response) => {
    try {
      const rejected = await store.rejectRequest(request.params.id);
      broadcast('request_updated', { request: rejected });
      response.json({ request: rejected });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/v1/proposals', async (request, response) => {
    try {
      const result = await store.submitProposal(request.body);
      if (result.request.status === 'completed') {
        broadcast('request_completed', result);
        broadcast('document_updated', {
          source: 'codex-apply',
          clientId: request.get('x-mindflow-client') || null,
          document: result.document,
        });
        response.json(result);
        return;
      }
      broadcast('request_created', { request: result.request });
      response.status(201).json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.get('/api/v1/canvases', (_request, response) => {
    response.json(store.listCanvases());
  });

  app.post('/api/v1/canvases', async (request, response) => {
    try {
      const result = await store.createCanvas(request.body);
      broadcast('canvas_switched', result);
      response.status(201).json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post('/api/v1/canvases/:id/activate', async (request, response) => {
    try {
      const result = await store.activateCanvas(request.params.id);
      broadcast('canvas_switched', result);
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.patch('/api/v1/canvases/:id', async (request, response) => {
    try {
      const result = await store.renameCanvas(request.params.id, request.body);
      broadcast('canvas_updated', result);
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post('/api/v1/canvases/:id/duplicate', async (request, response) => {
    try {
      const result = await store.duplicateCanvas(request.params.id);
      broadcast('canvas_switched', result);
      response.status(201).json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.delete('/api/v1/canvases/:id', async (request, response) => {
    try {
      const result = await store.deleteCanvas(request.params.id);
      broadcast('canvas_switched', result);
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.get('/api/v1/workspace/export', (_request, response) => {
    response.json(store.exportWorkspace());
  });
  const distDir = resolve('dist');
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) return next();
      response.sendFile(resolve(distDir, 'index.html'));
    });
  }

  return { app, store, broadcast };
}
