import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_API_URL = 'http://127.0.0.1:8787';
const DEFAULT_DEV_WEB_URL = 'http://127.0.0.1:5173';

async function reachable(url, timeoutMs = 800) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

function launch(entry, args = []) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

async function waitUntilReady(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(url)) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`MindFlow 启动超时，请检查端口和项目依赖: ${url}`);
}

export async function ensureMindFlowStarted(options = {}) {
  const apiUrl = options.apiUrl || process.env.MINDFLOW_API_URL || DEFAULT_API_URL;
  const healthUrl = `${apiUrl}/api/v1/health`;
  const apiOrigin = new URL(apiUrl).origin;

  if (await reachable(healthUrl)) {
    const webUrl = await reachable(DEFAULT_DEV_WEB_URL) ? DEFAULT_DEV_WEB_URL : apiOrigin;
    return { started: false, apiUrl, webUrl };
  }

  if (apiUrl !== DEFAULT_API_URL) {
    throw new Error(`自定义 MindFlow 服务不可用，未启动本地服务: ${apiUrl}`);
  }

  const serverEntry = resolve(PROJECT_ROOT, 'server', 'index.mjs');
  const viteEntry = resolve(PROJECT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(serverEntry) || !existsSync(viteEntry)) {
    throw new Error('MindFlow 依赖未安装，请先在项目目录执行 npm install');
  }

  launch(serverEntry);
  launch(viteEntry);
  await waitUntilReady(healthUrl);
  await waitUntilReady(DEFAULT_DEV_WEB_URL);
  return { started: true, apiUrl, webUrl: DEFAULT_DEV_WEB_URL };
}

export const serviceDefaults = {
  apiUrl: DEFAULT_API_URL,
  webUrl: DEFAULT_DEV_WEB_URL,
};
