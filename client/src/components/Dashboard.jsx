import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { IMPORT_TYPES, MAX_IMPORT_BYTES, docHref, extensionOf, fmtDate } from '../utils.js';

export default function Dashboard() {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/documents')
      .then(setLists)
      .catch((err) => setError(err.message));
  }, []);

  async function createDocument() {
    setError('');
    try {
      const { document } = await api('/api/documents', {
        method: 'POST',
        body: { title: 'Untitled document' },
      });
      window.location.hash = docHref(document.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function importFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    if (!IMPORT_TYPES.includes(extensionOf(file.name))) {
      setError('Only .txt and .md files can be imported.');
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setError('Files must be 1 MB or smaller.');
      return;
    }

    setError('');
    try {
      const text = await file.text();
      const { document } = await api(
        `/api/documents/import?filename=${encodeURIComponent(file.name)}`,
        { method: 'POST', raw: text },
      );
      window.location.hash = docHref(document.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteDocument(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone and removes it for everyone it is shared with.`)) return;
    setError('');
    try {
      await api(`/api/documents/${doc.id}`, { method: 'DELETE' });
      setLists((prev) => ({ ...prev, owned: prev.owned.filter((d) => d.id !== doc.id) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="row between">
        <h1>Documents</h1>
        <div className="actions">
          <button type="button" onClick={createDocument}>New document</button>
          <label className="button secondary">
            Import .txt or .md
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              hidden
              onChange={importFile}
            />
          </label>
        </div>
      </div>
      <p className="error" role="alert">{error}</p>

      <h2>Owned by you</h2>
      <DocList
        docs={lists?.owned}
        emptyText="You have no documents yet. Create one to get started."
        onDelete={deleteDocument}
      />

      <h2>Shared with you</h2>
      <DocList docs={lists?.shared} emptyText="Nothing has been shared with you yet." />
    </section>
  );
}

function DocList({ docs, emptyText, onDelete }) {
  if (!docs) {
    return <ul className="doc-list"><li className="empty">Loading…</li></ul>;
  }
  if (!docs.length) {
    return <ul className="doc-list"><li className="empty">{emptyText}</li></ul>;
  }
  return (
    <ul className="doc-list">
      {docs.map((doc) => {
        // Gets doc metadata
        const owner = doc.role === 'owner' ? 'Owned by you' : `Owned by ${doc.ownerName}`;
        const dateCreated = new Date(doc.updatedAt);

        return (
          <li key={doc.id} className={onDelete ? 'with-action' : undefined}>
            <a href={docHref(doc.id)}>
              <span className="doc-title">{doc.title}</span>
              <span className="doc-meta">{`${owner} · edited ${dateCreated.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`}</span>
            </a>
            {onDelete && doc.role === 'owner' && (
              <button
                type="button"
                className="ghost danger"
                aria-label={`Delete ${doc.title}`}
                onClick={() => onDelete(doc)}
              >
                Delete
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
