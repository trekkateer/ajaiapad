import { useEffect, useState } from 'react';
import { api, setSession } from '../api.js';

export default function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/users')
      .then(({ users }) => {
        setUsers(users);
        setUsername(users[0]?.username ?? '');
      })
      .catch((err) => setError(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user } = await api('/api/login', { method: 'POST', body: { username } });
      setSession(token);
      onLogin(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="panel narrow">
      <h1>Log in</h1>
      <p className="muted">Demo accounts only, no password. Pick one to continue.</p>
      <form onSubmit={submit}>
        <label>
          Account
          <select value={username} onChange={(e) => setUsername(e.target.value)}>
            {users.map((u) => (
              <option key={u.username} value={u.username}>
                {`${u.name} (${u.username})`}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy || !username}>Continue</button>
      </form>
      <p className="error" role="alert">{error}</p>
    </section>
  );
}
