-- Run this after schema.sql to populate the same content that's already
-- built into the site's fallback data (lib/seed-data/). Once this data is
-- in Supabase, it becomes the live source of truth automatically — no code
-- changes needed. Image paths below assume you've uploaded covers/photos to
-- Supabase Storage and updated the URLs (see MIGRATION.md, step 3).

-- Categories are just rows in a table now — to add a new one later (say,
-- "Hiking"), insert it here or via the Supabase Table Editor:
--   insert into categories (slug, label) values ('hiking', 'Hiking');
-- It'll automatically appear in the nav filters and get its own page at
-- /journeysbyrail/categories/hiking — no code change needed.
insert into categories (slug, label) values
('switzerland', 'Switzerland'),
('france', 'France'),
('italy', 'Italy'),
('spain', 'Spain'),
('fooddrink', 'Food & Drink'),
('culture', 'Culture'),
('scenicroutes', 'Scenic Routes'),
('hiddenplaces', 'Hidden Places')
on conflict (slug) do nothing;

insert into authors (slug, name, photo, short_bio, full_bio, contact_email) values
('elenarossetti', 'Elena Rossetti', '/images/authors/elena-rossetti.jpg',
 'Elena Rossetti is the author of Touring Italy by Train and Touring Switzerland by Train.',
 ARRAY[
   'Elena Rossetti is a travel writer and tourism professional with over 20 years'' experience working across the European travel industry. She specializes in independent, rail-based journeys that allow travelers to explore with confidence, flexibility, and cultural insight.',
   'Having spent much of her career designing itineraries and guiding visitors through Europe''s rail networks, Elena has developed particular expertise in Italy, Switzerland, and Spain.',
   'Through the Touring by Train series, Elena''s goal is simple: to give travelers the knowledge, structure, and reassurance they need to create their own journeys.'
 ],
 'elenarossetti1@outlook.com'),
('sophiepicot', 'Sophie Picot', '/images/authors/sophie-picot.jpg',
 'Sophie Picot is the author of Touring France by Train.',
 ARRAY[
   'Sophie Picot was born in France to an American mother and a French father. She grew up with one foot in each culture and a passion for travel from an early age.',
   'An avid fan of train travel, Sophie has explored nearly every corner of France by rail, championing trains as a more sustainable, stress-free, and authentic way to travel.',
   'With Touring France by Train, Sophie combines her insider knowledge and her passion for flight-free exploration to inspire travelers to experience France independently, confidently, and at their own pace.'
 ],
 'sophie.picot@outlook.com')
on conflict (slug) do nothing;

insert into books (slug, title, author_slug, cover, tagline, description, highlights, amazon_url) values
('touring-italy-by-train', 'Touring Italy by Train', 'elenarossetti', '/images/books/touring-italy-by-train.jpg',
 'Discover a smarter, more authentic way to explore Italy — without the cost of organized tours or the stress of car rentals.',
 'Whether you''re dreaming of a romantic escape, a family trip, or a solo adventure, this guide gives you the tools to create your own unique Italian journey.',
 ARRAY['Flexible itineraries for first-time and repeat visitors', 'Journey times, booking tips, and money-saving advice', 'Local insight beyond the tourist trail', 'Confidence to travel independently, by rail'],
 'https://mybook.to/TouringItalybyTrain'),
('touring-switzerland-by-train', 'Touring Switzerland by Train', 'elenarossetti', '/images/books/touring-switzerland-by-train.png',
 'Discover the most scenic, stress-free way to explore Switzerland — by rail, at your own pace.',
 'Whether you''re planning a once-in-a-lifetime alpine adventure or a relaxing lakeside escape, this guide gives you the tools to create your own unforgettable Swiss itinerary.',
 ARRAY['Panoramic rail routes including the Glacier and Bernina Express', 'Lakeside towns and high mountain viewpoints', 'No car required, ever', 'Independent, confident, beautiful travel by train'],
 'https://mybook.to/SwitzerlandByTrain'),
