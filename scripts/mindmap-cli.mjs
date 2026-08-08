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
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
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
  npm run mindmap -- pending
  npm run mindmap -- apply <map.json>
  npm run mindmap -- ops <operations.json>
  npm run mindmap -- request <需求描述>
  npm run mindmap -- complete <request-id> <result.json>

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
      print({ ...health, current: { id: current.document.id, title: current.document.title } });
      break;
    }
    case 'pending':
      print(await request('/api/v1/requests?status=pending'));
      break;
    case 'apply':
      print(await request('/api/v1/mindmaps/current', { method: 'PUT', body: JSON.stringify(await loadJson(parsed.file)) }));
      break;
    case 'ops': {
      const payload = await loadJson(parsed.file);
      const operations = Array.isArray(payload) ? payload : payload.operations;
      print(await request('/api/v1/mindmaps/operations', { method: 'POST', body: JSON.stringify({ operations }) }));
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
    default:
      help();
  }
} catch (error) {
  process.stderr.write(`MindFlow CLI: ${error.message}\n`);
  process.exitCode = 1;
}
