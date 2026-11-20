export const MAX_IMPORT_BYTES = 1024 * 1024;
export const IMPORT_TYPES = ['.txt', '.md'];

export function extensionOf(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const docHref = (id) => `#/doc/${id}`;
