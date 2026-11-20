# Architecture note

## What I prioritized

1. **A complete loop before breadth.** Create → edit → autosave → reopen → share → collaborator opens and edits. Every other choice was made to protect that loop within a 4–6 hour timebox.
2. **Access control on the server.** Every document route loads the document through one function that enforces owner/editor rules. Non-collaborators get `404`, not `403`, so document ids don't reveal which documents exist. Owner-only actions (sharing, revoking access and deleting) also check ownership through a second helper. Editors get `403` for these, because they already know the document exists.
3. **Safe HTML storage.** Documents are stored as HTML because that is the simplest model for bold, italic, underline, headings and lists. Because stored HTML is later rendered into the page, the server runs every save and every import through an allowlist sanitizer. Attributes are dropped entirely, so there are no event handlers, inline styles or `javascript:` URLs.
4. **Few dependencies.** The server uses only Node built-ins. The UI adds React and Vite, which keeps the component model familiar without a heavy state or routing library. Routing is a small hash-based hook.

## Structure
The UI is a React single-page app built with Vite. The Node server serves the built `dist/` folder and the JSON API.

```
browser (client/, React)                server (server/, Node built-ins only)
┌──────────────────────────────┐       ┌────────────────────────────────────┐
│ App.jsx: session + hash route│       │ app.js                             │
│  Login / Dashboard / Editor  │ JSON  │  - routes, bearer auth             │
│  Toolbar / ShareSection      │ ────► │  - access rules (owner / editor)   │
│ api.js: fetch + token        │ ◄──── │  - validation, size limits         │
│ Editor: contenteditable,     │       │ sanitize.js  (HTML allowlist)      │
│  autosave via refs + timers  │       │ convert.js   (.txt/.md → HTML)     │
└──────────────────────────────┘       │ store.js     (JSON file, atomic)   │
                                       └────────────────────────────────────┘
```

## Key decisions and tradeoffs

| Decision | Why | Tradeoff |
|---|---|---|
| Store HTML, not a custom JSON document model | Smallest path to working formatting; import from Markdown produces the same shape | Schema is loose; a richer model would make collaboration and export easier |
| React for the UI, `contenteditable` + `execCommand` for editing | React gives clear components and state; the editor body stays outside React's render cycle so the caret isn't reset, and autosave state lives in refs | `execCommand` is deprecated; edge cases in list and heading behavior across browsers |
| Server-side sanitizer as an allowlist | Failing closed is safer than trying to strip known-bad patterns | Any future formatting (links, images, tables) needs an explicit addition |
| Mock login (user id as bearer token) | Satisfies the brief without auth infrastructure; reviewers can switch users in one click | Not secure. Would be replaced by real sessions or OAuth before any real use |
| Two roles: owner and editor | Covers owned vs. shared and gives sharing clear intent | No view-only role. Adding one means a `role` field per share and checks in `loadDocument` |
| Owner-only hard delete (`DELETE /api/documents/:id`, `204`) | Deletion removes the document for every collaborator, so only the owner should decide. A confirm dialog guards against misclicks. Removing the record outright keeps the store simple | No trash or undo, so a deleted document is gone for good. Editors have no way to "leave" a shared document. Soft delete (a `deletedAt` field filtered out in `listForUser` and `loadDocument`) would fix the first |
| JSON-file store | Zero install, survives restarts, easy to inspect | Whole-file rewrites on each save; single process only. Fine at demo scale |
| Last write wins on save | Simple and predictable for one active editor | Concurrent editors can overwrite each other. Needs OT/CRDT or at least version checks |
| Autosave with a debounced PUT of full HTML | Simple; documents are small | Large documents would need diffs or patches |

## Security posture

- Bearer tokens are user ids, so anyone can impersonate any seeded user. This is deliberate for the demo and is stated in the README.
- Content Security Policy on HTML and static files: `script-src 'self'`, no inline scripts, `object-src 'none'`.
- `X-Content-Type-Options: nosniff` on all responses; `Cache-Control: no-store` on API responses.
- Path traversal on static files is blocked by checking the resolved path stays inside the built `dist/` folder.
- Request bodies are size-limited (64 KB for small JSON, 1 MB for imports, 8 MB raw for content saves, which is then capped at 4 MB of sanitized HTML).
- Titles are length-limited and stripped of control characters.

## Known gaps

- No real-time sync or presence indicators.
- If an owner deletes a document while a collaborator has it open, the collaborator's next autosave gets `404`. The editor shows "Save failed: Document not found" and keeps retrying instead of explaining that the document was deleted. Unsaved edits in that tab are lost.
- The browser flushes unsaved changes on `pagehide` using `keepalive`, which browsers cap at about 64 KB. Very large documents might not flush on close; Ctrl+S or the normal autosave handles them.
- The editor has no undo/redo beyond the browser's native contenteditable history, which resets when a document is reloaded.
- The UI was checked for syntax and exercised through the API tests. It has not yet been walked through in a browser (see `SUBMISSION.md`).

## What I would build next (about 2–4 hours)

1. Move document content to a structured model (ProseMirror or Tiptap JSON) and render with a schema, so export and collaboration are straightforward.
2. Add optimistic concurrency: send a version number with each save and reject stale writes with a conflict prompt.
3. Replace the JSON file with SQLite (`node:sqlite` or `better-sqlite3`) and add migrations.
4. Add a view-only role and a "copy link for collaborator" flow.
5. Soft delete with a trash view, a "leave document" action for editors, and a clear "this document was deleted" state in open editors instead of a retry loop.
6. Real authentication (magic link or OAuth) and CSRF protection on mutating routes.
