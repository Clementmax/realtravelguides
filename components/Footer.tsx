import Newsletter from "@/components/Newsletter";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
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
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <p className="eyebrow text-clay-dark">Connect with us</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-pine">
          Stay connected with Real Travel Guides
        </h2>

        <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-stone">
              Follow our journeys
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-stone">
              Inspiration for scenic rail routes, car-free escapes and remarkable
              places across Europe.
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href="https://www.instagram.com/real_travel_guides/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Real Travel Guides on Instagram"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border-line text-stone transition-colors hover:border-moss hover:text-moss"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61577219447339"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Real Travel Guides on Facebook"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border-line text-stone transition-colors hover:border-moss hover:text-moss"
              >
                <FacebookIcon />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-stone">
              Subscribe
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-stone">
              New rail routes, independent travel ideas and special offers —
              delivered straight to your inbox.
            </p>
            <div className="mt-4">
              <Newsletter variant="footer" />
            </div>
          </div>

          <div id="contact" className="scroll-mt-8">
            <h3 className="text-xs font-medium uppercase tracking-wide text-stone">
              Contact us
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-stone">
              Have a question about Real Travel Guides?
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              <a
                href="mailto:realtravelguides@gmail.com"
                className="text-moss underline underline-offset-2"
              >
                realtravelguides@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-border-line px-6 py-5 text-center text-xs text-stone-light">
        © {new Date().getFullYear()} Real Travel Guides
      </div>
    </footer>
  );
}
