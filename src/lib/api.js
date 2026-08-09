export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787';

async function request(path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `请求失败: ${response.status}`);
  return body;
}

export const api = {
  getCurrent: () => request('/api/v1/mindmaps/current'),
  listCanvases: () => request('/api/v1/canvases'),
  createCanvas: (title) => request('/api/v1/canvases', { method: 'POST', body: JSON.stringify({ title }) }),
  activateCanvas: (id) => request(`/api/v1/canvases/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
  renameCanvas: (id, title) => request(`/api/v1/canvases/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  duplicateCanvas: (id) => request(`/api/v1/canvases/${encodeURIComponent(id)}/duplicate`, { method: 'POST' }),
  deleteCanvas: (id) => request(`/api/v1/canvases/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  exportWorkspace: () => request('/api/v1/workspace/export'),
  replaceDocument: (document, clientId) =>
    request('/api/v1/mindmaps/current', {
      method: 'PUT',
      headers: { 'x-mindflow-client': clientId },
      body: JSON.stringify({ document }),
    }),
  listRequests: () => request('/api/v1/requests'),
  listSnapshots: () => request('/api/v1/mindmaps/snapshots'),
  restoreSnapshot: (id, clientId) =>
    request(`/api/v1/mindmaps/snapshots/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      headers: { 'x-mindflow-client': clientId },
    }),
  createRequest: (message, options = {}) =>
    request('/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify({ message, ...options }),
    }),
  applyRequest: (id, clientId, operationIndexes) =>
    request(`/api/v1/requests/${encodeURIComponent(id)}/apply`, {
      method: 'POST',
      headers: { 'x-mindflow-client': clientId },
      ...(operationIndexes ? { body: JSON.stringify({ operationIndexes }) } : {}),
    }),
  rejectRequest: (id) =>
    request(`/api/v1/requests/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
  events: (onEvent) => {
    const events = new EventSource(`${API_BASE}/api/v1/events`);
    for (const type of ['document_updated', 'request_created', 'request_updated', 'request_completed', 'canvas_switched', 'canvas_updated']) {
      events.addEventListener(type, (event) => onEvent(type, JSON.parse(event.data)));
    }
    return events;
  },
};
