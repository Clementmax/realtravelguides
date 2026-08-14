"use client";

import { useState } from "react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="ticket-edge rounded-lg border border-border-line bg-paper-raised px-6 py-6 md:flex md:items-center md:justify-between md:gap-8">
      <div>
        <p className="font-display text-lg font-semibold text-pine">
          Real Travel Curated
        </p>
        <p className="mt-1 text-sm text-stone">
          Handpicked insider secrets, local favorites, and cultural finds —
          delivered to your inbox every week.
        </p>
      </div>
      {status === "done" ? (
        <p className="mt-4 text-sm font-medium text-moss md:mt-0">
          Thanks for subscribing.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex gap-2 md:mt-0 md:shrink-0"
        >
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border-line bg-paper px-3 py-2 text-sm text-pine placeholder:text-stone-light focus:outline-none focus:ring-2 focus:ring-moss md:w-56"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="whitespace-nowrap rounded-md bg-moss px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-moss-dark disabled:opacity-60"
          >
            {status === "loading" ? "Signing up…" : "Sign up"}
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="mt-2 text-xs text-clay-dark md:hidden">
          Enter a valid email first.
        </p>
      )}
    </div>
  );
}
