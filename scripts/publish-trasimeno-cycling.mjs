/**
 * Publish "Cycling Around Lake Trasimeno" from the Word doc assets.
 *
 * Images are expected at:
 *   public/images/posts/cycling-around-lake-trasimeno-a-perfect-car-free-day-in-umbria.jpg  (cover)
 *   public/images/blog/cycling-around-lake-trasimeno/image2.jpg … image8.jpg
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://orjsrwlemsxjyexqbfqo.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage:
 *   node scripts/publish-trasimeno-cycling.mjs --dry-run
 *   node scripts/publish-trasimeno-cycling.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

const SLUG = "cycling-around-lake-trasimeno-a-perfect-car-free-day-in-umbria";
const TITLE = "Cycling Around Lake Trasimeno: A Perfect Car-Free Day in Umbria";
const EXCERPT =
  "A 60-kilometre car-free circuit of Umbria's Lake Trasimeno by e-bike — coffee in Castiglione, lunch in Passignano, a swim, and ice cream in San Feliciano.";
const CATEGORIES = ["italy"];
const PUBLISHED_AT = new Date().toISOString().slice(0, 10);

const COVER = `/images/posts/${SLUG}.jpg`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function p(text) {
  return `<p>${text}</p>`;
}

function h2(text) {
  return `<h2>${escapeHtml(text)}</h2>`;
}

function a(href, text) {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function figure(src, alt, caption = "") {
  const cap = caption.trim()
    ? `<figcaption>${escapeHtml(caption.trim())}</figcaption>`
    : "";
  return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />${cap}</figure>`;
}

function buildBody() {
  const img = (n) => `/images/blog/cycling-around-lake-trasimeno/image${n}.jpg`;

  return [
    p("There are some landscapes you understand better when you travel through them slowly."),
    p("Lake Trasimeno is one of them."),
    p(
      "From a car, you see flashes of water between the trees, a succession of small towns and occasional views towards the islands."
    ),
    p("On a bicycle, the lake becomes the constant companion."),
    p(
      "Reeds move beside the path. Fishing boats sit offshore. Herons rise from the shallows. Hill towns appear across the water and disappear again as the shoreline curves away."
    ),
    p(
      "And because a cycling route runs for almost 60 kilometres around Lake Trasimeno, you can spend an entire day travelling through this landscape without needing a car."
    ),
    p(
      "We recently cycled the complete circuit, starting near Sant'Arcangelo and travelling clockwise around the lake."
    ),
    p(
      "With electric bikes, it turned out to be one of those almost perfectly balanced days: enough cycling to feel that you had actually achieved something, but with plenty of time for coffee beside the water, lunch beneath vines in Passignano, a swim in the lake and a final ice cream as the afternoon light began to soften."
    ),
    p("Around 60 kilometres."),
    p("One lake."),
    p("And an entire day to explore it."),
    figure(img(2), "Cycling beside Lake Trasimeno"),

    h2("Why Cycle Around Lake Trasimeno?"),
    p(
      "Lake Trasimeno sits just inside Umbria, close to the Tuscan border, surrounded by low hills, olive groves, vineyards and medieval towns."
    ),
    p(
      "It is Italy's fourth-largest lake, but it feels very different from the better-known lakes of northern Italy."
    ),
    p("There are no dramatic Alpine peaks."),
    p("No grand villas lining the shore."),
    p("No procession of luxury hotels."),
    p("Trasimeno is quieter and softer."),
    p(
      "Its water is remarkably shallow, its shoreline edged with reeds and wetlands, and much of the landscape still revolves around fishing, farming and small communities that have lived beside the lake for centuries."
    ),
    p("The cycling route allows you to experience all of that at exactly the right speed."),
    p(
      "The official circuit is roughly 57 kilometres, although by the time you've diverted into towns, ridden to cafés and explored along the way, it's sensible to think of it as a 60-kilometre day."
    ),
    p("Most importantly, it is almost completely flat."),
    p(
      "That makes it achievable for reasonably active cyclists on conventional bikes and surprisingly easy on an e-bike."
    ),
    figure(img(3), "Lake Trasimeno shoreline"),

    h2("Do You Need an E-Bike?"),
    p("Absolutely not."),
    p(
      "There is very little climbing on the circuit itself, so experienced cyclists will have no difficulty completing the loop on a normal hybrid, gravel or mountain bike."
    ),
    p("But this is one occasion when an electric bike makes a great deal of sense."),
    p(
      "The pleasure of cycling around Trasimeno isn't in completing the circuit as quickly as possible."
    ),
    p("It's in stopping."),
    p("You want to have coffee in Castiglione del Lago."),
    p("Spend time over lunch in Passignano."),
    p("Go swimming."),
    p("Walk through the towns."),
    p("Stop to take photographs."),
    p("Have an ice cream."),
    p(
      "An e-bike removes the pressure of wondering whether you'll have enough energy left for the final 15 kilometres."
    ),
    p(
      "We hired ours from BikeFlow (WhatsApp +39 320 678 8063 to reserve), based at Trasimeno Glamping Resort near Sant'Arcangelo, directly beside the lake."
    ),
    p(
      "The bikes were excellent, with powerful assistance and enough battery range to complete the entire circuit comfortably. Even if using the higher assistance settings for much of the day, the range wouldn't be an issue."
    ),
    p("Starting here also worked particularly well for the rhythm of the day."),
    p("We set off at around 9.30am and cycled clockwise."),
    p(
      "That put Castiglione del Lago at exactly the right distance for morning coffee, Passignano perfectly for lunch and San Feliciano towards the end of the afternoon."
    ),
    figure(img(4), "Passignano sul Trasimeno", "Passignano sul Trasimeno"),

    h2("What Is the Cycle Path Actually Like?"),
    p(
      "Don't imagine a perfectly surfaced urban cycleway running continuously around the water."
    ),
    p("This is much more enjoyable than that."),
    p(
      "Large parts of the route follow gravel and compacted-earth tracks through countryside, beside reed beds and close to the shoreline. Other sections use quiet roads and paved cycle paths."
    ),
    p(
      "There are a few places where the route runs alongside busier roads, particularly on the western and southern sides of the lake, but these are relatively short compared with the whole journey."
    ),
    p("For much of the day, traffic simply disappears."),
    p("One of the best things about the route is how easy it is to follow."),
    p(
      "The circuit is well signposted, and we completed it without needing to navigate constantly with a phone or satnav."
    ),
    p("You simply keep following the lake."),
    p(
      "A hybrid, gravel bike, mountain bike or suitably robust e-bike is preferable to a narrow-tyred road bike, particularly after wet weather when unpaved sections can become softer."
    ),
    p("And then you can concentrate on the landscape rather than the route."),

    h2("First Stop: Castiglione del Lago"),
    p(
      "Starting from Sant'Arcangelo, cycling clockwise brings you first towards Castiglione del Lago."
    ),
    p("It's a wonderful first stop because it also introduces the long history of the lake."),
    p(
      "The town occupies a promontory projecting into Trasimeno. In antiquity, when water levels were higher, it was effectively the lake's fourth island."
    ),
    p(
      "The surrounding territory was connected with the Etruscan city of Chiusi before becoming Roman, and its strategic position meant that Castiglione remained contested throughout the medieval period."
    ),
    p(
      "Above the lake stands the Rocca del Leone, the great polygonal fortress that still dominates the skyline."
    ),
    p("If you're spending a whole weekend around Trasimeno, it deserves a proper visit."),
    p("On a 60-kilometre cycling day, however, we had another priority."),
    p("Coffee."),
    p(
      "We stopped beside the water at Café Pescatore Praia @pescatorecafe, where there was plenty of room to leave the bikes and tables looking directly across the lake."
    ),
    p("After the first section of the ride, it was exactly what we wanted."),
    p("Coffee, breakfast and the water a few metres away."),
    p("Then back on the bikes."),
    figure(img(5), "Along the Lake Trasimeno cycle route"),

    h2("A Lake With an Ancient Past"),
    p(
      "As you cycle around Trasimeno, it is easy to think of the lake as a peaceful rural backwater."
    ),
    p("Historically, it was anything but."),
    p(
      "People have lived around these shores since prehistoric times, and the surrounding landscape later formed part of the worlds of the Etruscans and Romans."
    ),
    p("Its most famous moment came in 217 BC, during the Second Punic War."),
    p(
      "The Carthaginian general Hannibal had crossed the Alps into Italy and was advancing south."
    ),
    p(
      "Near the northern shore of Lake Trasimeno, he prepared one of the most devastating ambushes in ancient military history."
    ),
    p(
      "The Roman consul Gaius Flaminius led his army along the narrow ground between the lake and surrounding hills near modern Tuoro."
    ),
    p("Hannibal's forces were waiting."),
    p(
      "Hidden across the slopes, the Carthaginians attacked the Roman column as it became trapped between the hills and the water."
    ),
    p("Thousands of Roman soldiers were killed, including Flaminius himself."),
    p(
      "More than two thousand years later, the landscape is still associated with the battle. Around Tuoro, place names such as Sanguineto and Ossaia preserve echoes of its violent past, and a historical trail follows locations associated with the fighting."
    ),
    p(
      "Today, you cycle through the same landscape with barely a sound beyond birds, tyres on gravel and the occasional train."
    ),
    p("It's a strange contrast."),

    h2("Through Tuoro and Towards Passignano"),
    p(
      "The northern shore brings you through the territory around Tuoro sul Trasimeno, closest to the site of Hannibal's famous victory."
    ),
    p(
      "Tuoro is also one of the gateways to Isola Maggiore, the only permanently inhabited island in the lake."
    ),
    p(
      "Ferries leave from nearby Punta Navaccia, and if you're staying in the area for several days, the island makes an excellent separate excursion."
    ),
    p("For today's ride, keep following the shore towards Passignano."),
    p("The scenery gradually changes again."),
    p(
      "The hills close in towards the lake and Passignano appears ahead, squeezed between the water and the slopes behind it."
    ),
    p("By now, you'll be ready for lunch."),

    h2("Lunch in Passignano sul Trasimeno"),
    p("Passignano sul Trasimeno is one of the most attractive towns on the lake."),
    p(
      "Its strategic position made it important for centuries, and the remains of its medieval Rocca still rise above the old town."
    ),
    p(
      "Leave the bikes below and wander uphill if you have the energy. The higher you climb, the better the views become across the lake and towards its islands."
    ),
    p("But first, lunch."),
    p(
      `We ate at Trattoria del Pescatore (${a("http://delpescatore.com/", "delpescatore.com")}), tucked into a backstreet beneath a canopy of vines.`
    ),
    p("It feels wonderfully removed from the busier waterfront."),
    p(
      "This is the kind of restaurant we always hope to find when travelling: unpretentious, atmospheric and clearly popular with people who actually live nearby."
    ),
    p("Lake fish is the obvious choice."),
    p("Try the persico — lake perch — or explore the other local dishes on the menu."),
    p(
      "Fishing has shaped life around Trasimeno for centuries, and eating freshwater fish here connects the meal directly with the landscape you've spent the morning cycling through."
    ),
    p("Take your time."),
    p(
      "A long lunch is entirely justified when you've already cycled halfway around a lake."
    ),

    h2("Passignano's Medieval Past"),
    p("Before leaving, spend a little time exploring Passignano itself."),
    p(
      "The town grew around its fortified position on the northern shore, controlling an important route between Umbria and Tuscany."
    ),
    p(
      "Its medieval centre climbs steeply away from the waterfront through narrow streets towards the Rocca."
    ),
    p(
      "The fortress was developed over several periods and became part of the long struggles for control of this strategically important borderland."
    ),
    p("Today, what remains provides one of the best viewpoints around Trasimeno."),
    p("From above, the geography of the lake suddenly makes sense."),
    p("The islands sit out in the water."),
    p("The Umbrian hills rise behind them."),
    p("And somewhere along that distant shoreline is the route you've already cycled."),
    figure(img(6), "Afternoon light on Lake Trasimeno"),

    h2("An Afternoon Swim"),
    p(
      "Leaving Passignano, continue clockwise towards Torricella, Monte del Lago and San Feliciano."
    ),
    p("This was one of our favourite stretches of the day."),
    p(
      "By afternoon, the lake had warmed in the sun and a swim was becoming increasingly difficult to resist."
    ),
    p(
      "We stopped beside Albaia Beach Bar &amp; Lounge (@albaia_montedellago), next to the TWC Trasimeno Windsurf Club."
    ),
    p("In summer, this is an obvious place to stop because the facilities are operating."),
    p("But don't discount it outside the main season."),
    p(
      "Even when the beach facilities are closed, the shore remains accessible and locals still come here to swim."
    ),
    p("A quick change and we were in."),
    p("One thing that surprises first-time swimmers at Trasimeno is the lake bed."),
    p(
      "This is an extremely shallow lake, and the bottom here is soft and almost sand-like underfoot rather than rocky."
    ),
    p("The water remains pleasantly warm surprisingly late in the year."),
    p(
      "On a sunny autumn afternoon, after several hours on a bicycle, it was perfect."
    ),
    p("No elaborate beach club required."),
    p("Just leave the bikes, walk into the lake and cool down."),

    h2("San Feliciano and the Fishing Traditions of Trasimeno"),
    p("Continue along the shore and eventually you reach San Feliciano."),
    p(
      "Unlike some of the fortified settlements around Trasimeno, San Feliciano's identity has always been closely tied to the water."
    ),
    p(
      "It remains one of the lake's traditional fishing communities and is home to the Museo della Pesca, which tells the story of fishing techniques, boats and everyday life around Trasimeno."
    ),
    p(
      "It is also the departure point for boats to Isola Polvese, the largest of the lake's three islands."
    ),
    p("By late afternoon, the little harbour becomes particularly beautiful."),
    p(
      "We stopped at the café near the ferry departure for an ice cream and watched the sun dropping lower over the lake."
    ),
    p("After almost a full circuit, it was difficult to imagine a better final stop."),
    p("Boats moved around the harbour."),
    p("The light softened across the water."),
    p("And there were only a few kilometres left to cycle."),
    figure(img(7), "Ice cream stop in San Feliciano", "Ice cream stop in San Feliciano"),

    h2("Back to Sant'Arcangelo"),
    p("From San Feliciano, the route continues south towards Sant'Arcangelo."),
    p("We arrived back at BikeFlow at around 5pm."),
    p("That meant the complete circuit had taken roughly seven and a half hours."),
    p("But that is slightly misleading."),
    p("We hadn't spent seven and a half hours cycling."),
    p("We'd had breakfast beside the lake."),
    p("Stopped for photographs."),
    p("Eaten a proper lunch."),
    p("Walked around Passignano."),
    p("Gone swimming."),
    p("Had an ice cream."),
    p(
      "And still completed an entire circuit of one of Italy's largest lakes before evening."
    ),
    p("That's precisely why this route works so well."),
    p("It can be a serious cycle ride if you want it to be."),
    p("But it doesn't need to be."),
    figure(img(8), "Golden Hour, Lake Trasimeno", "Golden Hour, Lake Trasimeno"),

    h2("Stay for dinner beside the Lake"),
    p(
      "If you aren't in a hurry to leave Trasimeno, don't finish the day when you hand the bikes back. The lake is particularly beautiful towards sunset, and there are some excellent places to turn the ride into a full day out with dinner beside the water."
    ),
    p(
      "In Castiglione del Lago, La Pigra Tinca is an interesting choice if you want to continue exploring the food of Trasimeno. The restaurant overlooks the lake and takes a more contemporary approach to local ingredients, including freshwater fish. Alternatively, La Cantina (@ristorantecantina_trasimeno) sits in the historic centre in an 18th-century building and serves Umbrian-Tuscan cooking, Chianina beef and traditional lake fish, with a garden overlooking Trasimeno in the warmer months. For something contemporary, Osteria Nova (@osterianova.castiglionedellago) combines the informality of an osteria with a more modern approach to local produce."
    ),
    p(
      "Or stay on the eastern side of the lake and return to San Feliciano for dinner. Osteria Rosso di Sera (@rossodisera_osteria) specialises in lake cuisine and has a terrace facing Trasimeno — particularly appealing as the sun goes down. Another traditional option is Ristorante Da Settimio, a family-run restaurant that has been serving food beside the lake for generations, with a panoramic veranda and a menu rooted in the cooking of Trasimeno."
    ),
    p(
      "After 60 kilometres of cycling, a swim and an afternoon ice cream, sitting beside the lake over dinner while the last light disappears across the water is a pretty good way to finish the day."
    ),

    h2("Can You Do It Without a Car?"),
    p(
      "Absolutely — and this is where Lake Trasimeno becomes particularly interesting for independent travellers."
    ),
    p(
      "The railway runs along the northern and western sides of the lake, with stations including Passignano sul Trasimeno, Tuoro sul Trasimeno and Castiglione del Lago."
    ),
    p(
      "Regional trains connect the lake with Perugia and with Terontola-Cortona, where connections open up towards Florence and the wider Italian rail network."
    ),
    p("That makes it perfectly possible to build a car-free Trasimeno cycling trip."),
    p(
      "The easiest approach is to arrive by train and hire your bike locally rather than trying to transport one."
    ),
    p(
      "If you're travelling with your own bicycle, designated Trenitalia regional services also accept assembled bikes, subject to available bicycle spaces and the appropriate supplement."
    ),
    p(
      "For a full circuit, check rental opening hours carefully before planning the day. You need enough time to collect the bike in the morning, complete the loop at a relaxed pace and return it before the shop closes."
    ),
    p("And if 60 kilometres sounds too ambitious, don't abandon the idea."),
    p("Simply cycle part of the lake."),
    p(
      "Because trains serve several points around the shoreline, you can create a shorter ride rather than treating the full circumnavigation as compulsory."
    ),

    h2("Where to Hire an E-Bike"),
    p(
      "We used BikeFlow at Trasimeno Glamping Resort, near Sant'Arcangelo, and would happily use them again."
    ),
    p(
      "The location puts you almost directly onto the circuit, there is none of the stress of cycling through a large town before reaching the route, and the e-bikes had more than enough range for the complete lake circuit."
    ),
    p(
      "Another option is Trasimeno Slow Experience, which rents e-bikes from its base near Tuoro sul Trasimeno, around two kilometres from the cycle route."
    ),
    p(
      "If you're arriving specifically by train, check current rental locations before travelling. Operators and seasonal opening arrangements change, and not every hire point is directly beside a railway station."
    ),
    p(
      'If you\'re arriving by train, Castiglione del Lago is another useful place to begin the circuit because the town has its own railway station and several well-reviewed bike rental options. E-Bike Rent Castiglione (@ebikerentcastiglione) offers bikes and the large tyre "fat" e-bikes locally, while Valentini Bikes is another well-established option in Castiglione del Lago. Starting here simply changes the rhythm of the day: rather than stopping in Castiglione for morning coffee, you could collect your bikes here and make Passignano or San Feliciano your first substantial break.'
    ),
    p(
      "Whichever rental company you choose, reserve e-bikes in advance during spring, summer and early autumn and confirm collection and return times before setting out on the full circuit."
    ),

    h2("When Is the Best Time to Cycle Lake Trasimeno?"),
    p("Spring and autumn are ideal."),
    p(
      "In April, May and early June, the countryside around the lake is green and temperatures are generally comfortable for cycling."
    ),
    p("September and early October may be even better."),
    p(
      "The fierce heat of high summer has gone, but the days can still be beautifully warm."
    ),
    p("Restaurants and cafés are quieter."),
    p("The light becomes softer."),
    p("And, as we discovered, the lake can still be warm enough for a swim."),
    p("July and August are certainly possible, but set off early."),
    p(
      "Much of the route is exposed and cycling 60 kilometres in the middle of an Umbrian summer day is a very different proposition."
    ),
    p(
      "After prolonged rain, also check conditions. Significant stretches of the route are unpaved, and the surface can become muddy."
    ),

    h2("What to Take"),
    p(
      "You don't need specialist cycling equipment, but a few things make the day much easier."
    ),
    p("Take plenty of water, sun protection and a lightweight waterproof layer."),
    p(
      "Wear comfortable clothes suitable for cycling and shoes you don't mind getting dusty."
    ),
    p(
      "If there's any possibility you might swim, put a swimsuit and a small quick-drying towel in your bag."
    ),

    h2("More Than a Cycle Route"),
    p("Cycling around Lake Trasimeno isn't really about completing 60 kilometres."),
    p(
      "It's about connecting places that make much more sense when experienced together."
    ),
    p(
      "Castiglione del Lago tells the story of a fortified frontier between Umbria and Tuscany."
    ),
    p(
      "Tuoro takes you back to Hannibal and one of ancient Rome's greatest military disasters."
    ),
    p("Passignano brings medieval fortifications and fishing traditions."),
    p("San Feliciano still looks towards the lake for its identity."),
    p(
      "Between them are wetlands, olive groves, beaches, islands, boats and long stretches where there seems to be nothing between you and the water."
    ),
    p(
      "And a bicycle allows you to move through all of it without sealing yourself inside a car."
    ),
    p("Some of the best days in Italy really are that simple."),

    h2("Exploring Umbria Without a Car"),
    p(
      "Lake Trasimeno is one of the many places in central Italy that becomes easier — and often more rewarding — when you combine trains with walking and cycling."
    ),
    p(
      "Our Touring Italy by Train guide shows you how to explore Italy independently, with practical rail advice, flexible itineraries, day trips and destinations that take you beyond the obvious stops."
    ),
    p(a("https://mybook.to/TouringItalybyTrain", "Discover Touring Italy by Train")),
    p("Or explore the complete Real Travel Guides collection:"),
    p(
      a(
        "https://mybook.to/RealTravelGuidesBooks",
        "Explore our Touring by Train guides"
      )
    ),
    p(
      "Follow @real_travel_guides for more independent journeys, scenic rail routes and ideas for exploring Europe without a car."
    ),
  ].join("\n");
}

function estimateReadMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function assertImagesExist() {
  const required = [
    path.join("public", "images", "posts", `${SLUG}.jpg`),
    ...[2, 3, 4, 5, 6, 7, 8].map((n) =>
      path.join("public", "images", "blog", "cycling-around-lake-trasimeno", `image${n}.jpg`)
    ),
  ];
  const missing = required.filter((p) => !existsSync(p));
  if (missing.length) {
    throw new Error(`Missing image files:\n${missing.map((m) => `  - ${m}`).join("\n")}`);
  }
}

async function main() {
  assertImagesExist();
  const body = buildBody();
  const read_minutes = estimateReadMinutes(body);

  const record = {
    slug: SLUG,
    title: TITLE,
    excerpt: EXCERPT,
    cover: COVER,
    categories: CATEGORIES,
    read_minutes,
    published_at: PUBLISHED_AT,
    body,
    images: null,
  };

  console.log(`Title: ${record.title}`);
  console.log(`Slug: ${record.slug}`);
  console.log(`Cover: ${record.cover}`);
  console.log(`Read minutes: ${record.read_minutes}`);
  console.log(`Body length: ${record.body.length} chars`);
  console.log("Amazon Italy:", body.includes("mybook.to/TouringItalybyTrain"));
  console.log("Amazon suite:", body.includes("mybook.to/RealTravelGuidesBooks"));
  console.log("Passignano caption:", body.includes(">Passignano sul Trasimeno</figcaption>"));
  console.log("Ice cream caption:", body.includes(">Ice cream stop in San Feliciano</figcaption>"));
  console.log("Golden hour caption:", body.includes(">Golden Hour, Lake Trasimeno</figcaption>"));

  // Also write a JSON payload so it can be pasted into Supabase if preferred.
  const outPath = ".tmp-trasimeno-post.json";
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log(`Wrote ${outPath}`);

  if (DRY_RUN) {
    console.log("\n[dry-run] Skipping database write.");
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing Supabase credentials. Create .env.local with:\n" +
        "  NEXT_PUBLIC_SUPABASE_URL=https://orjsrwlemsxjyexqbfqo.supabase.co\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=<service_role secret from Project Settings → API>"
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase.from("posts").upsert(record);
  if (error) throw error;
  console.log(`\nDone. Upserted post: /post/${SLUG}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
