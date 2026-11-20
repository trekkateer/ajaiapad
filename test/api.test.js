'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../server/store');
const { createServer } = require('../server/app');

const ALICE = 'u_alice';
const BOB = 'u_bob';
const CAROL = 'u_carol';

let server;
let base;
let staticDir;

before(async () => {
  // Fixture UI folder so the API tests do not depend on a built dist/.
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajaiapad-static-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>AjaiaPad</title>');
  server = createServer({ store: createStore(), staticDir }); // in-memory store for API tests
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));
after(() => fs.rmSync(staticDir, { recursive: true, force: true }));

async function call(method, route, { user, body, raw } = {}) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${user}`;
  let payload;
  if (raw !== undefined) {
    headers['Content-Type'] = 'text/plain; charset=utf-8';
    payload = raw;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + route, { method, headers, body: payload });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

test('login accepts seeded users and rejects unknown ones', async () => {
  const ok = await call('POST', '/api/login', { body: { username: 'alice' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.token, ALICE);
  assert.equal(ok.body.user.name, 'Alice Chen');

  const bad = await call('POST', '/api/login', { body: { username: 'mallory' } });
  assert.equal(bad.status, 404);
});

test('document routes require a valid bearer token', async () => {
  const res = await call('GET', '/api/documents');
  assert.equal(res.status, 401);
  const forged = await call('GET', '/api/documents', { user: 'u_nobody' });
  assert.equal(forged.status, 401);
});

let docId;

test('owner creates a document and it appears only in their owned list', async () => {
  const created = await call('POST', '/api/documents', { user: ALICE, body: { title: 'Plan' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.document.role, 'owner');
  docId = created.body.document.id;

  const alice = await call('GET', '/api/documents', { user: ALICE });
  assert.ok(alice.body.owned.some((d) => d.id === docId));

  const bob = await call('GET', '/api/documents', { user: BOB });
  assert.equal(bob.body.owned.some((d) => d.id === docId), false);
  assert.equal(bob.body.shared.some((d) => d.id === docId), false);
});

test('users without access get 404 for the document, not 403', async () => {
  const res = await call('GET', `/api/documents/${docId}`, { user: BOB });
  assert.equal(res.status, 404);
});

test('owner shares with bob, who then sees it under shared with a viewer role of editor', async () => {
  const shared = await call('POST', `/api/documents/${docId}/shares`, { user: ALICE, body: { username: 'bob' } });
  assert.equal(shared.status, 200);
  assert.deepEqual(shared.body.document.sharedWith.map((u) => u.username), ['bob']);

  const list = await call('GET', '/api/documents', { user: BOB });
  const entry = list.body.shared.find((d) => d.id === docId);
  assert.ok(entry);
  assert.equal(entry.role, 'editor');
  assert.equal(entry.ownerName, 'Alice Chen');
});

test('sharing with the same person twice is rejected', async () => {
  const dup = await call('POST', `/api/documents/${docId}/shares`, { user: ALICE, body: { username: 'bob' } });
  assert.equal(dup.status, 409);
});

test('an editor cannot share the document onward', async () => {
  const res = await call('POST', `/api/documents/${docId}/shares`, { user: BOB, body: { username: 'carol' } });
  assert.equal(res.status, 403);
});

test('an editor can save content and the server sanitizes it', async () => {
  const saved = await call('PUT', `/api/documents/${docId}/content`, {
    user: BOB,
    body: { html: '<h1>Notes</h1><p onclick="x()">hello <b>bold</b></p><script>bad()</script>' },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.document.content, '<h1>Notes</h1><p>hello <strong>bold</strong></p>');

  const reread = await call('GET', `/api/documents/${docId}`, { user: ALICE });
  assert.equal(reread.body.document.content, '<h1>Notes</h1><p>hello <strong>bold</strong></p>');
});

test('an editor can rename, but empty titles are rejected', async () => {
  const renamed = await call('PATCH', `/api/documents/${docId}`, { user: BOB, body: { title: '  Q3 plan  ' } });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.document.title, 'Q3 plan');

  const empty = await call('PATCH', `/api/documents/${docId}`, { user: BOB, body: { title: '   ' } });
  assert.equal(empty.status, 400);
});

test('a non-collaborator cannot read or write the document', async () => {
  assert.equal((await call('PUT', `/api/documents/${docId}/content`, { user: CAROL, body: { html: 'x' } })).status, 404);
  assert.equal((await call('PATCH', `/api/documents/${docId}`, { user: CAROL, body: { title: 'x' } })).status, 404);
});

test('content must be a string', async () => {
  const res = await call('PUT', `/api/documents/${docId}/content`, { user: ALICE, body: { html: 42 } });
  assert.equal(res.status, 400);
});

test('owner can revoke access, after which bob gets 404', async () => {
  const revoked = await call('DELETE', `/api/documents/${docId}/shares/${BOB}`, { user: ALICE });
  assert.equal(revoked.status, 200);
  assert.deepEqual(revoked.body.document.sharedWith, []);

  assert.equal((await call('GET', `/api/documents/${docId}`, { user: BOB })).status, 404);
});

test('only the owner can delete a document, and it disappears for everyone', async () => {
  const created = await call('POST', '/api/documents', { user: ALICE, body: { title: 'Doomed' } });
  const id = created.body.document.id;
  await call('POST', `/api/documents/${id}/shares`, { user: ALICE, body: { username: 'bob' } });

  assert.equal((await call('DELETE', `/api/documents/${id}`, { user: BOB })).status, 403);
  assert.equal((await call('DELETE', `/api/documents/${id}`, { user: CAROL })).status, 404);
  assert.equal((await call('DELETE', `/api/documents/${id}`)).status, 401);

  const deleted = await call('DELETE', `/api/documents/${id}`, { user: ALICE });
  assert.equal(deleted.status, 204);

  assert.equal((await call('GET', `/api/documents/${id}`, { user: ALICE })).status, 404);
  assert.equal((await call('GET', `/api/documents/${id}`, { user: BOB })).status, 404);
  const bobList = await call('GET', '/api/documents', { user: BOB });
  assert.equal(bobList.body.shared.some((d) => d.id === id), false);
  assert.equal((await call('DELETE', `/api/documents/${id}`, { user: ALICE })).status, 404);
});

test('sharing with an unknown username is rejected', async () => {
  const res = await call('POST', `/api/documents/${docId}/shares`, { user: ALICE, body: { username: 'nobody' } });
  assert.equal(res.status, 404);
});

test('import turns a markdown file into a new document owned by the uploader', async () => {
  const res = await call('POST', '/api/documents/import?filename=' + encodeURIComponent('Meeting notes.md'), {
    user: CAROL,
    raw: '# Agenda\n\n- Budget\n- Hiring',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.document.title, 'Meeting notes');
  assert.equal(res.body.document.content, '<h1>Agenda</h1>\n<ul>\n<li>Budget</li>\n<li>Hiring</li>\n</ul>');
  assert.equal(res.body.document.role, 'owner');
});

test('import rejects unsupported types, empty files and binary content', async () => {
  const pdf = await call('POST', '/api/documents/import?filename=paper.pdf', { user: ALICE, raw: 'x' });
  assert.equal(pdf.status, 415);

  const empty = await call('POST', '/api/documents/import?filename=empty.txt', { user: ALICE, raw: '   ' });
  assert.equal(empty.status, 400);

  const binary = await call('POST', '/api/documents/import?filename=bin.txt', { user: ALICE, raw: 'ab\u0000cd' });
  assert.equal(binary.status, 415);
});

test('unknown routes return 404 JSON', async () => {
  const res = await call('GET', '/api/nope', { user: ALICE });
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('static files are served, and path traversal is blocked', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /AjaiaPad/);

  const traversal = await fetch(base + '/..%2fpackage.json');
  assert.notEqual(traversal.status, 200);
});

test('file-backed store survives a restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajaiapad-'));
  const file = path.join(dir, 'store.json');

  const first = createStore({ filePath: file });
  const doc = first.createDocument({ ownerId: ALICE, title: 'Persisted', content: '<p>keep me</p>' });
  first.addShare(doc.id, BOB);
  const gone = first.createDocument({ ownerId: ALICE, title: 'Gone', content: '' });
  assert.equal(first.deleteDocument(gone.id), true);
  assert.equal(first.deleteDocument(gone.id), false);

  const second = createStore({ filePath: file });
  const reloaded = second.getDocument(doc.id);
  assert.equal(reloaded.title, 'Persisted');
  assert.equal(reloaded.content, '<p>keep me</p>');
  assert.deepEqual(reloaded.sharedWith, [BOB]);
  assert.equal(second.getDocument(gone.id), null);

  fs.rmSync(dir, { recursive: true, force: true });
});
