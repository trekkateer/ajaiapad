'use strict';

// Persistence layer. A single JSON file holds users (seeded, read-only) and
// documents. Writes go to a temp file and are renamed into place so a crash
// mid-write cannot leave a truncated store behind. Good enough for a
// single-process demo; swap for SQLite/Postgres when concurrency matters.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS = Object.freeze([
  Object.freeze({ id: 'u_alice', username: 'alice', name: 'Alice Chen' }),
  Object.freeze({ id: 'u_bob', username: 'bob', name: 'Bob Okafor' }),
  Object.freeze({ id: 'u_carol', username: 'carol', name: 'Carol Mendes' }),
]);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const clone = (value) => (value ? JSON.parse(JSON.stringify(value)) : null);
const byUpdatedDesc = (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);

function createStore({ filePath = null } = {}) {
  let documents = {};

  if (filePath && fs.existsSync(filePath)) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    documents = parsed.documents || {};
  }

  function persist() {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ documents }, null, 2));
    fs.renameSync(tmp, filePath);
  }

  const find = (id) => (typeof id === 'string' && hasOwn(documents, id) ? documents[id] : null);

  return {
    users: USERS,

    getUser: (id) => USERS.find((u) => u.id === id) || null,
    findUserByUsername: (username) => USERS.find((u) => u.username === username) || null,

    count: () => Object.keys(documents).length,

    createDocument({ ownerId, title, content }) {
      const now = new Date().toISOString();
      const doc = {
        id: crypto.randomUUID(),
        title,
        ownerId,
        content,
        sharedWith: [],
        createdAt: now,
        updatedAt: now,
      };
      documents[doc.id] = doc;
      persist();
      return clone(doc);
    },

    getDocument: (id) => clone(find(id)),

    listForUser(userId) {
      const all = Object.values(documents);
      return {
        owned: all.filter((d) => d.ownerId === userId).map(clone).sort(byUpdatedDesc),
        shared: all
          .filter((d) => d.ownerId !== userId && d.sharedWith.includes(userId))
          .map(clone)
          .sort(byUpdatedDesc),
      };
    },

    updateDocument(id, fields) {
      const doc = find(id);
      if (!doc) return null;
      Object.assign(doc, fields, { updatedAt: new Date().toISOString() });
      persist();
      return clone(doc);
    },

    deleteDocument(id) {
      if (!find(id)) return false;
      delete documents[id];
      persist();
      return true;
    },

    addShare(id, userId) {
      const doc = find(id);
      if (!doc) return null;
      if (!doc.sharedWith.includes(userId)) doc.sharedWith.push(userId);
      doc.updatedAt = new Date().toISOString();
      persist();
      return clone(doc);
    },

    removeShare(id, userId) {
      const doc = find(id);
      if (!doc) return null;
      doc.sharedWith = doc.sharedWith.filter((uid) => uid !== userId);
      persist();
      return clone(doc);
    },
  };
}

module.exports = { createStore, USERS };
