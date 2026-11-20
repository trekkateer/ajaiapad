# Submission

## Included

| Path | What it is |
|---|---|
| `README.md` | Setup, run, test and demo instructions; feature list; limitations |
| `ARCHITECTURE.md` | Architecture note: priorities, decisions, tradeoffs, security posture, next steps |
| `AI_WORKFLOW.md` | AI workflow note: tools, where AI helped, what was changed or rejected, verification |
| `SUBMISSION.md` | This file |
| `package.json` | Scripts (`start`, `test`); no runtime dependencies |
| `server/index.js` | Entry point; seeds demo data on first run |
| `server/app.js` | HTTP API, auth, access rules, validation, static serving |
| `server/store.js` | JSON-file persistence |
| `server/sanitize.js` | Server-side HTML allowlist |
| `server/convert.js` | `.txt` / `.md` import conversion |
| `client/` | React UI (Vite): `index.html`, `src/` (App, components, api, styles) |
| `vite.config.js` | Vite build and dev-proxy config |
| `test/api.test.js`, `test/sanitize.test.js`, `test/convert.test.js` | 33 automated tests (all passing) |

## Working

- Create, rename and autosave documents; reopen after refresh
- Bold, italic, underline, headings, bulleted and numbered lists
- Import `.txt` and `.md` (up to 1 MB) as new documents; other types are rejected in the UI and on the server
- Sharing: owner shares by username and revokes access; shared users can edit and rename
- "Owned by you" and "Shared with you" sections on the dashboard
- Persistence in a JSON file across restarts
- Access control with 404 for non-collaborators
- Server-side HTML sanitization on every save and import

## Incomplete or not yet done

- **Live deployment URL: not done.** No hosting account was available during this pass. The app is a single Node process with no dependencies, so it deploys to Render, Railway or Fly with `npm start` and a persistent volume for `DATA_FILE`.
- **Walkthrough video: not done.** Needs to be recorded by the candidate (3–5 min). The URL should go in a separate text file once recorded.
- **Google Drive folder link: not done.** This package should be uploaded to a shared Drive folder and the link added here.
- **Browser walkthrough of the UI: not done.** Covered by the API tests and a syntax check only. See `AI_WORKFLOW.md`.
- **Screenshots or GIF: not included.** Recommended for the Drive folder.

## Test accounts

No passwords. Pick one on the login screen.

| Username | Name |
|---|---|
| `alice` | Alice Chen (owns "Welcome to AjaiaPad", shared with Bob) |
| `bob` | Bob Okafor (editor on Alice's welcome document) |
| `carol` | Carol Mendes (no access to Alice's document) |

## Run

```bash
npm install
npm start      # builds the React app, then http://localhost:3000
npm test       # 33 tests
```

## What I would build next with 2–4 more hours

See the "What I would build next" section in `ARCHITECTURE.md`.
