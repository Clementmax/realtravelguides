/** Canonical URL slug: decode percent-encoding and strip diacritics. */
export function normalizePostSlug(slug: string): string {
  if (!slug) return "";
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // already decoded, or malformed encoding
  }
  return stripDiacritics(decoded);
}

export function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/gi, "ae")
    .replace(/œ/gi, "oe")
    .replace(/ß/g, "ss")
    .normalize("NFC");
}

export function foldForSearch(value: string): string {
  return stripDiacritics(value || "").toLowerCase();
}
