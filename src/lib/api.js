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
  replaceDocument: (document, clientId) =>
    request('/api/v1/mindmaps/current', {
      method: 'PUT',
      headers: { 'x-mindflow-client': clientId },
      body: JSON.stringify({ document }),
    }),
  listRequests: () => request('/api/v1/requests'),
  createRequest: (message) =>
    request('/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  events: (onEvent) => {
    const events = new EventSource(`${API_BASE}/api/v1/events`);
    for (const type of ['document_updated', 'request_created', 'request_completed']) {
      events.addEventListener(type, (event) => onEvent(type, JSON.parse(event.data)));
    }
    return events;
  },
};
