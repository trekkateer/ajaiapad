"use strict";

const path = require("path");
const { createStore } = require("./store");
const { createServer } = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE =
  process.env.DATA_FILE || path.join(__dirname, "..", "data", "store.json");

const store = createStore({ filePath: DATA_FILE });

// First run only: give reviewers something to open and share.
if (store.count() === 0) {
  const welcome = store.createDocument({
    ownerId: "u_alice",
    title: "Welcome to AjaiaPad",
    content: [
      "<h1>Welcome to AjaiaPad</h1>",
      "<p>This document belongs to <strong>Alice</strong> and is shared with <strong>Bob</strong>.</p>",
      "<ul><li>Log in as Bob to see it under “Shared with you”.</li>",
      "<li>Try bold, italic, underline, headings and lists.</li>",
      "<li>Import a .txt or .md file from the dashboard.</li></ul>",
    ].join(""),
  });
  store.addShare(welcome.id, "u_bob");
}

createServer({ store }).listen(PORT, () => {
  console.log(`AjaiaPad running at http://localhost:${PORT}`);
});