('touring-spain-by-train', 'Touring Spain by Train', 'elenarossetti', '/images/books/touring-spain-by-train.png',
 'The ultimate travel guide to Spain, with easy rail itineraries and expert travel tips.',
 'This guide shows you how to explore Spain independently and confidently, using its fast, modern rail network as your gateway.',
 ARRAY['Connects Madrid, Barcelona, Andalucía and the north by rail', 'Day-trip guides from every major hub', 'Toledo, Segovia, Girona, Montserrat, Córdoba and more', 'Travel with confidence, freedom, and ease'],
 'https://mybook.to/TouringSpainByTrain'),
('touring-france-by-train', 'Touring France by Train', 'sophiepicot', '/images/books/touring-france-by-train.jpg',
 'Your essential guide to stress-free, self-guided adventures across France''s world-class rail network.',
 'From Paris to Provence, Normandy to Nice, this book shows you how to design your own itinerary and travel like a local.',
 ARRAY['Flexible 5, 7, 10 and 14+ day itineraries', 'Paris, Normandy, Loire Valley, Alsace, Burgundy, Provence, Bordeaux and more', 'Vineyard tours, lavender fields, medieval towns', 'Sustainable, relaxed travel by scenic rail route'],
 'https://mybook.to/TouringFranceByTrain')
on conflict (slug) do nothing;

-- Posts: metadata only — paste the full `body` text from Wix for each post
-- (see MIGRATION.md). Slugs match the live Wix URLs exactly so no redirects
-- are needed.
insert into posts (slug, title, excerpt, cover, categories, read_minutes, published_at, body) values
('madrid-to-siguenza-by-train-a-medieval-escape-into-the-heart-of-castile', 'Madrid to Sigüenza by Train: A Medieval Escape into the Heart of Castile', 'A day trip from Madrid into one of Castile''s best-kept medieval secrets, reachable entirely by rail.', '/images/posts/siguenza.jpg', ARRAY['spain'], 7, '2025-01-01', '[Paste full post body here]'),
('around-mount-etna-by-train-sicily-s-most-extraordinary-railway-journey', 'Around Mount Etna by Train: Sicily''s Most Extraordinary Railway Journey', 'Circling an active volcano on one of Europe''s most unusual narrow-gauge railways.', '/images/posts/mount-etna.jpg', ARRAY['italy'], 5, '2025-01-01', '[Paste full post body here]'),
('lucerne-to-st-gallen-on-the-voralpen-express-switzerland-beyond-the-high-alps', 'Lucerne to St Gallen on the Voralpen-Express: Switzerland Beyond the High Alps', 'A gentler side of Switzerland''s rail network, away from the famous high-alpine panoramic routes.', '/images/posts/st-gallen.jpg', ARRAY['switzerland'], 6, '2025-01-01', '[Paste full post body here]'),
('bellinzona-to-lucerne-across-switzerland-on-the-historic-gotthard-route', 'Bellinzona to Lucerne: Across Switzerland on the Historic Gotthard Route', 'Tracing one of the great historic rail crossings of the Alps.', '/images/posts/bellinzona.jpg', ARRAY['scenicroutes'], 6, '2025-01-01', '[Paste full post body here]'),
('train-des-pignes-discover-provence-s-hidden-railway-from-nice-to-digne-les-bains', 'Train des Pignes: Discover Provence''s Hidden Railway from Nice to Digne-les-Bains', 'A narrow-gauge line into Provence''s lavender-scented back country.', '/images/posts/digne-les-bains.jpg', ARRAY['france'], 4, '2025-01-01', '[Paste full post body here]'),
('marseille-to-ventimiglia-by-train-one-of-europe-s-most-beautiful-coastal-rail-journeys', 'Marseille to Ventimiglia by Train: One of Europe''s Most Beautiful Coastal Rail Journeys', 'Hugging the Mediterranean from Marseille through the French Riviera and across the Italian border.', '/images/posts/menton.jpg', ARRAY['france'], 4, '2025-01-01', '[Paste full post body here]')
on conflict (slug) do nothing;
