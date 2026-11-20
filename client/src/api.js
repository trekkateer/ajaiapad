// Thin fetch wrapper. The session token is the seeded user id (mock auth, demo only).

const TOKEN_KEY = 'ajaiapad.token';

let token = localStorage.getItem(TOKEN_KEY);
let unauthorizedHandler = () => {};

export function getToken() {
  return token;
}

export function setSession(nextToken) {
  token = nextToken;
  if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken);
  else localStorage.removeItem(TOKEN_KEY);
}

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export async function api(path, { method = 'GET', body, raw, keepalive = false } = {}) {
  const headers = {};
  let payload;

  if (token) headers.Authorization = `Bearer ${token}`;
  if (raw !== undefined) {
    headers['Content-Type'] = 'text/plain; charset=utf-8';
    payload = raw;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: payload, keepalive });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== '/api/login') {
    unauthorizedHandler();
    throw new Error('Your session ended. Please log in again.');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
