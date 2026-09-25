"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "subscribed" | "already" | "invalid" | "error";

function confirmation(status: Status) {
  if (status === "subscribed") return "Thanks for subscribing.";
  if (status === "already") return "You're already subscribed.";
  return null;
}

function problem(status: Status) {
  if (status === "invalid") return "Please enter a valid email address.";
  if (status === "error") return "We couldn't subscribe you just now. Please try again.";
  return null;
}

export default function Newsletter({ variant = "light" }: { variant?: "light" | "dark" | "footer" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const dark = variant === "dark";
  const confirmed = confirmation(status);
  const issue = problem(status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as { result?: string } | null;
      if (res.status === 400) {
        setStatus("invalid");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      if (data?.result === "subscribed") {
        setStatus("subscribed");
        setEmail("");
        return;
      }
      if (data?.result === "already_subscribed") {
        setStatus("already");
        setEmail("");
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (variant === "footer") {
    return (
      <div>
        {confirmed ? (
          <p className="text-sm font-medium text-moss">{confirmed}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-w-0 rounded-md border border-border-line bg-paper px-3 py-2.5 text-sm text-pine placeholder:text-stone-light focus:outline-none focus:ring-2 focus:ring-moss sm:flex-1"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="whitespace-nowrap rounded-md bg-moss px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-moss-dark disabled:opacity-60"
            >
              {status === "loading" ? "Signing up…" : "Subscribe"}
            </button>
          </form>
        )}
        {issue && (
          <p className="mt-2 text-xs text-clay-dark">{issue}</p>
        )}
      </div>
    );
  }

  if (dark) {
    return (
      <div>
        {confirmed ? (
          <p className="text-sm font-medium text-paper">{confirmed}</p>
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
        {issue && <p className="mt-2 text-xs text-clay">{issue}</p>}
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
      {confirmed ? (
        <p className="mt-4 text-sm font-medium text-moss md:mt-0">{confirmed}</p>
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
      {issue && <p className="mt-2 text-xs text-clay-dark">{issue}</p>}
    </div>
  );
}
