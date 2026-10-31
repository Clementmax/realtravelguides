"use client";

import { openCookieSettings } from "@/components/analytics/ga";

export default function CookieSettingsLink() {
  return (
    <button
      type="button"
      className="inline cursor-pointer border-0 bg-transparent p-0 text-xs text-stone-light underline underline-offset-2 transition-colors hover:text-moss"
      onClick={openCookieSettings}
    >
      Cookie settings
    </button>
  );
}
