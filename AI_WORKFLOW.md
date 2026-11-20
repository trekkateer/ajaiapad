# AI workflow note

## Tools used

- **Claude** (Anthropic), working as a coding agent in a sandboxed shell. It wrote the first version of every file in this repository in one pass, ran the test suite, and smoke-tested the running server.

## Where AI materially sped up the work

- **Scaffolding in one pass.** The whole server, client and test suite were drafted together, so the access rules, the API shapes and the UI calls stayed consistent with each other from the start.
- **Test coverage.** Generating the access-control and sanitizer test cases alongside the code made it cheap to cover the permission matrix (owner, editor, non-collaborator, revoked user) and the XSS cases.
- **Boilerplate.** Static file serving with traversal protection, request-body size limits and the CSP header are routine and were produced quickly.

## What I reviewed, changed or would reject

- **Scope.** I kept the feature set to the brief's required items and deliberately left out real-time collaboration, version history and PDF export. Those were easy to draft and would have diluted the core loop.
- **Auth.** Chose a mock bearer-token scheme (user id as token) so reviewers can switch users in one click. It is documented as insecure and is the first thing to replace before any real use.
- **Sanitizer.** Reviewed the allowlist logic by hand: attributes are dropped, script and style blocks are removed before tag processing, stray `<` is escaped, and `b`/`i` are normalized to `strong`/`em`. I added tests for each of these cases.
- **Error semantics.** Chose `404` instead of `403` for non-collaborators so ids don't reveal existence. This is a judgment call I would revisit if reviewers expect `403`.
- **Editor approach.** I used `contenteditable` with `execCommand` rather than a full editor library. This is faster to ship without dependencies, but I'd flag `execCommand` as deprecated in the write-up and as the first thing to replace.

## React conversion (second pass)

- Converted the vanilla UI to React and Vite in one pass. Components, hooks and the API wrapper were drafted together.
- Kept the server unchanged apart from pointing static serving at `dist/`, so the API tests needed only a fixture folder.
- I rejected a state library (Redux, Zustand) and a router library. The app has three views and one URL pattern, so `useState` plus a hash hook is enough.
- Editor content stays in the DOM, not React state, so typing never resets the caret. Save state lives in refs.

## Delete documents (third pass)

- Claude added `DELETE /api/documents/:id`, a `deleteDocument` method in the store, and two delete buttons in the UI: one on each owned document in the dashboard and one in the editor header. Both appear only for owners and both ask for confirmation.
- **Permission choice.** Only the owner can delete. Editors get `403` (they already know the document exists), and everyone else still gets `404`. This reuses the existing `requireOwner` helper instead of adding a new access path.
- **Hard delete over soft delete.** I chose to remove the record outright, which is simplest for a JSON store. The tradeoff is no undo, and that is recorded in `ARCHITECTURE.md`.
- **Editor edge case I checked.** The editor flushes unsaved changes when it unmounts, so deleting from the editor would have sent a `PUT` to a document that no longer exists. Pending edits are now cleared before the delete request. If the delete fails, they are restored and autosave resumes.
- **Gap I chose not to fix.** A collaborator who has the document open when the owner deletes it sees a save-failure retry loop instead of a clear message. This is noted as a known gap.
- **Tests.** Added one API test covering the permission matrix (owner `204`; editor `403`; non-collaborator `404`; no token `401`), the document disappearing from the collaborator's list, and a repeat delete returning `404`. The file-store test now also checks that a deletion survives a reload.

## How I verified correctness, UX quality and reliability

- **Automated tests.** `npm test` runs 33 tests on Node's built-in test runner. All pass on the final code.
- **Syntax check.** `node --check` on the browser script.
- **Live smoke test.** Started the server against a temporary data file, logged in as a seeded user, listed documents, and confirmed static assets are served with the expected content type.
- **Headless browser check.** After the React conversion I drove the built app in headless Chrome: logged in, created a document, renamed it, bolded text, waited for autosave, shared with another user, reloaded, and confirmed the content and title persisted with no JavaScript errors.
- **Delete feature.** Verified by the API tests and a successful `vite build`. The delete buttons and confirm dialog have not yet been clicked through in a browser.
- **Not yet verified.** Visual polish and behavior in Firefox/Safari, and the walkthrough recording itself, still need a human pass.
