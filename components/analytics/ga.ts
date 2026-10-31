export const CONSENT_COOKIE = "rtg_analytics_consent";
export const OPEN_COOKIE_SETTINGS_EVENT = "rtg-open-cookie-settings";

const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type AnalyticsConsent = "granted" | "denied";

type ConsentState = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __rtgGaConfigured?: boolean;
  }
}

export const CONSENT_DEFAULT_SCRIPT = `
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
window.gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
(function () {
  var match = document.cookie.match(/(?:^|; )rtg_analytics_consent=(granted|denied)(?:;|$)/);
  if (!match || match[1] !== 'granted') return;
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
})();
`.trim();

function consentPayload(analytics: ConsentState) {
  return {
    analytics_storage: analytics,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  };
}

export function readConsent(): AnalyticsConsent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    /(?:^|; )rtg_analytics_consent=(granted|denied)(?:;|$)/,
  );
  return match ? (match[1] as AnalyticsConsent) : null;
}

export function writeConsent(value: AnalyticsConsent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function setGaCollection(measurementId: string, enabled: boolean) {
  const flag = `ga-disable-${measurementId}`;
  (window as unknown as Record<string, boolean>)[flag] = !enabled;
}

export function updateGtagConsent(analytics: ConsentState) {
  if (typeof window.gtag !== "function") return;
  window.gtag("consent", "update", consentPayload(analytics));
}

export function configureGtag(measurementId: string) {
  if (typeof window.gtag !== "function" || window.__rtgGaConfigured) return;
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
  window.__rtgGaConfigured = true;
}

export function trackPageView(pagePath: string) {
  if (readConsent() !== "granted" || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackNewsletterSignup(result: "subscribed" | "already_subscribed") {
  if (readConsent() !== "granted" || typeof window.gtag !== "function") return;
  window.gtag("event", "newsletter_signup", { result });
}

export function isGuideOutboundHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "mybook.to" || host.endsWith(".mybook.to")) return true;
  return /(^|\.)amazon\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})$/.test(host);
}

export function clearGaCookies() {
  const names = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0] ?? "")
    .filter((name) => name === "_ga" || name === "_gid" || name.startsWith("_ga_"));

  if (names.length === 0) return;

  const host = window.location.hostname;
  const domains = new Set<string>();
  if (host.includes(".")) {
    domains.add(host);
    domains.add(`.${host}`);
    const parts = host.split(".");
    if (parts.length >= 2) domains.add(`.${parts.slice(-2).join(".")}`);
  }

  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Domain=${domain}; Max-Age=0; SameSite=Lax`;
    }
  }
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}
