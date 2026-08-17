import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { href: "/journeysbyrail", label: "Journeys by rail" },
  { href: "/books", label: "Books" },
  { href: "/elenarossetti", label: "Elena Rossetti" },
  { href: "/sophiepicot", label: "Sophie Picot" },
];

export default function Header() {
  return (
    <header className="border-b border-border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/images/logo.png"
            alt="Real Travel Guides"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
          <span className="font-display text-lg font-semibold tracking-tight text-pine">
            Real Travel Guides
          </span>
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
