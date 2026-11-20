'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeHtml } = require('../server/sanitize');

test('keeps allowed formatting tags', () => {
  assert.equal(sanitizeHtml('<h1>Title</h1><p>Hi <strong>there</strong></p>'),
    '<h1>Title</h1><p>Hi <strong>there</strong></p>');
});

test('maps legacy b and i to strong and em', () => {
  assert.equal(sanitizeHtml('<b>bold</b> and <i>italic</i>'), '<strong>bold</strong> and <em>italic</em>');
});

test('drops attributes, so event handlers and inline styles cannot survive', () => {
  assert.equal(sanitizeHtml('<p onclick="alert(1)" style="color:red">x</p>'), '<p>x</p>');
});

test('removes script and style blocks entirely', () => {
  assert.equal(sanitizeHtml('<script>alert(1)</script><p>ok</p><style>p{}</style>'), '<p>ok</p>');
});

test('drops disallowed tags but keeps their text', () => {
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">link</a>'), 'link');
  assert.equal(sanitizeHtml('<img src=x onerror=alert(1)>'), '');
});

test('escapes stray angle brackets so they stay text', () => {
  assert.equal(sanitizeHtml('1 < 2 and <p>ok</p>'), '1 &lt; 2 and <p>ok</p>');
});

test('removes HTML comments', () => {
  assert.equal(sanitizeHtml('<p>a</p><!-- hidden --><p>b</p>'), '<p>a</p><p>b</p>');
});

test('returns empty string for non-string input', () => {
  assert.equal(sanitizeHtml(undefined), '');
  assert.equal(sanitizeHtml(42), '');
});
