import { useState } from 'react';
import { api } from '../api.js';

// Owner-only sharing controls. Shared users are editors.
export default function ShareSection({ doc, onChange }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  if (doc.role !== 'owner') return null;

  async function share(event) {
    event.preventDefault();
    const name = username.trim();
    if (!name) return;
    setError('');
    try {
      const { document: updated } = await api(`/api/documents/${doc.id}/shares`, {
        method: 'POST',
        body: { username: name },
      });
      onChange(updated.sharedWith);
      setUsername('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(userId) {
    setError('');
    try {
      const { document: updated } = await api(`/api/documents/${doc.id}/shares/${userId}`, {
        method: 'DELETE',
      });
      onChange(updated.sharedWith);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="share">
      <h2>Sharing</h2>
      <p className="muted">People you share with can read, edit and rename this document.</p>
      <form className="row" onSubmit={share}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username, e.g. bob"
          autoComplete="off"
          required
        />
        <button type="submit">Share</button>
      </form>
      <p className="error" role="alert">{error}</p>
      <ul className="doc-list compact">
        {doc.sharedWith.length ? (
          doc.sharedWith.map((person) => (
            <li key={person.id}>
              <span>{`${person.name} (${person.username})`}</span>
              <button type="button" className="ghost" onClick={() => remove(person.id)}>
                Remove
              </button>
            </li>
          ))
        ) : (
          <li className="empty">Not shared with anyone yet.</li>
        )}
      </ul>
    </section>
  );
}
