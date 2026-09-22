/** Canonical URL slug: decode percent-encoding and strip diacritics. */
export function normalizePostSlug(slug: string): string {
  if (!slug) return "";
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // already decoded, or malformed encoding
  }
  return decoded
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}
