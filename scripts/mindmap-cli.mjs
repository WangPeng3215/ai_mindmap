#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCommand } from './cli-args.mjs';

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

function branchView(document, nodeId) {
  if (!document.nodes[nodeId]) throw new Error(`节点不存在: ${nodeId}`);
  function visit(id) {
    const node = document.nodes[id];
    return {
      id: node.id,
      text: node.text,
      ...(node.notes ? { notes: node.notes } : {}),
      ...(node.color ? { color: node.color } : {}),
      ...(node.side ? { side: node.side } : {}),
      children: node.children.map(visit),
    };
  }
  return {
    revision: document.revision,
    layoutMode: document.layoutMode || 'left-right',
    scope: 'branch',
    targetNodeId: nodeId,
    root: visit(nodeId),
  };
}

function help() {
  process.stdout.write(`MindFlow Local CLI

Usage:
  npm run mindmap -- status
  npm run mindmap -- canvases
  npm run mindmap -- switch <canvas-id>
  npm run mindmap -- read [node-id]
  npm run mindmap -- pending
  npm run mindmap -- apply <map.json>
  npm run mindmap -- ops <operations.json>
  npm run mindmap -- propose <proposal.json>
  npm run mindmap -- apply-safe <proposal.json>
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
    case 'switch':
      print(await request(`/api/v1/canvases/${encodeURIComponent(parsed.canvasId)}/activate`, { method: 'POST' }));
      break;    case 'pending':
      print(await request('/api/v1/requests?status=pending'));
      break;
    case 'read': {
      const current = await request('/api/v1/mindmaps/current');
      const workspace = await request('/api/v1/canvases');
      print(parsed.nodeId ? branchView(current.document, parsed.nodeId) : current);
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
      print(await request('/api/v1/proposals', {
        method: 'POST',
        body: JSON.stringify({ ...payload, mode: parsed.command === 'apply-safe' ? 'apply' : 'review' }),
      }));
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
  process.stderr.write(`${JSON.stringify(error.payload || { error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}
