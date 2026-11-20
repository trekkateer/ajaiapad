'use strict';

// Server-side allowlist sanitizer for document HTML.
// Every stored document passes through here, so the browser never receives
// markup outside this list. Attributes are dropped entirely, which removes
// event handlers, `javascript:` URLs and inline styles in one step.

const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'blockquote'];
const ALLOWED_SET = new Set(ALLOWED_TAGS);
const TAG_ALIASES = { b: 'strong', i: 'em' };

const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const ALLOWED_TAG_TEXT = new RegExp(`<(?!\\/?(?:${ALLOWED_TAGS.join('|')})>)`, 'g');

function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';

  const withoutDangerous = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROP_WITH_CONTENT, '');

  const rewritten = withoutDangerous.replace(/<\/?[a-zA-Z][^>]*>/g, (tag) => {
    const match = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
    const closing = match[1] === '/';
    const original = match[2].toLowerCase();
    const name = TAG_ALIASES[original] || original;
    if (!ALLOWED_SET.has(name)) return ''; // unknown tags are dropped, their text is kept
    if (name === 'br') return '<br>';
    return closing ? `</${name}>` : `<${name}>`;
  });

  // Any remaining "<" that does not begin an allowed tag is escaped as text.
  return rewritten.replace(ALLOWED_TAG_TEXT, '&lt;').trim();
}

module.exports = { sanitizeHtml, ALLOWED_TAGS };
