"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  clearGaCookies,
  configureGtag,
  isGuideOutboundHost,
  readConsent,
  setGaCollection,
  trackPageView,
  updateGtagConsent,
  writeConsent,
  type AnalyticsConsent,
} from "@/components/analytics/ga";

function ConsentBanner({
  onChoose,
}: {
  onChoose: (value: AnalyticsConsent) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="rtg-cookie-title"
      className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto border-t border-border-line bg-paper px-4 py-4 shadow-[0_-6px_24px_rgba(31,46,39,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="rtg-cookie-title" className="text-sm leading-relaxed text-pine">
          Analytics is optional. If you accept, Google Analytics helps us see
          which pages and guides are useful. We don&apos;t use advertising
          cookies, and this choice is stored on your device.
        </p>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-80">
          <button
            type="button"
            className="min-h-11 rounded-md border border-pine bg-paper px-3 py-2.5 text-sm font-medium text-pine transition-colors hover:bg-paper-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            onClick={() => onChoose("denied")}
          >
            Essential only
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md border border-moss bg-moss px-3 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-moss-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine"
            onClick={() => onChoose("granted")}
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GoogleAnalytics({
  measurementId,
}: {
  measurementId: string;
}) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [gtagReady, setGtagReady] = useState(false);
  const lastPageTitle = useRef<string | null>(null);

  const handleGtagReady = useCallback(() => {
    if (readConsent() !== "granted") return;
    configureGtag(measurementId);
    setGtagReady(true);
  }, [measurementId]);

  useEffect(() => {
    const existing = readConsent();
    setConsent(existing);
    setBannerOpen(existing === null);
  }, []);

  useEffect(() => {
    const open = () => setBannerOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (readConsent() !== "granted" || typeof window.gtag !== "function") return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (!isGuideOutboundHost(url.hostname)) return;

      window.gtag("event", "guide_outbound_click", {
        link_url: url.href,
        link_domain: url.hostname,
        page_path: window.location.pathname,
      });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!gtagReady || consent !== "granted") return;
    let cancelled = false;
    let frames = 0;
    let timer = 0;

    const tick = () => {
      if (cancelled) return;
      frames += 1;
      const title = document.title;
      const previous = lastPageTitle.current;
      const settled =
        title.length > 0 && (previous === null || title !== previous);
      if (settled || frames >= 12) {
        lastPageTitle.current = title;
        trackPageView(pathname);
        return;
      }
      timer = window.setTimeout(tick, 50);
    };

    timer = window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname, gtagReady, consent]);

  function choose(value: AnalyticsConsent) {
    writeConsent(value);
    setConsent(value);
    setBannerOpen(false);

    if (value === "denied") {
      setGaCollection(measurementId, false);
      updateGtagConsent("denied");
      clearGaCookies();
      setGtagReady(false);
      return;
    }

    setGaCollection(measurementId, true);
    updateGtagConsent("granted");
    if (window.__rtgGaConfigured) setGtagReady(true);
  }

  if (!measurementId) return null;

  return (
    <>
      {consent === "granted" ? (
        <Script
          id="rtg-gtag"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
          onLoad={handleGtagReady}
          onReady={handleGtagReady}
        />
      ) : null}
      {bannerOpen ? <ConsentBanner onChoose={choose} /> : null}
    </>
  );
}
