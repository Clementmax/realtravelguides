import Image from "next/image";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M14 9.5h2.5V6.2h-2.5c-2.2 0-3.6 1.5-3.6 3.7v1.9H8v3.2h2.4V21h3.3v-6h2.4l.4-3.2h-2.8V10c0-.7.3-1.5 1.3-1.5Z"
        fill="currentColor"
      />
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-border-line bg-paper-raised">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/logo.png"
              alt="Real Travel Guides"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <h3 className="font-display text-lg font-semibold text-pine">
              Real Travel Guides
            </h3>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone">
            A small independent publisher dedicated to helping travelers explore
            the world independently and responsibly — no organized tours, no
            rigid schedules, just practical advice from local experts.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium uppercase tracking-wide text-stone">
            Contact
          </h4>
          <p className="mt-3 text-sm text-stone">
            For general inquiries:{" "}
            <a
              href="mailto:realtravelguides@gmail.com"
              className="text-moss underline underline-offset-2"
            >
              realtravelguides@gmail.com
            </a>
          </p>
          <div className="mt-4 flex gap-3">
            <a
              href="https://www.instagram.com/real_travel_guides/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Real Travel Guides on Instagram"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border-line text-stone transition-colors hover:border-moss hover:text-moss"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61577219447339"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Real Travel Guides on Facebook"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border-line text-stone transition-colors hover:border-moss hover:text-moss"
            >
              <FacebookIcon />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-border-line px-6 py-5 text-center text-xs text-stone-light">
        © {new Date().getFullYear()} Real Travel Guides
      </div>
    </footer>
  );
}
