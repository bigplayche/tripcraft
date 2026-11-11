/**
 * Curated destination catalogue.
 *
 * This is editorial reference data written by hand, NOT live data: costs are rough planning
 * estimates in USD, coordinates are approximate, and nothing here implies availability,
 * opening hours or current prices. The UI labels it accordingly. It powers Discover and the
 * no-API-key fallback planner; with OpenAI + Google Places configured, live lookups take over.
 */
export const CATALOG_REVIEWED = "June 2026";

export type Weather = "tropical" | "warm" | "mild" | "cool";
export type Tier = "budget" | "mid" | "luxury";
export type CatalogPlace = { name: string; category: string; description: string; lat: number; lng: number; cost: number | null; mins: number; indoor: boolean };
export type CatalogFood = { name: string; cuisine: string; price: 1 | 2 | 3 | 4; description: string; lat: number; lng: number; cost: number };
export type CatalogStay = { name: string; area: string; type: string; tier: Tier; nightly: number; lat: number; lng: number; description: string };
export type Destination = {
  slug: string; name: string; country: string; lat: number; lng: number;
  tagline: string; summary: string; styles: string[]; weather: Weather;
  bestSeason: string; bestMonths: number[]; dailyCost: Record<Tier, number>; suggestedNights: number;
  popular?: boolean; trending?: boolean; art: [string, string];
  places: CatalogPlace[]; food: CatalogFood[]; stays: CatalogStay[];
};

const p = (name: string, category: string, lat: number, lng: number, cost: number | null, mins: number, indoor: boolean, description: string): CatalogPlace => ({ name, category, lat, lng, cost, mins, indoor, description });
const f = (name: string, cuisine: string, price: 1 | 2 | 3 | 4, cost: number, lat: number, lng: number, description: string): CatalogFood => ({ name, cuisine, price, cost, lat, lng, description });
const s = (name: string, area: string, type: string, tier: Tier, nightly: number, lat: number, lng: number, description: string): CatalogStay => ({ name, area, type, tier, nightly, lat, lng, description });

