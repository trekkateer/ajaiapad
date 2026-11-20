'use strict';

// Turns uploaded .txt and .md files into HTML that the editor can load.
// The output still goes through sanitizeHtml() before it is stored.

const ALLOWED_EXTENSIONS = ['.txt', '.md'];

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(escaped) {
  return escaped
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>');
}

function normalizeText(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function plainTextToHtml(text) {
  return normalizeText(text)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => `<p>${escapeHtml(line.trim())}</p>`)
    .join('\n');
}

function markdownToHtml(text) {
  const out = [];
  let openList = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (openList) {
      out.push(`</${openList}>`);
      openList = null;
    }
  };

  for (const rawLine of normalizeText(text).split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${formatInline(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (openList !== 'ul') {
        closeList();
        out.push('<ul>');
        openList = 'ul';
      }
      out.push(`<li>${formatInline(escapeHtml(bullet[1]))}</li>`);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (openList !== 'ol') {
        closeList();
        out.push('<ol>');
        openList = 'ol';
      }
      out.push(`<li>${formatInline(escapeHtml(numbered[1]))}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${formatInline(escapeHtml(line.trim()))}</p>`);
  }

  closeList();
  return out.join('\n');
}

function convertUpload(extension, text) {
  if (extension === '.md') return markdownToHtml(text);
  if (extension === '.txt') return plainTextToHtml(text);
  throw new Error(`Unsupported extension: ${extension}`);
}

module.exports = { ALLOWED_EXTENSIONS, convertUpload, markdownToHtml, plainTextToHtml, escapeHtml };
