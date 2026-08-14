import { Post } from "@/lib/types";

// NOTE: excerpt/body below are placeholders. During migration, copy the full
// post body text from the Wix editor for each post and paste it in here (or
// directly into the `posts` table in Supabase) — see MIGRATION.md.
export const posts: Post[] = [
  {
    slug: "madrid-to-siguenza-by-train-a-medieval-escape-into-the-heart-of-castile",
    title: "Madrid to Sigüenza by Train: A Medieval Escape into the Heart of Castile",
    excerpt:
      "A day trip from Madrid into one of Castile's best-kept medieval secrets, reachable entirely by rail.",
    cover: "/images/posts/siguenza.jpg",
    category: "spain",
    read_minutes: 7,
    published_at: "2025-01-01",
    body: "[Full post body to be migrated from Wix — see MIGRATION.md]",
  },
  {
    slug: "around-mount-etna-by-train-sicily-s-most-extraordinary-railway-journey",
    title: "Around Mount Etna by Train: Sicily's Most Extraordinary Railway Journey",
    excerpt:
      "Circling an active volcano on one of Europe's most unusual narrow-gauge railways.",
    cover: "/images/posts/mount-etna.jpg",
    category: "italy",
    read_minutes: 5,
    published_at: "2025-01-01",
    body: "[Full post body to be migrated from Wix — see MIGRATION.md]",
  },
  {
    slug: "lucerne-to-st-gallen-on-the-voralpen-express-switzerland-beyond-the-high-alps",
    title: "Lucerne to St Gallen on the Voralpen-Express: Switzerland Beyond the High Alps",
    excerpt:
      "A gentler side of Switzerland's rail network, away from the famous high-alpine panoramic routes.",
    cover: "/images/posts/st-gallen.jpg",
    category: "switzerland",
    read_minutes: 6,
    published_at: "2025-01-01",
    body: "[Full post body to be migrated from Wix — see MIGRATION.md]",
  },
  {
    slug: "bellinzona-to-lucerne-across-switzerland-on-the-historic-gotthard-route",
    title: "Bellinzona to Lucerne: Across Switzerland on the Historic Gotthard Route",
    excerpt:
      "Tracing one of the great historic rail crossings of the Alps, from Ticino to central Switzerland.",
    cover: "/images/posts/bellinzona.jpg",
    category: "scenicroutes",
    read_minutes: 6,
    published_at: "2025-01-01",
    body: "[Full post body to be migrated from Wix — see MIGRATION.md]",
  },
  {
    slug: "train-des-pignes-discover-provence-s-hidden-railway-from-nice-to-digne-les-bains",
    title: "Train des Pignes: Discover Provence's Hidden Railway from Nice to Digne-les-Bains",
    excerpt:
      "A narrow-gauge line into Provence's lavender-scented back country, far from the Riviera crowds.",
    cover: "/images/posts/digne-les-bains.jpg",
    category: "france",
    read_minutes: 4,
    published_at: "2025-01-01",
    body: "[Full post body to be migrated from Wix — see MIGRATION.md]",
  },
  {
    slug: "marseille-to-ventimiglia-by-train-one-of-europe-s-most-beautiful-coastal-rail-journeys",
    title: "Marseille to Ventimiglia by Train: One of Europe's Most Beautiful Coastal Rail Journeys",
    excerpt:
      "Hugging the Mediterranean from Marseille through the French Riviera and across the Italian border.",
    cover: "/images/posts/menton.jpg",
    category: "france",
    read_minutes: 4,
    published_at: "2025-01-01",
    body: "[Full post body to be migrated from Wix — see MIGRATION.md]",
  },
];