export const DESTINATIONS: Destination[] = [
  {
    slug: "lisbon", name: "Lisbon", country: "Portugal", lat: 38.7223, lng: -9.1393, art: ["#e9a36b", "#3f6c8f"],
    tagline: "Sunlit hills, tiled façades and custard tarts", popular: true, trending: true,
    summary: "A walkable, great-value capital of viewpoints, trams and seafood, with palaces and Atlantic beaches a short train ride away.",
    styles: ["City exploration", "Food and culture", "Budget-friendly", "Romantic", "Solo travel", "Nightlife"], weather: "warm",
    bestSeason: "March–June and September–October", bestMonths: [3, 4, 5, 6, 9, 10], dailyCost: { budget: 60, mid: 120, luxury: 280 }, suggestedNights: 4,
    places: [
      p("Belém Tower", "Landmark", 38.6916, -9.216, 9, 60, false, "16th-century riverside fortress and symbol of the Age of Discovery."),
      p("Jerónimos Monastery", "Landmark", 38.6979, -9.2068, 13, 90, true, "Ornate Manueline monastery, a short walk from Belém Tower."),
      p("Alfama & São Jorge Castle", "Neighbourhood walk", 38.7139, -9.1335, 17, 150, false, "Lisbon's oldest quarter, climbing to hilltop castle ramparts with city views."),
      p("LX Factory", "Shopping", 38.7035, -9.1789, null, 90, false, "Former industrial complex of design shops, bookstores and cafés."),
      p("Miradouro da Senhora do Monte", "Viewpoint", 38.719, -9.1326, 0, 45, false, "One of the highest viewpoints in the city; best near sunset."),
      p("National Tile Museum", "Museum", 38.725, -9.1136, 9, 90, true, "Five centuries of Portuguese azulejos in a former convent."),
      p("Sintra & Pena Palace day trip", "Day trip", 38.7876, -9.3906, 25, 420, false, "Fairy-tale palaces in forested hills, about 40 minutes away by train."),
      p("Tram 28 ride", "Local experience", 38.7155, -9.1362, 4, 50, true, "Vintage tram rattling through Graça, Alfama and Baixa."),
      p("Bairro Alto & Pink Street", "Nightlife", 38.7071, -9.1437, null, 150, false, "The city's bar district; things get going after 10pm."),
    ],
    food: [
      f("Time Out Market Lisboa", "Portuguese food hall", 2, 22, 38.7067, -9.1459, "Dozens of stalls from well-known local chefs under one roof."),
      f("Pastéis de Belém", "Bakery", 1, 8, 38.6975, -9.2032, "The original custard tart bakery, operating since 1837."),
      f("Cervejaria Ramiro", "Seafood", 3, 45, 38.7203, -9.1357, "Lively institution for shellfish; expect a queue."),
      f("Zé da Mouraria", "Traditional Portuguese", 2, 20, 38.716, -9.137, "No-frills lunch spot known for generous shared plates."),
      f("A Cevicheria", "Peruvian-Portuguese", 3, 40, 38.7163, -9.1487, "Creative ceviche in Príncipe Real."),
    ],
    stays: [
      s("The Lumiares Hotel & Spa", "Bairro Alto", "Boutique hotel", "luxury", 380, 38.7142, -9.1451, "Apartment-style suites with a rooftop bar."),
      s("Lisboa Pessoa Hotel", "Chiado", "Hotel", "mid", 170, 38.7118, -9.142, "Central four-star with a rooftop terrace."),
      s("Lisbon Destination Hostel", "Rossio", "Hostel", "budget", 35, 38.7143, -9.1408, "Sociable hostel inside Rossio train station."),
    ],
  },
  {
    slug: "tokyo", name: "Tokyo", country: "Japan", lat: 35.6812, lng: 139.7671, art: ["#e58a8a", "#2f3f6b"],
    tagline: "Neon nights, quiet shrines, unforgettable food", popular: true,
    summary: "A city of contrasts where ancient temples sit beside futuristic districts, with some of the best food on earth at every price.",
    styles: ["City exploration", "Food and culture", "Family vacation", "Nightlife", "Solo travel", "Luxury"], weather: "mild",
    bestSeason: "March–May and October–November", bestMonths: [3, 4, 5, 10, 11], dailyCost: { budget: 75, mid: 150, luxury: 380 }, suggestedNights: 6,
    places: [
      p("Sensō-ji Temple", "Landmark", 35.7148, 139.7967, 0, 75, false, "Tokyo's oldest temple, approached via the Nakamise shopping street."),
      p("Meiji Shrine", "Landmark", 35.6764, 139.6993, 0, 75, false, "Forest-wrapped Shinto shrine next to Harajuku."),
      p("Shibuya Crossing & Shibuya Sky", "Viewpoint", 35.6595, 139.7005, 17, 90, true, "The famous scramble crossing and an open-air rooftop observatory."),
      p("teamLab Planets", "Museum", 35.6491, 139.7898, 28, 120, true, "Immersive digital art you walk through barefoot. Book ahead."),
      p("Tsukiji Outer Market", "Food market", 35.6655, 139.7707, null, 90, false, "Street-food stalls and knife shops; go in the morning."),
      p("Tokyo National Museum", "Museum", 35.7188, 139.7765, 7, 120, true, "Japan's largest collection of art and antiquities, in Ueno Park."),
      p("Shinjuku Gyoen", "Park", 35.6852, 139.71, 4, 90, false, "Spacious landscaped garden, a favourite in cherry-blossom season."),
      p("Akihabara", "Shopping", 35.7023, 139.7745, null, 120, true, "Electronics, arcades and anime culture."),
      p("Golden Gai", "Nightlife", 35.694, 139.7046, null, 120, true, "Six alleys of tiny bars in Shinjuku."),
    ],
    food: [
      f("Ichiran Shibuya", "Ramen", 1, 10, 35.661, 139.701, "Tonkotsu ramen served in solo booths."),
      f("Sushi no Midori", "Sushi", 2, 30, 35.6585, 139.699, "Popular, good-value sushi; take a queue ticket."),
      f("Omoide Yokocho", "Yakitori alley", 2, 25, 35.6929, 139.6995, "Smoky lantern-lit lane of tiny grills near Shinjuku Station."),
      f("Afuri Ebisu", "Ramen", 1, 12, 35.648, 139.71, "Light yuzu-scented ramen."),
      f("Gonpachi Nishi-Azabu", "Izakaya", 3, 45, 35.66, 139.7227, "Atmospheric two-storey izakaya."),
    ],
    stays: [
      s("Park Hyatt Tokyo", "Shinjuku", "Luxury hotel", "luxury", 800, 35.6855, 139.6907, "Skyline views from the top floors of Shinjuku Park Tower."),
      s("Hotel Gracery Shinjuku", "Shinjuku", "Hotel", "mid", 170, 35.695, 139.7019, "Modern rooms in the heart of Kabukichō."),
      s("Nui. Hostel & Bar Lounge", "Kuramae", "Hostel", "budget", 35, 35.703, 139.79, "Design-forward hostel in a quiet craft district."),
    ],
  },
  {
    slug: "paris", name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, art: ["#d9b99b", "#5b5f7a"],
    tagline: "Art, café terraces and long walks by the Seine", popular: true,
    summary: "Museums, grand boulevards and neighbourhood bistros. Compact and best explored on foot and by métro.",
    styles: ["Romantic", "Food and culture", "City exploration", "Luxury", "Family vacation"], weather: "mild",
    bestSeason: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], dailyCost: { budget: 85, mid: 170, luxury: 420 }, suggestedNights: 5,
    places: [
      p("Eiffel Tower", "Landmark", 48.8584, 2.2945, 32, 120, false, "Book a timed ticket for the summit well in advance."),
      p("Louvre Museum", "Museum", 48.8606, 2.3376, 24, 180, true, "The world's most-visited museum; choose a wing rather than everything."),
      p("Musée d'Orsay", "Museum", 48.86, 2.3266, 18, 120, true, "Impressionist masterpieces in a former railway station."),
      p("Montmartre & Sacré-Cœur", "Neighbourhood walk", 48.8867, 2.3431, 0, 120, false, "Hilltop village streets and a sweeping city panorama."),
      p("Seine river cruise", "Boat tour", 48.86, 2.293, 18, 60, false, "A one-hour loop past the major monuments; lovely at dusk."),
      p("Le Marais", "Shopping", 48.859, 2.362, null, 120, false, "Medieval lanes, boutiques, galleries and the Place des Vosges."),
      p("Luxembourg Gardens", "Park", 48.8462, 2.3372, 0, 60, false, "Formal gardens ideal for a picnic."),
      p("Sainte-Chapelle", "Landmark", 48.8554, 2.345, 15, 45, true, "Gothic chapel with extraordinary stained glass."),
      p("Palace of Versailles day trip", "Day trip", 48.8049, 2.1204, 35, 330, false, "The palace and gardens, about 45 minutes away by RER."),
    ],
    food: [
      f("Bouillon Chartier", "French brasserie", 2, 25, 48.872, 2.343, "Belle Époque dining hall with classic dishes at gentle prices."),
      f("L'As du Fallafel", "Middle Eastern", 1, 10, 48.8573, 2.359, "Famous falafel in the Marais."),
      f("Breizh Café", "Crêperie", 2, 22, 48.861, 2.362, "Buckwheat galettes with quality Breton ingredients."),
      f("Marché des Enfants Rouges", "Covered market", 2, 18, 48.863, 2.362, "The city's oldest covered market, with stalls from around the world."),
      f("Le Comptoir du Relais", "Bistro", 3, 55, 48.852, 2.3388, "Classic Saint-Germain bistro cooking."),
    ],
    stays: [
      s("Le Bristol Paris", "8th arrondissement", "Palace hotel", "luxury", 1600, 48.8717, 2.3147, "One of the city's grand palace hotels."),
      s("Hôtel Jeanne d'Arc Le Marais", "Le Marais", "Hotel", "mid", 230, 48.8553, 2.3625, "Charming small hotel on a quiet Marais street."),
      s("Generator Paris", "10th arrondissement", "Hostel", "budget", 48, 48.879, 2.37, "Large design hostel with a rooftop bar near Canal Saint-Martin."),
    ],
  },
  {
    slug: "barcelona", name: "Barcelona", country: "Spain", lat: 41.3874, lng: 2.1686, art: ["#f0b35a", "#2c7a8c"],
    tagline: "Gaudí, tapas and city beaches", popular: true,
    summary: "Modernist architecture, a medieval old town and a Mediterranean beachfront, with late dinners and later nights.",
    styles: ["Beach vacation", "Nightlife", "Food and culture", "City exploration", "Romantic"], weather: "warm",
    bestSeason: "May–June and September–October", bestMonths: [5, 6, 9, 10], dailyCost: { budget: 65, mid: 135, luxury: 320 }, suggestedNights: 4,
    places: [
      p("Sagrada Família", "Landmark", 41.4036, 2.1744, 30, 120, true, "Gaudí's unfinished basilica. Timed tickets sell out."),
      p("Park Güell", "Park", 41.4145, 2.1527, 12, 90, false, "Mosaic terraces above the city."),
      p("Gothic Quarter", "Neighbourhood walk", 41.3833, 2.1769, 0, 120, false, "Roman walls, hidden squares and the cathedral."),
      p("Casa Batlló", "Landmark", 41.3917, 2.165, 38, 75, true, "Gaudí's dragon-backed townhouse on Passeig de Gràcia."),
      p("Barceloneta Beach", "Beach", 41.3784, 2.1925, 0, 180, false, "The city's main beach, lined with chiringuitos."),
      p("Montjuïc", "Viewpoint", 41.3711, 2.1517, 0, 120, false, "Gardens, museums and harbour views by cable car."),
      p("Picasso Museum", "Museum", 41.3852, 2.1809, 14, 90, true, "The artist's formative years, in medieval palaces."),
      p("Bunkers del Carmel", "Viewpoint", 41.4193, 2.1617, 0, 60, false, "360° sunset viewpoint."),
      p("El Born bars", "Nightlife", 41.385, 2.183, null, 150, true, "Cocktail bars and vermouth joints in narrow lanes."),
    ],
    food: [
      f("Mercat de la Boqueria", "Market", 2, 18, 41.3817, 2.1716, "Historic market off La Rambla; eat at a counter bar."),
      f("Cervecería Catalana", "Tapas", 2, 30, 41.3923, 2.161, "Always-busy tapas favourite."),
      f("Can Paixano", "Cava & tapas", 1, 14, 41.3814, 2.1838, "Standing-room cava bar with grilled sandwiches."),
      f("7 Portes", "Paella", 3, 45, 41.3826, 2.1836, "Traditional rice dishes served since 1836."),
      f("Bar Cañete", "Tapas", 3, 45, 41.379, 2.173, "Polished counter dining in the Raval."),
    ],
    stays: [
      s("Hotel Arts Barcelona", "Port Olímpic", "Luxury hotel", "luxury", 520, 41.3869, 2.1964, "Beachfront tower with sea-view rooms."),
      s("Hotel Jazz", "Eixample", "Hotel", "mid", 190, 41.386, 2.166, "Central hotel with a small rooftop pool."),
      s("Generator Barcelona", "Gràcia", "Hostel", "budget", 40, 41.399, 2.163, "Design hostel with private rooms and dorms."),
    ],
  },
  {
    slug: "new-york", name: "New York City", country: "United States", lat: 40.758, lng: -73.9855, art: ["#f2c078", "#34425a"],
    tagline: "Skyline views, Broadway and every cuisine", popular: true,
    summary: "World-class museums, theatre and neighbourhoods with entirely different personalities, all connected by subway.",
    styles: ["City exploration", "Food and culture", "Nightlife", "Luxury", "Family vacation", "Solo travel"], weather: "mild",
    bestSeason: "April–June and September–early November", bestMonths: [4, 5, 6, 9, 10], dailyCost: { budget: 110, mid: 220, luxury: 520 }, suggestedNights: 5,
    places: [
      p("Central Park", "Park", 40.7812, -73.9665, 0, 120, false, "843 acres of lawns, lakes and paths."),
      p("The Metropolitan Museum of Art", "Museum", 40.7794, -73.9632, 30, 180, true, "5,000 years of art on Museum Mile."),
      p("Statue of Liberty & Ellis Island", "Boat tour", 40.7033, -74.017, 26, 240, false, "Ferries depart from Battery Park; reserve ahead."),
      p("The High Line & Chelsea Market", "Neighbourhood walk", 40.748, -74.0048, 0, 90, false, "Elevated rail-line park ending at a food hall."),
      p("Brooklyn Bridge & DUMBO", "Neighbourhood walk", 40.7061, -73.9969, 0, 90, false, "Walk the bridge for skyline views."),
      p("9/11 Memorial & Museum", "Museum", 40.7115, -74.0134, 36, 120, true, "Memorial pools and a moving museum."),
      p("Top of the Rock", "Viewpoint", 40.7593, -73.9794, 44, 60, false, "Observation deck with a view of the Empire State Building."),
      p("Broadway show", "Theatre", 40.759, -73.9845, 120, 165, true, "Prices vary widely by show and date."),
      p("West Village jazz clubs", "Nightlife", 40.7336, -74.0027, 40, 150, true, "Intimate basement clubs; cover charges are common."),
    ],
    food: [
      f("Katz's Delicatessen", "Deli", 2, 30, 40.7223, -73.9874, "Pastrami on rye since 1888."),
      f("Joe's Pizza", "Pizza", 1, 8, 40.7306, -74.0021, "Classic New York slice in Greenwich Village."),
      f("Los Tacos No. 1", "Mexican", 1, 14, 40.7424, -74.006, "Standing-room tacos in Chelsea Market."),
      f("Russ & Daughters Cafe", "Jewish appetizing", 2, 30, 40.7197, -73.9896, "Smoked fish, bagels and egg creams."),
      f("Keens Steakhouse", "Steakhouse", 4, 110, 40.7508, -73.9865, "Old-New York chophouse, open since 1885."),
    ],
    stays: [
      s("The Plaza", "Midtown", "Luxury hotel", "luxury", 950, 40.7645, -73.9744, "Landmark hotel on the corner of Central Park."),
      s("Arlo NoMad", "NoMad", "Hotel", "mid", 280, 40.7459, -73.985, "Compact, well-designed rooms with a rooftop bar."),
      s("Pod 51", "Midtown East", "Budget hotel", "budget", 140, 40.7557, -73.969, "Small, efficient rooms at a comparatively low price."),
    ],
  },
  {
    slug: "bali", name: "Ubud, Bali", country: "Indonesia", lat: -8.5069, lng: 115.2625, art: ["#8fbf7f", "#285e52"],
    tagline: "Rice terraces, temples and slow mornings", trending: true,
    summary: "Bali's green cultural heart: jungle walks, water temples and exceptional value, with beaches a drive away.",
    styles: ["Adventure", "Romantic", "Budget-friendly", "Beach vacation", "Solo travel", "Luxury"], weather: "tropical",
    bestSeason: "May–September (dry season)", bestMonths: [5, 6, 7, 8, 9], dailyCost: { budget: 40, mid: 90, luxury: 260 }, suggestedNights: 7,
    places: [
      p("Tegallalang Rice Terraces", "Nature", -8.4312, 115.2793, 2, 90, false, "Sculpted terraces north of Ubud; go early."),
      p("Sacred Monkey Forest Sanctuary", "Nature", -8.5188, 115.2585, 6, 75, false, "Temple complex in a forest of long-tailed macaques."),
      p("Tirta Empul Temple", "Temple", -8.4153, 115.3153, 4, 75, false, "Holy spring water temple."),
      p("Campuhan Ridge Walk", "Hiking", -8.503, 115.254, 0, 75, false, "Easy ridge-top trail, best at sunrise."),
      p("Mount Batur sunrise trek", "Outdoor adventure", -8.242, 115.375, 55, 420, false, "Pre-dawn guided climb of an active volcano."),
      p("Tegenungan Waterfall", "Nature", -8.5753, 115.289, 2, 75, false, "Powerful waterfall with a swimming area."),
      p("Balinese cooking class", "Local experience", -8.5069, 115.2625, 35, 240, true, "Market visit and hands-on class."),
      p("Ubud Art Market", "Shopping", -8.5068, 115.2625, null, 60, false, "Textiles, baskets and carvings; bargaining expected."),
      p("Uluwatu Temple & Kecak dance", "Day trip", -8.8291, 115.0849, 12, 300, false, "Cliff-top temple and sunset fire dance on the south coast."),
    ],
    food: [
      f("Warung Biah Biah", "Balinese", 1, 7, -8.508, 115.264, "Small plates of local classics."),
      f("Ibu Oka", "Balinese roast pork", 1, 8, -8.5065, 115.262, "Ubud's best-known babi guling."),
      f("Clear Cafe", "Healthy", 2, 14, -8.51, 115.263, "Plant-forward menu in a beautiful space."),
      f("Sari Organik", "Organic", 2, 12, -8.495, 115.257, "Reached by a path through rice fields."),
      f("Hujan Locale", "Modern Indonesian", 3, 30, -8.5055, 115.2635, "Refined archipelago cooking."),
    ],
    stays: [
      s("Four Seasons Resort Bali at Sayan", "Sayan", "Resort", "luxury", 900, -8.502, 115.24, "Riverside villas in the Ayung valley."),
      s("Alaya Resort Ubud", "Central Ubud", "Resort", "mid", 150, -8.519, 115.264, "Calm resort facing rice fields."),
      s("Puri Garden Hotel & Hostel", "Central Ubud", "Hostel", "budget", 25, -8.516, 115.265, "Sociable stay with a pool."),
    ],
  },
  {
    slug: "rome", name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, art: ["#e2a66f", "#7a4a3a"],
    tagline: "Ancient ruins, piazzas and perfect pasta", popular: true,
    summary: "Three thousand years of history in a walkable centre, fuelled by espresso, gelato and trattoria lunches.",
    styles: ["Food and culture", "Romantic", "City exploration", "Family vacation"], weather: "warm",
    bestSeason: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], dailyCost: { budget: 70, mid: 145, luxury: 360 }, suggestedNights: 4,
    places: [
      p("Colosseum & Roman Forum", "Landmark", 41.8902, 12.4922, 20, 180, false, "Combined ticket; book a timed entry."),
      p("Vatican Museums & Sistine Chapel", "Museum", 41.9065, 12.4536, 24, 180, true, "Reserve ahead; mornings are busiest."),
      p("St. Peter's Basilica", "Landmark", 41.9022, 12.4539, 0, 75, true, "Free entry; the dome climb costs extra."),
      p("Pantheon", "Landmark", 41.8986, 12.4769, 6, 40, true, "Roman temple with the famous open oculus."),
      p("Trevi Fountain & Spanish Steps", "Neighbourhood walk", 41.9009, 12.4833, 0, 60, false, "Best early in the morning or late at night."),
      p("Trastevere", "Neighbourhood walk", 41.889, 12.47, 0, 120, false, "Ivy-draped lanes that come alive in the evening."),
      p("Borghese Gallery", "Museum", 41.9142, 12.4922, 18, 120, true, "Bernini and Caravaggio; reservations required."),
      p("Appian Way bike ride", "Outdoor adventure", 41.857, 12.517, 20, 180, false, "Cycle the ancient road past catacombs and aqueducts."),
    ],
    food: [
      f("Roscioli", "Roman", 3, 45, 41.894, 12.474, "Deli-restaurant known for carbonara."),
      f("Da Enzo al 29", "Trattoria", 2, 28, 41.888, 12.477, "Tiny Trastevere trattoria; expect a wait."),
      f("Pizzarium Bonci", "Pizza al taglio", 1, 12, 41.907, 12.447, "Inventive pizza by the slice near the Vatican."),
      f("Giolitti", "Gelato", 1, 5, 41.901, 12.477, "Historic gelateria near the Pantheon."),
      f("Armando al Pantheon", "Roman", 3, 45, 41.899, 12.4765, "Family-run classic; book ahead."),
    ],
    stays: [
      s("Hotel de Russie", "Piazza del Popolo", "Luxury hotel", "luxury", 1100, 41.91, 12.477, "Grand hotel with a terraced garden."),
      s("Hotel Artemide", "Via Nazionale", "Hotel", "mid", 260, 41.901, 12.493, "Well-regarded four-star near Termini."),
      s("The RomeHello", "Repubblica", "Hostel", "budget", 40, 41.904, 12.495, "Modern hostel with private rooms."),
    ],
  },
  {
    slug: "mexico-city", name: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, art: ["#e77f5f", "#3b6b5a"],
    tagline: "Markets, murals and world-class tacos", trending: true,
    summary: "A vast, creative capital with pre-Hispanic ruins, leafy neighbourhoods and one of the world's great food scenes.",
    styles: ["Food and culture", "City exploration", "Budget-friendly", "Nightlife", "Solo travel"], weather: "mild",
    bestSeason: "March–May and October–November", bestMonths: [3, 4, 5, 10, 11], dailyCost: { budget: 45, mid: 100, luxury: 260 }, suggestedNights: 5,
    places: [
      p("Zócalo & Templo Mayor", "Landmark", 19.4346, -99.1319, 5, 120, false, "The main square and the excavated Aztec temple."),
      p("National Museum of Anthropology", "Museum", 19.426, -99.1863, 5, 180, true, "Outstanding pre-Hispanic collections."),
      p("Chapultepec Castle", "Landmark", 19.4204, -99.1819, 5, 120, false, "Hilltop castle with park and skyline views."),
      p("Frida Kahlo Museum", "Museum", 19.3551, -99.1626, 16, 90, true, "The Blue House in Coyoacán. Tickets must be bought ahead."),
      p("Teotihuacán day trip", "Day trip", 19.6925, -98.8438, 30, 360, false, "The pyramids of the Sun and Moon, about an hour away."),
      p("Xochimilco canals", "Boat tour", 19.257, -99.104, 20, 180, false, "Colourful trajinera boats; priced per boat, per hour."),
      p("Roma & Condesa", "Neighbourhood walk", 19.415, -99.165, 0, 120, false, "Art Deco streets, parks, cafés and galleries."),
      p("Lucha libre at Arena México", "Nightlife", 19.4245, -99.152, 25, 150, true, "Masked wrestling, several nights a week."),
      p("Palacio de Bellas Artes", "Landmark", 19.4352, -99.1412, 5, 60, true, "Art Nouveau palace with Rivera murals."),
    ],
    food: [
      f("El Vilsito", "Tacos al pastor", 1, 8, 19.389, -99.156, "Auto shop by day, taquería by night."),
      f("Contramar", "Seafood", 3, 45, 19.4195, -99.167, "Long lunches and the famous tuna tostadas."),
      f("Panadería Rosetta", "Bakery", 1, 8, 19.419, -99.16, "Guava rolls worth queueing for."),
      f("Café de Tacuba", "Traditional Mexican", 2, 22, 19.4357, -99.1375, "Historic dining room, open since 1912."),
      f("Mercado de Coyoacán", "Market", 1, 10, 19.353, -99.161, "Tostadas and fresh juices."),
    ],
    stays: [
      s("Four Seasons Hotel Mexico City", "Reforma", "Luxury hotel", "luxury", 650, 19.4245, -99.173, "Hacienda-style courtyard hotel."),
      s("Hotel Carlota", "Cuauhtémoc", "Boutique hotel", "mid", 160, 19.43, -99.164, "Design hotel around a glass-sided pool."),
      s("Casa Pepe", "Centro Histórico", "Hostel", "budget", 28, 19.429, -99.133, "Lively hostel with rooftop events."),
    ],
  },
  {
    slug: "honolulu", name: "Honolulu", country: "United States", lat: 21.3069, lng: -157.8583, art: ["#6fc3c9", "#1f5673"],
    tagline: "Surf, hikes and island sunsets", popular: true,
    summary: "Waikīkī's beaches with volcanic hikes, snorkelling bays and the North Shore within an hour's drive.",
    styles: ["Beach vacation", "Family vacation", "Adventure", "Romantic", "Luxury"], weather: "tropical",
    bestSeason: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], dailyCost: { budget: 95, mid: 190, luxury: 450 }, suggestedNights: 6,
    places: [
      p("Waikīkī Beach", "Beach", 21.2766, -157.8278, 0, 180, false, "Gentle waves suited to first surf lessons."),
      p("Diamond Head summit trail", "Hiking", 21.262, -157.806, 5, 120, false, "Short, steep crater hike. Non-residents need a reservation."),
      p("Pearl Harbor National Memorial", "Landmark", 21.3649, -157.95, 0, 180, false, "USS Arizona Memorial programme; reserve in advance."),
      p("Hanauma Bay snorkelling", "Outdoor adventure", 21.269, -157.6938, 25, 180, false, "Protected reef; reservations required, closed some days."),
      p("ʻIolani Palace", "Landmark", 21.3068, -157.8587, 27, 75, true, "The only royal palace in the United States."),
      p("North Shore day trip", "Day trip", 21.593, -158.103, null, 360, false, "Surf towns, shrimp trucks and big-wave beaches."),
      p("Mānoa Falls trail", "Hiking", 21.333, -157.8, 0, 120, false, "Rainforest walk to a 150-foot waterfall."),
      p("Bishop Museum", "Museum", 21.333, -157.871, 29, 120, true, "Hawaiian and Pacific history and culture."),
      p("Sunset catamaran sail", "Boat tour", 21.278, -157.832, 60, 90, false, "Evening sail off Waikīkī."),
    ],
    food: [
      f("Helena's Hawaiian Food", "Hawaiian", 2, 22, 21.33, -157.864, "Award-winning traditional plates."),
      f("Marukame Udon", "Japanese", 1, 12, 21.28, -157.826, "Fresh udon, cafeteria style."),
      f("Leonard's Bakery", "Bakery", 1, 6, 21.285, -157.813, "Hot malasadas since 1952."),
      f("Ono Seafood", "Poke", 1, 15, 21.283, -157.813, "Made-to-order poke bowls."),
      f("Duke's Waikiki", "Seafood", 3, 45, 21.277, -157.828, "Beachfront dining and live music."),
    ],
    stays: [
      s("Halekulani", "Waikīkī", "Luxury hotel", "luxury", 780, 21.278, -157.832, "Classic oceanfront hotel."),
      s("Queen Kapiʻolani Hotel", "Waikīkī", "Hotel", "mid", 260, 21.272, -157.821, "Retro-styled hotel with Diamond Head views."),
      s("Polynesian Hostel Beach Club", "Waikīkī", "Hostel", "budget", 55, 21.273, -157.822, "Simple hostel a block from the beach."),
    ],
  },
  {
    slug: "marrakech", name: "Marrakech", country: "Morocco", lat: 31.6295, lng: -7.9811, art: ["#d9825b", "#8a3b2e"],
    tagline: "Souks, riads and desert sunsets", trending: true,
    summary: "A sensory medina of markets and gardens, with the Atlas Mountains and stony desert within day-trip reach.",
    styles: ["Adventure", "Food and culture", "Romantic", "Budget-friendly", "Luxury"], weather: "warm",
    bestSeason: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], dailyCost: { budget: 40, mid: 95, luxury: 280 }, suggestedNights: 4,
    places: [
      p("Jemaa el-Fnaa", "Landmark", 31.6258, -7.9891, 0, 90, false, "The great square; most atmospheric after dark."),
      p("Bahia Palace", "Landmark", 31.6216, -7.983, 10, 60, false, "19th-century palace of painted ceilings and courtyards."),
      p("Jardin Majorelle", "Garden", 31.6417, -8.003, 17, 90, false, "Cobalt-blue garden; timed tickets online."),
      p("Medina souks", "Shopping", 31.631, -7.987, null, 150, false, "Labyrinth of spice, leather and lantern stalls."),
      p("Ben Youssef Madrasa", "Landmark", 31.632, -7.986, 5, 45, true, "Exquisitely restored Islamic college."),
      p("Atlas Mountains day trip", "Day trip", 31.137, -7.919, 45, 480, false, "Berber villages and valley walks around Imlil."),
      p("Traditional hammam", "Relaxation", 31.628, -7.988, 35, 90, true, "Steam, scrub and massage."),
      p("Agafay Desert sunset", "Outdoor adventure", 31.43, -8.25, 60, 300, false, "Camel or quad ride with dinner under the stars."),
      p("Saadian Tombs", "Landmark", 31.6173, -7.9886, 10, 45, false, "Richly decorated royal mausoleums."),
    ],
    food: [
      f("Nomad", "Modern Moroccan", 2, 22, 31.629, -7.987, "Rooftop terraces above the spice square."),
      f("Café des Épices", "Café", 1, 12, 31.6292, -7.9868, "Light lunches overlooking the souk."),
      f("Le Jardin", "Moroccan", 2, 20, 31.631, -7.988, "Leafy courtyard hidden in the medina."),
      f("Jemaa el-Fnaa food stalls", "Street food", 1, 8, 31.6258, -7.9891, "Nightly grills and harira soup."),
      f("Al Fassia Guéliz", "Moroccan", 3, 35, 31.636, -8.01, "Women-run restaurant known for slow-cooked lamb."),
    ],
    stays: [
      s("La Mamounia", "Medina edge", "Palace hotel", "luxury", 800, 31.622, -7.999, "Legendary hotel set in historic gardens."),
      s("Riad Kniza", "Medina", "Riad", "mid", 230, 31.634, -7.995, "Traditional courtyard house with a small pool."),
      s("Equity Point Marrakech", "Medina", "Hostel", "budget", 22, 31.63, -7.988, "Hostel in a converted riad."),
    ],
  },
  {
    slug: "reykjavik", name: "Reykjavík", country: "Iceland", lat: 64.1466, lng: -21.9426, art: ["#9fc4d6", "#2d4758"],
    tagline: "Waterfalls, lagoons and northern lights",
    summary: "A small, creative capital that serves as base camp for geysers, glaciers and geothermal pools.",
    styles: ["Adventure", "Romantic", "Solo travel", "Luxury"], weather: "cool",
    bestSeason: "June–August for hiking; September–March for northern lights", bestMonths: [6, 7, 8, 9, 2, 3], dailyCost: { budget: 110, mid: 230, luxury: 520 }, suggestedNights: 5,
    places: [
      p("Hallgrímskirkja", "Landmark", 64.1417, -21.9266, 10, 45, true, "Basalt-inspired church with a tower viewpoint."),
      p("Golden Circle day tour", "Day trip", 64.2559, -21.1295, 80, 480, false, "Þingvellir, Geysir and Gullfoss in one loop."),
      p("Blue Lagoon", "Relaxation", 63.8804, -22.4495, 95, 240, false, "Milky-blue geothermal spa; pre-booking essential."),
      p("Sky Lagoon", "Relaxation", 64.116, -21.946, 75, 150, false, "Oceanside infinity pool minutes from the centre."),
      p("Harpa & Old Harbour", "Neighbourhood walk", 64.1503, -21.9326, 0, 75, false, "Glass concert hall and waterfront stroll."),
      p("Whale watching", "Boat tour", 64.152, -21.942, 95, 180, false, "Tours depart the Old Harbour; sightings vary."),
      p("National Museum of Iceland", "Museum", 64.1417, -21.9485, 20, 90, true, "From settlement to the present day."),
      p("South Coast day trip", "Outdoor adventure", 63.6156, -19.9886, 110, 600, false, "Seljalandsfoss, Skógafoss and black-sand beaches."),
    ],
    food: [
      f("Bæjarins Beztu Pylsur", "Hot dogs", 1, 7, 64.1484, -21.9383, "The country's most famous hot-dog stand."),
      f("Icelandic Street Food", "Soup", 1, 18, 64.147, -21.936, "Lamb soup and fish stew in bread bowls."),
      f("Sandholt", "Bakery", 2, 18, 64.144, -21.927, "Fourth-generation bakery and brunch spot."),
      f("Hlemmur Mathöll", "Food hall", 2, 25, 64.1437, -21.915, "Former bus terminal turned food hall."),
      f("Messinn", "Seafood", 3, 45, 64.1475, -21.939, "Fish pans served sizzling at the table."),
    ],
    stays: [
      s("The Reykjavik EDITION", "Old Harbour", "Luxury hotel", "luxury", 600, 64.15, -21.935, "Waterfront hotel beside Harpa."),
      s("Fosshotel Reykjavík", "Höfðatorg", "Hotel", "mid", 230, 64.144, -21.91, "Large modern tower hotel."),
      s("Kex Hostel", "Skúlagata", "Hostel", "budget", 50, 64.145, -21.919, "Hostel in a former biscuit factory."),
    ],
  },
];

export const findDestination = (slugOrName: string) => {
  const k = slugOrName.trim().toLowerCase();
  return DESTINATIONS.find((d) => d.slug === k || d.name.toLowerCase() === k || d.name.toLowerCase().split(",")[0] === k.split(",")[0].trim() || (k.length > 3 && d.name.toLowerCase().includes(k)));
};

/** Deterministic two-tone art for destinations we have no photo for. */
export function artFor(name: string): [string, string] {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return [`hsl(${h} 45% 62%)`, `hsl(${(h + 150) % 360} 35% 32%)`];
}
