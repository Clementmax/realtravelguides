import Image from "next/image";
import Link from "next/link";

export default function DestinationCard({
  slug,
  label,
  image,
}: {
  slug: string;
  label: string;
  image: string;
}) {
  return (
    <Link
      href={`/journeysbyrail/categories/${slug}`}
      className="group relative block aspect-[3/4] overflow-hidden rounded-md"
    >
      <Image
        src={image}
        alt={label}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/0 to-ink/0" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="eyebrow text-paper/70">Explore</p>
        <p className="mt-1 font-display text-lg font-semibold text-paper">
          {label}
        </p>
      </div>
    </Link>
  );
}
