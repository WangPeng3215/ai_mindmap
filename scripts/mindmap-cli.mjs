#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCommand } from './cli-args.mjs';
import { ensureMindFlowStarted } from './service-launcher.mjs';
import { compactDocument, compactMutationResult, parseOutline } from './compact-protocol.mjs';

const baseUrl = process.env.MINDFLOW_API_URL || 'http://127.0.0.1:8787';

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`);
    error.payload = { status: response.status, ...body };
    throw error;
  }
  return body;
}

async function loadJson(file) {
  return JSON.parse(await readFile(resolve(file), 'utf8'));
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help() {
  process.stdout.write(`MindFlow Local CLI

Usage:
  npm run mindmap -- status
  npm run mindmap -- start
  npm run mindmap -- canvases
  npm run mindmap -- create <title>
  npm run mindmap -- switch <canvas-id>
  npm run mindmap -- read [node-id] [--compact]
  npm run mindmap -- pending
  npm run mindmap -- apply <map.json>
  npm run mindmap -- ops <operations.json>
  npm run mindmap -- propose <proposal.json>
  npm run mindmap -- apply-safe <proposal.json>
  npm run mindmap -- propose-outline <outline.txt> [--layout=left-right]
  npm run mindmap -- apply-outline <outline.txt> [--layout=left-right]
  npm run mindmap -- request <需求描述>
  npm run mindmap -- complete <request-id> <result.json>
  npm run mindmap -- apply-request <request-id>
  npm run mindmap -- reject-request <request-id>

Environment:
  MINDFLOW_API_URL=http://127.0.0.1:8787
`);
}

try {
  const parsed = parseCommand(process.argv.slice(2));
  switch (parsed.command) {
    case 'start':
      print(await ensureMindFlowStarted({ apiUrl: baseUrl }));
      break;
    case 'status': {
      const health = await request('/api/v1/health');
      const current = await request('/api/v1/mindmaps/current');
      const workspace = await request('/api/v1/canvases');
      print({ ...health, activeCanvasId: workspace.activeCanvasId, current: { id: current.document.id, title: current.document.title, revision: current.document.revision } });
      break;
    }
    case 'canvases':
      print(await request('/api/v1/canvases'));
      break;
    case 'create':
      {
        const result = await request('/api/v1/canvases', {
          method: 'POST',
          body: JSON.stringify({ title: parsed.title }),
        });
        print({
          activeCanvasId: result.activeCanvasId,
          canvas: result.canvas,
          current: {
            rootId: result.document.rootId,
            title: result.document.title,
            revision: result.document.revision,
          },
        });
      }
      break;
    case 'switch':
      print(await request(`/api/v1/canvases/${encodeURIComponent(parsed.canvasId)}/activate`, { method: 'POST' }));
      break;    case 'pending':
      print(await request('/api/v1/requests?status=pending'));
      break;
    case 'read': {
      const current = await request('/api/v1/mindmaps/current');
      print(parsed.compact || parsed.nodeId
        ? compactDocument(current.document, parsed.nodeId)
        : current);
      break;
    }
    case 'apply':
      print(await request('/api/v1/mindmaps/current', { method: 'PUT', body: JSON.stringify(await loadJson(parsed.file)) }));
      break;
    case 'ops': {
      const payload = await loadJson(parsed.file);
      const operations = Array.isArray(payload) ? payload : payload.operations;
      print(await request('/api/v1/mindmaps/operations', { method: 'POST', body: JSON.stringify({ operations }) }));
      break;
    }
    case 'propose':
    case 'apply-safe': {
      const payload = await loadJson(parsed.file);
      const result = await request('/api/v1/proposals', {
        method: 'POST',
        body: JSON.stringify({ ...payload, mode: parsed.command === 'apply-safe' ? 'apply' : 'review' }),
      });
      print(compactMutationResult(result));
      break;
    }
    case 'propose-outline':
    case 'apply-outline': {
      const current = await request('/api/v1/mindmaps/current');
      const outline = parseOutline(await readFile(resolve(parsed.file), 'utf8'), { layoutMode: parsed.layoutMode });
      const result = await request('/api/v1/proposals', {
        method: 'POST',
        body: JSON.stringify({
          baseRevision: current.document.revision,
          scope: 'map',
          message: `从精简大纲生成「${outline.title}」`,
          document: outline,
          mode: parsed.command === 'apply-outline' ? 'apply' : 'review',
        }),
      });
      print(compactMutationResult(result));
      break;
    }
    case 'request':
      print(await request('/api/v1/requests', { method: 'POST', body: JSON.stringify({ message: parsed.message }) }));
      break;
    case 'complete':
      print(await request(`/api/v1/requests/${encodeURIComponent(parsed.requestId)}/complete`, {
        method: 'POST',
        body: JSON.stringify(await loadJson(parsed.file)),
      }));
      break;
    case 'apply-request':
      print(await request(`/api/v1/requests/${encodeURIComponent(parsed.requestId)}/apply`, { method: 'POST' }));
      break;
    case 'reject-request':
      print(await request(`/api/v1/requests/${encodeURIComponent(parsed.requestId)}/reject`, { method: 'POST' }));
      break;
    default:
      help();
  }
} catch (error) {
  const payload = error.payload || { error: error.message };
  const output = payload.code === 'REVISION_CONFLICT' && payload.document
    ? {
        status: payload.status,
        code: payload.code,
        error: payload.error,
        currentRevision: payload.currentRevision,
        current: compactDocument(payload.document),
      }
    : payload;
  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
}
