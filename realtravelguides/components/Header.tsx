import Link from "next/link";

const navLinks = [
  { href: "/journeysbyrail", label: "Journeys by rail" },
  { href: "/books", label: "Books" },
  { href: "/elenarossetti", label: "Elena Rossetti" },
  { href: "/sophiepicot", label: "Sophie Picot" },
];

export default function Header() {
  return (
    <header className="border-b border-border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-pine">
          Real Travel Guides
        </Link>
        <nav className="hidden gap-6 text-sm text-stone md:flex">
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
      </div>
    </header>
  );
}
