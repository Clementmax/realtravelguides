"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/journeysbyrail", label: "Journeys by rail" },
  { href: "/books", label: "Books" },
  { href: "/about", label: "About" },
];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <header className="border-b border-border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/images/logo.png"
            alt="Real Travel Guides"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
          />
          <span className="whitespace-nowrap font-display text-lg font-semibold tracking-tight text-pine">
            Real Travel Guides
          </span>
        </Link>
        <nav className="hidden flex-wrap justify-end gap-x-6 gap-y-2 text-sm text-stone md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-moss"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="shrink-0 p-2 text-pine md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
      <nav
        id="mobile-nav"
        className={`border-t border-border-line md:hidden ${open ? "block" : "hidden"}`}
      >
        <div className="mx-auto flex max-w-5xl flex-col px-3 py-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-3.5 text-sm text-stone transition-colors hover:text-moss"
              onClick={(event) => {
                event.preventDefault();
                navigate(link.href);
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
