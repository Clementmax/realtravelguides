"use client";

import { useState } from "react";

export default function Newsletter({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );

  const dark = variant === "dark";

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

  if (dark) {
    return (
      <div>
        {status === "done" ? (
          <p className="text-sm font-medium text-paper">
            Thanks for subscribing.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-md gap-2"
          >
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-paper/20 bg-paper/10 px-3 py-2.5 text-sm text-paper placeholder:text-paper/40 focus:outline-none focus:ring-2 focus:ring-clay"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="whitespace-nowrap rounded-md bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-raised disabled:opacity-60"
            >
              {status === "loading" ? "Signing up…" : "Subscribe"}
            </button>
          </form>
        )}
        {status === "error" && (
          <p className="mt-2 text-xs text-clay">Enter a valid email first.</p>
        )}
      </div>
    );
  }

  return (
    <div className="ticket-edge rounded-lg border border-border-line bg-paper-raised px-6 py-6 md:flex md:items-center md:justify-between md:gap-8">
      <div>
        <p className="font-display text-lg font-semibold text-pine">
          Keep abreast of updates
        </p>
        <p className="mt-1 text-sm text-stone">
          New routes and honest travel notes, straight to your inbox. No
          spam, unsubscribe whenever.
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
