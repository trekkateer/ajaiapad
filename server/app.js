'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { sanitizeHtml } = require('./sanitize');
const { ALLOWED_EXTENSIONS, convertUpload } = require('./convert');

const MAX_TITLE_LENGTH = 200;
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // stored HTML
const MAX_UPLOAD_BYTES = 1024 * 1024; // raw imported file
const MAX_JSON_BYTES = 64 * 1024; // small JSON bodies (login, title, share)
const MAX_CONTENT_BODY_BYTES = 2 * MAX_DOCUMENT_BYTES; // PUT body, JSON-escaped HTML

const DEFAULT_STATIC_DIR = path.join(__dirname, '..', 'dist'); // built React app
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message);
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > limit) {
      reject(new HttpError(413, 'Payload too large'));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true; // keep draining so the response can still be written
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(new HttpError(413, 'Payload too large'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function readJson(req, limit = MAX_JSON_BYTES) {
  const text = await readBody(req, limit);
  if (!text.trim()) return {};
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail(400, 'Request body must be valid JSON');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(400, 'Request body must be a JSON object');
  }
  return value;
}

// Titles are validated strictly for user edits.
function validateTitle(value) {
  if (typeof value !== 'string') fail(400, 'Title must be a string');
  if (value.length > MAX_TITLE_LENGTH) fail(400, `Title must be at most ${MAX_TITLE_LENGTH} characters`);
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!cleaned) fail(400, 'Title cannot be empty');
  return cleaned;
}

// Imported filenames are coerced rather than rejected.
const coerceTitle = (value, fallback) => {
  const cleaned = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
  return cleaned || fallback;
};

const publicUser = (user) => ({ id: user.id, username: user.username, name: user.name });

function authenticate(req, store) {
  const match = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
  const user = match ? store.getUser(match[1]) : null;
  if (!user) fail(401, 'Please log in');
  return user;
}

// Access model: an owner has full control; a user in sharedWith is an editor
// (can read, edit content and rename) but cannot share or remove access.
// Anyone else gets 404 so document ids do not leak existence.
function loadDocument(store, id, user) {
  const doc = store.getDocument(id);
  const canAccess = doc && (doc.ownerId === user.id || doc.sharedWith.includes(user.id));
  if (!canAccess) fail(404, 'Document not found');
  return doc;
}

function requireOwner(doc, user, action = 'change sharing') {
  if (doc.ownerId !== user.id) fail(403, `Only the document owner can ${action}`);
}

function roleFor(doc, viewerId) {
  return doc.ownerId === viewerId ? 'owner' : 'editor';
}

function presentDocument(doc, store, viewerId) {
  const owner = store.getUser(doc.ownerId);
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    ownerId: doc.ownerId,
    ownerName: owner ? owner.name : 'Unknown',
    role: roleFor(doc, viewerId),
    sharedWith: doc.sharedWith.map((id) => store.getUser(id)).filter(Boolean).map(publicUser),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function presentSummary(doc, store, viewerId) {
  const owner = store.getUser(doc.ownerId);
  return {
    id: doc.id,
    title: doc.title,
    ownerName: owner ? owner.name : 'Unknown',
    role: roleFor(doc, viewerId),
    updatedAt: doc.updatedAt,
  };
}

async function handleApi(req, res, url, store) {
  const { pathname } = url;
  const method = req.method;
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]

  if (pathname === '/api/login') {
    if (method !== 'POST') fail(405, 'Method not allowed');
    const body = await readJson(req);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const user = store.findUserByUsername(username);
    if (!user) fail(404, 'Unknown user. Use one of the demo accounts.');
    return sendJson(res, 200, { token: user.id, user: publicUser(user) });
  }

  if (pathname === '/api/users') {
    if (method !== 'GET') fail(405, 'Method not allowed');
    return sendJson(res, 200, { users: store.users.map(publicUser) });
  }

  const user = authenticate(req, store);

  if (pathname === '/api/me') {
    if (method !== 'GET') fail(405, 'Method not allowed');
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (parts[1] !== 'documents' || parts.length > 5) fail(404, 'Not found');

  // /api/documents
  if (parts.length === 2) {
    if (method === 'GET') {
      const { owned, shared } = store.listForUser(user.id);
      return sendJson(res, 200, {
        owned: owned.map((d) => presentSummary(d, store, user.id)),
        shared: shared.map((d) => presentSummary(d, store, user.id)),
      });
    }
    if (method === 'POST') {
      const body = await readJson(req);
      const title = body.title === undefined ? 'Untitled document' : validateTitle(body.title);
      const doc = store.createDocument({ ownerId: user.id, title, content: '' });
      return sendJson(res, 201, { document: presentDocument(doc, store, user.id) });
    }
    fail(405, 'Method not allowed');
  }

  // /api/documents/import?filename=...  (raw text body)
  if (parts[2] === 'import' && parts.length === 3) {
    if (method !== 'POST') fail(405, 'Method not allowed');
    const filename = url.searchParams.get('filename') || '';
    const dot = filename.lastIndexOf('.');
    const extension = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      fail(415, `Unsupported file type. Import ${ALLOWED_EXTENSIONS.join(' or ')} files only.`);
    }
    const text = await readBody(req, MAX_UPLOAD_BYTES);
    if (!text.trim()) fail(400, 'The file is empty');
    if (text.includes('\u0000')) fail(415, 'The file does not look like plain text');

    const baseName = filename.slice(0, dot);
    const html = sanitizeHtml(convertUpload(extension, text));
    if (Buffer.byteLength(html) > MAX_DOCUMENT_BYTES) fail(413, 'The imported content is too large');

    const doc = store.createDocument({
      ownerId: user.id,
      title: coerceTitle(baseName, 'Imported document'),
      content: html,
    });
    return sendJson(res, 201, { document: presentDocument(doc, store, user.id) });
  }

  // /api/documents/:id
  const docId = parts[2];
  const section = parts[3];
  const memberId = parts[4];

  if (!section) {
    if (method === 'GET') {
      const doc = loadDocument(store, docId, user);
      return sendJson(res, 200, { document: presentDocument(doc, store, user.id) });
    }
    if (method === 'PATCH') {
      loadDocument(store, docId, user);
      const body = await readJson(req);
      if (body.title === undefined) fail(400, 'Nothing to update');
      const updated = store.updateDocument(docId, { title: validateTitle(body.title) });
      return sendJson(res, 200, { document: presentDocument(updated, store, user.id) });
    }
    if (method === 'DELETE') {
      const doc = loadDocument(store, docId, user);
      requireOwner(doc, user, 'delete it');
      store.deleteDocument(docId);
      res.writeHead(204, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end();
    }
    fail(405, 'Method not allowed');
  }

  // PUT /api/documents/:id/content
  if (section === 'content' && !memberId) {
    if (method !== 'PUT') fail(405, 'Method not allowed');
    loadDocument(store, docId, user);
    const body = await readJson(req, MAX_CONTENT_BODY_BYTES);
    if (typeof body.html !== 'string') fail(400, 'Field "html" must be a string');
    const html = sanitizeHtml(body.html);
    if (Buffer.byteLength(html) > MAX_DOCUMENT_BYTES) fail(413, 'Document is too large');
    const updated = store.updateDocument(docId, { content: html });
    return sendJson(res, 200, { document: presentDocument(updated, store, user.id) });
  }

  // /api/documents/:id/shares and /api/documents/:id/shares/:userId
  if (section === 'shares') {
    if (!memberId) {
      if (method !== 'POST') fail(405, 'Method not allowed');
      const doc = loadDocument(store, docId, user);
      requireOwner(doc, user);
      const body = await readJson(req);
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      const target = store.findUserByUsername(username);
      if (!target) fail(404, 'No user with that username');
      if (target.id === doc.ownerId) fail(400, 'You already own this document');
      if (doc.sharedWith.includes(target.id)) fail(409, `Already shared with ${target.name}`);
      const updated = store.addShare(docId, target.id);
      return sendJson(res, 200, { document: presentDocument(updated, store, user.id) });
    }
    if (method !== 'DELETE') fail(405, 'Method not allowed');
    const doc = loadDocument(store, docId, user);
    requireOwner(doc, user);
    if (!doc.sharedWith.includes(memberId)) fail(404, 'That user does not have access');
    const updated = store.removeShare(docId, memberId);
    return sendJson(res, 200, { document: presentDocument(updated, store, user.id) });
  }

  fail(404, 'Not found');
}

async function serveStatic(req, res, url, staticDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, 'Method not allowed');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    fail(400, 'Bad request path');
  }
  const filePath = path.normalize(path.join(staticDir, decoded));
  if (!filePath.startsWith(staticDir + path.sep)) fail(404, 'Not found');

  let data;
  try {
    data = await fs.readFile(filePath);
  } catch {
    fail(404, 'Not found');
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    'Content-Length': data.length,
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : data);
}

function createServer({ store, staticDir = DEFAULT_STATIC_DIR }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url, store);
      } else {
        await serveStatic(req, res, url, staticDir);
      }
    } catch (err) {
      const isHttpError = err instanceof HttpError;
      if (!isHttpError) console.error(err);
      if (!res.headersSent) {
        sendJson(res, isHttpError ? err.status : 500, {
          error: isHttpError ? err.message : 'Internal server error',
        });
      }
    }
  });
}

module.exports = { createServer, HttpError };
