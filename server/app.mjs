import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore } from './store.mjs';

function errorMessage(error) {
  return error instanceof Error ? error.message : '未知错误';
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
      const document = await store.replaceDocument(request.body);
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
      const document = await store.applyDocumentOperations(request.body.operations);
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

  app.post('/api/v1/requests', async (request, response) => {
    try {
      const queued = await store.createRequest(request.body.message);
      broadcast('request_created', { request: queued });
      response.status(201).json({ request: queued });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post('/api/v1/requests/:id/complete', async (request, response) => {
    try {
      const result = await store.completeRequest(request.params.id, request.body);
      broadcast('request_completed', result);
      broadcast('document_updated', { source: 'agent', document: result.document });
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
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
