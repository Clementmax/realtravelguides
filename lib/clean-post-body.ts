const DATE_RE =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+\d{4}$/i;
const MIN_READ_RE = /^\d+\s+min(?:ute)?s?\s+read$/i;
const UPDATED_RE =
  /^updated:\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+\d{4}$/i;

function htmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isWixNavList(html: string): boolean {
  if (/header-navigation/i.test(html)) return true;
  const text = htmlText(html).toLowerCase();
  return (
    text.includes("journeys by rail") &&
    text.includes("switzerland") &&
    text.includes("hidden places")
  );
}

/** Strip Wix chrome Readability captured at the start of some article bodies. */
export function stripMigratedPostChrome(body: string): string {
  if (!body) return body;

  let html = body.replace(/^\uFEFF/, "").trim();

  const list = html.match(/^<(ul|ol)\b[\s\S]*?<\/\1>/i);
  if (list && isWixNavList(list[0])) {
    html = html.slice(list[0].length).trim();
  }

  while (true) {
    const empty = html.match(
      /^<(p|div|h[1-6])\b[^>]*>\s*(?:&nbsp;|\s)*<\/\1>/i
    );
    if (empty) {
      html = html.slice(empty[0].length).trim();
      continue;
    }

    const paragraph = html.match(/^<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!paragraph) break;

    const text = htmlText(paragraph[1]);
    if (
      !text ||
      DATE_RE.test(text) ||
      UPDATED_RE.test(text) ||
      MIN_READ_RE.test(text) ||
      /^search$/i.test(text)
    ) {
      html = html.slice(paragraph[0].length).trim();
      continue;
    }
    break;
  }

  return html;
}
