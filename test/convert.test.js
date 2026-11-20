'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { markdownToHtml, plainTextToHtml, convertUpload } = require('../server/convert');

test('plain text becomes one paragraph per non-empty line and escapes markup', () => {
  const html = plainTextToHtml('First <b>line</b>\r\n\r\nSecond & last\n');
  assert.equal(html, '<p>First &lt;b&gt;line&lt;/b&gt;</p>\n<p>Second &amp; last</p>');
});

test('markdown headings map to h1 to h3', () => {
  assert.equal(markdownToHtml('# A\n## B\n### C'), '<h1>A</h1>\n<h2>B</h2>\n<h3>C</h3>');
});

test('markdown bullet and numbered lists open and close correctly', () => {
  const html = markdownToHtml('- one\n- two\n\n1. first\n2) second');
  assert.equal(html,
    '<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<ol>\n<li>first</li>\n<li>second</li>\n</ol>');
});

test('markdown bold and italic inline markers are converted', () => {
  assert.equal(markdownToHtml('This is **bold** and *soft*.'),
    '<p>This is <strong>bold</strong> and <em>soft</em>.</p>');
});

test('raw HTML inside markdown is escaped, not interpreted', () => {
  assert.equal(markdownToHtml('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

test('convertUpload rejects unknown extensions', () => {
  assert.throws(() => convertUpload('.pdf', 'x'), /Unsupported extension/);
});
