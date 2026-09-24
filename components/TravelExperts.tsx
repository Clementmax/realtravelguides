import Image from "next/image";

const TRAVEL_EXPERTS = [
  {
    name: "Elena Rossetti",
    role: "Author",
    photo: "/images/authors/elena-rossetti.jpg",
    bio: "Travel writer and tourism professional with over 20 years’ experience, specialising in independent rail travel across Europe. Elena is the principal author of the Touring by Train guides to Italy, Switzerland and Spain.",
  },
  {
    name: "Sophie Picot",
    role: "Author",
    photo: "/images/authors/sophie-picot.jpg",
    bio: "French travel writer and consultant with extensive first-hand knowledge of France by rail, combining local insight with a passion for independent, meaningful travel.",
  },
  {
    name: "Jonas Graf",
    role: "Contributor",
    photo: "/images/authors/jonas-graf.jpg",
    bio: "Switzerland-based rail specialist and regional researcher with expertise in sustainable tourism, alpine routes and Switzerland’s extensive national and regional rail network.",
  },
  {
    name: "Carla Ríos",
    role: "Contributor",
    photo: "/images/authors/carla-rios.jpg",
    bio: "Spain-based travel researcher and rail specialist, bringing local expertise in Spain’s rail network, regional cultures and authentic experiences beyond the major tourist hubs.",
  },
];

export default function TravelExperts() {
  return (
    <section className="bg-ink py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <p className="eyebrow text-paper/50">The People Behind the Guides</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-paper">
          Meet Our Travel Experts
        </h2>
        <p className="mt-2 max-w-lg text-sm text-paper/60">
          Written by experienced travel professionals and shaped by local
          expertise, every guide combines practical rail knowledge with genuine
          insight into the places you&apos;ll explore.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {TRAVEL_EXPERTS.map((expert) => (
            <div key={expert.name} className="group">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md">
                <Image
                  src={expert.photo}
                  alt={expert.name}
                  fill
                  className="object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>
              <p className="mt-4 text-xs uppercase tracking-wide text-paper/50">
                {expert.role}
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-paper">
                {expert.name}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper/60">
                {expert.bio}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
