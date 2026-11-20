# AjaiaPad

A lightweight collaborative document editor inspired by Google Docs. Create and rename documents, edit rich text in the browser, import `.txt` / `.md` files, share documents with other users, and reopen everything after a refresh.

## Requirements
- Node.js 18.17 or newer (tested on Node 22)
- npm (ships with Node)
- No database and no paid services

## Run locally
```bash
npm install
npm run build     # builds the React app into dist/
npm start         # http://localhost:3000 (npm start also builds first)
```

For development with hot reload, run two terminals:

```bash
npm run dev:server   # API on http://localhost:3000
npm run dev          # UI on http://localhost:5173 (proxies /api to :3000)
```

Options (environment variables):

| Variable    | Default              | Purpose                          |
|-------------|----------------------|----------------------------------|
| `PORT`      | `3000`               | HTTP port                        |
| `DATA_FILE` | `data/store.json`    | Where documents are persisted    |

Delete `data/store.json` to reset to the seeded state.

## Run the tests

```bash
npm test
```

33 tests across three files:

- `test/api.test.js`: access control, sharing, deletion, import validation, sanitization on save, static-file safety, file store round-trip.
- `test/sanitize.test.js`: HTML allowlist (script removal, attribute stripping, `javascript:` links, stray `<`).
- `test/convert.test.js`: `.txt` and `.md` to HTML conversion.

## Demo accounts

Login is a mock: pick a user from the dropdown. There is no password. These accounts are seeded:

| Username | Name         |
|----------|--------------|
| `alice`  | Alice Chen   |
| `bob`    | Bob Okafor   |
| `carol`  | Carol Mendes |

On first run, Alice owns **"Welcome to AjaiaPad"** and it is shared with Bob. Log in as Bob to see it under "Shared with you".

Suggested review flow:

1. Log in as `alice`, create a document, type some text and apply bold, italic, underline, headings and lists.
2. Open the Sharing panel and share it with `bob`.
3. Log out, log in as `bob`. The document appears under "Shared with you". Edit it.
4. Log in as `carol`. The document is not visible, and a direct link returns "Document not found".

## Features

- **Create / rename / edit / save.** Autosave runs about 0.8 s after you stop typing. Ctrl+S saves immediately. Titles are editable inline.
- **Formatting.** Bold, italic, underline, Heading and Subheading, Normal text, bulleted and numbered lists. Keyboard shortcuts from the browser (Ctrl+B / I / U) also work.
- **Import.** `.txt` and `.md` files up to 1 MB become new documents. Markdown headings, lists, bold and italic are converted. Other file types are rejected with a clear message, both in the UI and on the server.
- **Sharing.** Each document has one owner. The owner can share with another user by username and can revoke access. Shared users are editors: they can read, edit and rename, but cannot change sharing. The dashboard separates "Owned by you" from "Shared with you".
- **Persistence.** Documents, formatting and sharing state are stored in a JSON file (`DATA_FILE`) and survive restarts.

## Limitations (by design)

- Mock authentication. The bearer token is the user id. Do not expose this build to real users.
- Last write wins. There is no real-time collaboration and no conflict merge, so two people editing the same document at once can overwrite each other.
- Rich text uses `document.execCommand`, which is deprecated but still supported in all major browsers. A production build would move to a structured editor model (for example ProseMirror, Tiptap or Lexical).
- No export, version history or comments. Deleting a document is permanent (no trash or undo).
- Upload limits: `.txt` and `.md` only, 1 MB maximum.

See `ARCHITECTURE.md` for design decisions and `SUBMISSION.md` for what is and isn't included.

## Project layout
```
client/                 React front end (Vite)
  index.html
  src/
    main.jsx            React entry point
    App.jsx             routing (hash-based), session, header
    api.js              fetch wrapper and session token
    utils.js            shared helpers and import rules
    styles.css
    components/
      Login.jsx
      Dashboard.jsx     owned / shared lists, new document, import
      Editor.jsx        contenteditable editor, autosave, rename
      Toolbar.jsx       formatting buttons
      ShareSection.jsx  owner-only sharing controls
server/
  index.js              entry point, seeds demo data, starts the server
  app.js                HTTP routing, auth, access checks, validation
  store.js              JSON-file persistence and data operations
  sanitize.js           server-side HTML allowlist
  convert.js            .txt / .md to HTML
test/                   node:test suites (API, sanitizer, converter)
vite.config.js          Vite config (root: client, output: dist)
dist/                   generated production build (not committed)
```

