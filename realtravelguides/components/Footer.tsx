export default function Footer() {
  return (
    <footer className="border-t border-border-line bg-paper-raised">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 md:grid-cols-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-pine">
            Real Travel Guides
          </h3>
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
          <div className="mt-4 flex gap-4 text-sm text-stone">
            <a
              href="https://www.instagram.com/real_travel_guides/"
              className="hover:text-moss"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61577219447339"
              className="hover:text-moss"
            >
              Facebook
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
