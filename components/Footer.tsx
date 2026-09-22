import Image from "next/image";

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
            Real Travel Guides is an independent publisher helping travellers
            explore Europe confidently and independently, through rail-led,
            car-free journeys that make it easier to travel at your own pace and
            experience more along the way.
          </p>
        </div>
        <div id="contact" className="scroll-mt-8">
          <h4 className="text-sm font-medium uppercase tracking-wide text-stone">
            Contact
          </h4>
          <p className="mt-3 text-sm leading-relaxed text-stone">
            Have a question about Real Travel Guides?
            <br />
            Contact us at{" "}
            <a
              href="mailto:realtravelguides@gmail.com"
              className="text-moss underline underline-offset-2"
            >
              realtravelguides@gmail.com
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-border-line px-6 py-5 text-center text-xs text-stone-light">
        © {new Date().getFullYear()} Real Travel Guides
      </div>
    </footer>
  );
}
