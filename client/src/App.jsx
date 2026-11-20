import { useEffect, useState } from 'react';
import { api, getToken, onUnauthorized, setSession } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import Editor from './components/Editor.jsx';

// Tracks the URL hash so routing works with plain links and the back button.
function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return hash;
}

function signOutState() {
  setSession(null);
  window.location.hash = '';
}

export default function App() {
  const hash = useHash();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      signOutState();
    });
    if (!getToken()) return;
    api('/api/me')
      .then(({ user }) => setUser(user))
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <section className="panel narrow"><p className="muted">Loading...</p></section>;

  const docId = /^#\/doc\/([^/]+)$/.exec(hash)?.[1] ?? null;

  return (
    <>
      <header className="app-header">
        <a href="#" className="brand">AjaiaPad</a>
        {user && (<div className="user-area">
          <span>{user.name}</span>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setUser(null);
              signOutState();
            }}
          >
            Log out
          </button>
        </div>)}
      </header>
      <main>
        {user ? (
          docId ? <Editor key={docId} docId={docId} /> : <Dashboard />
        ) : (
          <Login
            onLogin={(loggedIn) => {
              window.location.hash = '';
              setUser(loggedIn);
            }}
          />
        )}
      </main>
    </>
  );
}
