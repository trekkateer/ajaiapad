import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { fmtTime } from '../utils.js';
import Toolbar from './Toolbar.jsx';
import ShareSection from './ShareSection.jsx';

const AUTOSAVE_MS = 800;
const RETRY_MS = 5000;

// execCommand is deprecated but still supported everywhere. It is the
// pragmatic choice for a contenteditable editor with no extra dependencies.
const COMMANDS = {
  bold: () => document.execCommand('bold'),
  italic: () => document.execCommand('italic'),
  underline: () => document.execCommand('underline'),
  h1: () => document.execCommand('formatBlock', false, 'h1'),
  h2: () => document.execCommand('formatBlock', false, 'h2'),
  paragraph: () => document.execCommand('formatBlock', false, 'p'),
  ul: () => document.execCommand('insertUnorderedList'),
  ol: () => document.execCommand('insertOrderedList'),
};

const readFormats = () => ({
  bold: document.queryCommandState('bold'),
  italic: document.queryCommandState('italic'),
  underline: document.queryCommandState('underline'),
});

export default function Editor({ docId }) {
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState({ text: 'Loading…', isError: false });
  const [active, setActive] = useState({});

  // The contenteditable element is not a React-managed child, so its content
  // lives in the DOM. Refs track save state without causing re-renders.
  const bodyRef = useRef(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveAgainRef = useRef(false);
  const timerRef = useRef(null);

  const showStatus = (text, isError = false) => setStatus({ text, isError });

  async function saveNow({ keepalive = false } = {}) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!dirtyRef.current || !bodyRef.current) return;
    if (savingRef.current) {
      saveAgainRef.current = true;
      return;
    }

    savingRef.current = true;
    dirtyRef.current = false;
    showStatus('Saving…');
    try {
      await api(`/api/documents/${docId}/content`, {
        method: 'PUT',
        body: { html: bodyRef.current.innerHTML },
        keepalive,
      });
      if (!dirtyRef.current) showStatus(`Saved at ${fmtTime(new Date())}`);
    } catch (err) {
      dirtyRef.current = true;
      showStatus(`Save failed: ${err.message}. Retrying…`, true);
      timerRef.current = setTimeout(() => saveNow(), RETRY_MS);
    } finally {
      savingRef.current = false;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        if (dirtyRef.current) saveNow();
      }
    }
  }

  function markDirty() {
    dirtyRef.current = true;
    showStatus('Unsaved changes');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveNow(), AUTOSAVE_MS);
  }

  // Load the document once per id (the parent re-mounts this component per id).
  useEffect(() => {
    let cancelled = false;
    api(`/api/documents/${encodeURIComponent(docId)}`)
      .then(({ document }) => {
        if (cancelled) return;
        setDoc(document);
        setTitle(document.title);
        bodyRef.current.innerHTML = document.content; // sanitized by the server
        showStatus('All changes saved');
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Global listeners: Ctrl+S, selection-based toolbar state, and flushing
  // unsaved edits when the tab closes or the editor unmounts.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
      }
    };
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (selection?.anchorNode && bodyRef.current?.contains(selection.anchorNode)) {
        setActive(readFormats());
      }
    };
    const onPageHide = () => {
      if (dirtyRef.current) saveNow({ keepalive: true });
    };
    const onBeforeUnload = (event) => {
      if (dirtyRef.current) event.preventDefault();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearTimeout(timerRef.current);
      if (dirtyRef.current) saveNow({ keepalive: true });
    };
  }, []);

  function runCommand(command) {
    bodyRef.current.focus();
    COMMANDS[command]?.();
    markDirty();
    setActive(readFormats());
  }

  async function renameDocument() {
    if (!doc) return;
    const next = title.trim();
    if (next === doc.title) return;
    if (!next) {
      setTitle(doc.title);
      showStatus('Title cannot be empty', true);
      return;
    }
    try {
      const { document: updated } = await api(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        body: { title: next },
      });
      setDoc((prev) => ({ ...prev, title: updated.title, updatedAt: updated.updatedAt }));
      setTitle(updated.title);
      showStatus('Renamed');
    } catch (err) {
      setTitle(doc.title);
      showStatus(err.message, true);
    }
  }

  async function deleteDocument() {
    if (!doc || doc.role !== 'owner') return;
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone and removes it for everyone it is shared with.`)) return;
    // Drop pending edits so the unmount flush does not PUT to a deleted document.
    const hadUnsaved = dirtyRef.current;
    clearTimeout(timerRef.current);
    dirtyRef.current = false;
    try {
      await api(`/api/documents/${doc.id}`, { method: 'DELETE' });
      window.location.hash = '';
    } catch (err) {
      showStatus(`Delete failed: ${err.message}`, true);
      if (hadUnsaved) markDirty(); // keep the user's edits and resume autosave
    }
  }

  if (loadError) {
    return (
      <section className="panel">
        <p className="error" role="alert">{loadError}</p>
        <a href="#">&larr; All documents</a>
      </section>
    );
  }

  const roleText = !doc
    ? ''
    : doc.role === 'owner'
      ? 'You own this document.'
      : `Shared with you by ${doc.ownerName}. You can edit.`;

  return (
    <section className="panel editor">
      <div className="row between">
        <a href="#">&larr; All documents</a>
        <span className={`status${status.isError ? ' is-error' : ''}`} aria-live="polite">
          {status.text}
        </span>
      </div>

      <input
        className="title-input"
        maxLength={200}
        aria-label="Document title"
        value={title}
        disabled={!doc}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={renameDocument}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <div className="row between">
        <p className="muted">{roleText}</p>
        {doc?.role === 'owner' && (
          <button type="button" className="danger" onClick={deleteDocument}>
            Delete document
          </button>
        )}
      </div>

      <Toolbar onCommand={runCommand} active={active} disabled={!doc} />

      <div
        ref={bodyRef}
        className="page"
        contentEditable={Boolean(doc)}
        suppressContentEditableWarning
        spellCheck
        aria-label="Document body"
        onInput={markDirty}
      />

      {doc && (
        <ShareSection
          doc={doc}
          onChange={(sharedWith) => setDoc((prev) => ({ ...prev, sharedWith }))}
        />
      )}
    </section>
  );
}
