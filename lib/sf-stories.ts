// Featured San Francisco content — the city's legacy, the places that define
// its neighborhoods, and endorsements from local legends. Curated/demo content
// (like lib/demo-live.ts): real SF cultural legacy framed celebratory, plus
// ILLUSTRATIVE endorser personas. Swap the endorsers for real, verified quotes
// before presenting them as actual endorsements.

export interface SfStory {
  id: string;
  title: string;
  /** Card subtitle + article standfirst. */
  dek: string;
  /** Short line for the card. */
  summary: string;
  /** Full article body, one string per paragraph. */
  body: string[];
  neighborhood: string;
  /** "Since 1953" style legacy line. */
  since?: string;
  imageUrl: string;
  /** Optional member profile to deep-link to. */
  memberId?: string;
}

export interface SfLegend {
  id: string;
  name: string;
  /** Who they are — keep it real and recognizable as an SF archetype. */
  role: string;
  quote: string;
  imageUrl?: string;
}

export const SF_STORIES: SfStory[] = [
  {
    id: "karl-the-fog",
    title: "Meet Karl, the fog that runs the city",
    dek: "The first thing to understand about San Francisco is the weather — and it's not what you think.",
    summary: "Summers are cold, the fog has a name, and the neighborhood you're in changes everything.",
    neighborhood: "Citywide",
    imageUrl: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1200&q=70",
    body: [
      "San Francisco's summers are famously cold. The culprit is fog so iconic that locals gave it a name: Karl, after a beloved social-media persona. From roughly June through August a marine layer rolls in off the Pacific most afternoons, and “summer” can mean a gray, 55°F evening. The warmest, sunniest stretch is usually September and October.",
      "Crucially, the fog isn't everywhere at once. The city's hills carve it into microclimates: the Mission, Potrero Hill, and Bernal Heights can be sunny and 70° while the Sunset and Richmond, out by the ocean, sit socked in and fifteen degrees cooler at the very same moment.",
      "The newcomer rule: always carry a layer. A sunny morning downtown can turn into a windy, foggy afternoon by the water. Locals dress for three seasons in one day and trust what they see out the window over any forecast.",
    ],
  },
  {
    id: "city-of-villages",
    title: "Seven by seven: a city of villages",
    dek: "SF is tiny — about seven miles square — but every few blocks is a different world.",
    summary: "One small city, dozens of distinct neighborhoods. Learning the map by feel is how you feel at home.",
    neighborhood: "Neighborhoods",
    imageUrl: "https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?auto=format&fit=crop&w=1200&q=70",
    body: [
      "San Francisco packs an enormous amount of variety into roughly 49 square miles. Rather than one center, it's a patchwork of neighborhoods, each with its own character, weather, and crowd. Learning the map by feel is the fastest way to feel like you live here.",
      "A rough orientation: the Mission is sunny, Latino-rooted, and food-obsessed; the Castro is the historic heart of LGBTQ+ life; North Beach is Italian and literary; Chinatown is the oldest in North America; Hayes Valley and the Marina skew polished; and the Sunset and Richmond are foggy, quiet, and home to some of the best, most under-the-radar food in the city.",
      "Because the city is small and dense, you can pass through several of these in a single afternoon. The best way to know SF isn't to pick one neighborhood and stay — it's to wander a few and notice how fast the vibe (and the temperature) changes.",
    ],
  },
  {
    id: "getting-around",
    title: "Getting around: BART, Muni, and those hills",
    dek: "You don't need a car. You do need to understand the system — and the hills.",
    summary: "Muni, BART, and a Clipper card will take you almost anywhere. The cable cars are for tourists.",
    neighborhood: "Transit",
    imageUrl: "https://images.unsplash.com/photo-1521464302861-ce943915d1c3?auto=format&fit=crop&w=1200&q=70",
    body: [
      "San Francisco is one of the few U.S. cities where living car-free is genuinely easy. Muni runs the buses, light-rail Metro, and historic streetcars and cable cars; BART is the regional train that links the city to Oakland, Berkeley, the airport, and the wider Bay Area. A Clipper card — or your phone — works across all of them.",
      "Locals mostly skip the cable cars (slow, pricey, beloved by tourists) and rely on Muni and BART for daily life. The Metro tunnels under Market Street, then surfaces into the neighborhoods. Biking is great on the flat eastern side and brutal on the hills, so it pays to learn which streets climb.",
      "And the hills are real. They shape every walk and route; a spot “six blocks away” can be a steep climb. Comfortable shoes and a quick glance at the terrain before you set out go a long way.",
    ],
  },
  {
    id: "mission-burrito",
    title: "The Mission burrito, explained",
    dek: "A style of burrito born here is now copied around the world. Here's what to order.",
    summary: "Oversized, foil-wrapped, and fiercely defended — a burrito crawl is the perfect first weekend.",
    neighborhood: "Mission",
    since: "Since the 1960s",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=70",
    body: [
      "The “Mission burrito” — oversized, foil-wrapped, stuffed with rice, beans, meat, and salsa — was born in San Francisco's Mission District in the 1960s and became a template imitated nationwide. It's less a meal than a local institution.",
      "Taquerias here inspire real loyalty and friendly turf wars. Order at the counter, choose between a regular or a “super” (with guac and sour cream), and don't sleep on the al pastor or the crispy-cheese quesadilla. Many spots are cash-friendly, fast, and open late.",
      "For a newcomer, a Mission burrito crawl is a perfect first weekend: a few blocks of 24th and Mission will teach you more about the neighborhood — and the city's food culture — than any guidebook.",
    ],
  },
  {
    id: "mission-murals",
    title: "The Mission's living murals",
    dek: "Two alleys turned a neighborhood into an open-air museum of political art.",
    summary: "Balmy and Clarion Alleys have carried decades of art about immigration, justice, and joy.",
    neighborhood: "Mission",
    since: "Since the 1970s",
    imageUrl: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1200&q=70",
    body: [
      "Since the 1970s, the Mission has been the heart of San Francisco's mural movement. Balmy Alley and Clarion Alley are the most famous: narrow lanes where generations of artists have painted, repainted, and layered work about immigration, displacement, justice, and joy.",
      "The murals are living documents — they change as the neighborhood does, and many respond directly to the gentrification reshaping the Mission. Walking them is a free, moving introduction to what the community cares about.",
      "Local groups like Precita Eyes lead mural tours, but you can simply wander. Bring a coffee, take your time, and read the walls — it's some of the most honest storytelling in the city.",
    ],
  },
  {
    id: "north-beach-beats",
    title: "North Beach and the Beats",
    dek: "America's literary counterculture has an address — and it's still open.",
    summary: "City Lights published 'Howl' and stood trial for it. The bookstore is still a working shop.",
    neighborhood: "North Beach",
    since: "Since 1953",
    imageUrl: "https://images.unsplash.com/photo-1521747116042-5a810fda9664?auto=format&fit=crop&w=1200&q=70",
    body: [
      "In the 1950s, North Beach became the home of the Beat Generation. City Lights Booksellers, founded in 1953 by poet Lawrence Ferlinghetti, published Allen Ginsberg's “Howl” and stood trial for it — a landmark free-speech case. Kerouac, Ginsberg, and Cassady read and argued in these blocks.",
      "What makes it special is that it never became a museum. City Lights is still a working independent bookstore; Vesuvio next door still pours drinks; and the neighborhood's Italian heritage lives on in the espresso bars and old-school restaurants.",
      "For a newcomer, North Beach is a reminder that SF has long drawn people who come to write, dissent, and reinvent themselves. Spend an afternoon with a book and a coffee and you're part of the tradition.",
    ],
  },
  {
    id: "chinatown",
    title: "The oldest Chinatown in North America",
    dek: "Not a tourist set piece — a living neighborhood older than much of the city around it.",
    summary: "Founded in the Gold Rush, it survived 1906 and still feeds the community on Stockton Street.",
    neighborhood: "Chinatown",
    since: "Since 1848",
    imageUrl: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1200&q=70",
    body: [
      "San Francisco's Chinatown, established around the Gold Rush in 1848, is the oldest in North America and one of the largest Chinese communities outside Asia. It survived the 1906 earthquake and was deliberately rebuilt in the ornate style visitors see today.",
      "Look past Grant Avenue's souvenir shops and you'll find the real neighborhood on Stockton Street: century-old herbalists, dim sum halls, produce markets, and family associations that have anchored the community for generations.",
      "It's a place to eat well and cheaply, and to understand a piece of American history that's often glossed over. Go hungry, go on a weekday morning, and follow the locals to the busiest counters.",
    ],
  },
  {
    id: "ferry-building",
    title: "The Ferry Building: the city's larder",
    dek: "A 19th-century transit hub reborn as the best place to taste the Bay Area.",
    summary: "A grand 1898 terminal turned marketplace, ringed three days a week by the region's top farmers.",
    neighborhood: "Embarcadero",
    since: "Since 1898",
    imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=70",
    body: [
      "The Ferry Building, opened in 1898, was once among the busiest transit terminals in the world. After the freeway that hid it came down in the 1990s, it was reborn as a marketplace — a hall of local bakers, cheesemakers, coffee roasters, and restaurants.",
      "Three days a week, the farmers market wraps around the building, drawing the region's top farmers and the chefs who buy from them. It's the clearest, most delicious expression of the Bay Area's obsession with local, seasonal food.",
      "For a newcomer it's the easiest crash course in why people care so much about food here — and the Embarcadero promenade outside, with its bay and Bay Bridge views, is one of the city's great flat walks.",
    ],
  },
  {
    id: "castro",
    title: "The Castro and a movement's home",
    dek: "One neighborhood became the center of LGBTQ+ life and political power in America.",
    summary: "Harvey Milk's base and a place of both celebration and memory, marked by the giant rainbow flag.",
    neighborhood: "Castro",
    since: "Since the 1970s",
    imageUrl: "https://images.unsplash.com/photo-1571974599782-87624638275e?auto=format&fit=crop&w=1200&q=70",
    body: [
      "In the 1970s, the Castro became the most visible LGBTQ+ neighborhood in the country and the base from which Harvey Milk became one of the first openly gay elected officials in the United States. The giant rainbow flag at Castro and Market still marks the spot.",
      "It remains both a living community and a place of memory: the GLBT Historical Society Museum, the restored Castro Theatre, and the Pink Triangle and AIDS memorials sit alongside everyday bars, cafés, and shops.",
      "For anyone new to San Francisco, the Castro is essential context for the city's identity as a place of refuge and reinvention — a role it has played, for many communities, for well over a century.",
    ],
  },
];

export function getSfStory(id: string): SfStory | undefined {
  return SF_STORIES.find((s) => s.id === id);
}

// ── Real SF spots loved/backed by real celebrities ─────────────────────────
// Public associations sourced from press (SFGATE, ABC7, KQED, Vogue, etc.).
// Framed as "loved by / a favorite of / backed by", not formal endorsements.
// Celebrity photos are Wikimedia/Wikipedia (public); a wrong/empty URL falls
// back to an initials avatar in the UI.

export interface Endorser {
  name: string;
  img?: string;
}

export interface SfEndorsement {
  id: string;
  business: string;
  neighborhood: string;
  category: string;
  note: string;
  endorsers: Endorser[];
  /** Optional member profile to deep-link to. */
  memberId?: string;
}

const PHOTO = {
  bourdain:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Anthony_Bourdain_Peabody_2014b.jpg/330px-Anthony_Bourdain_Peabody_2014b.jpg",
  keanu:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Keanu_Reeves_at_TIFF_2025_02_%28Cropped%29.jpg/330px-Keanu_Reeves_at_TIFF_2025_02_%28Cropped%29.jpg",
  odenkirk:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Bob_Odenkirk_at_53rd_Saturn_Awards_2026-02.jpg/330px-Bob_Odenkirk_at_53rd_Saturn_Awards_2026-02.jpg",
  mulaney:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/John_Mulaney_PaleyFest_crop.jpg/330px-John_Mulaney_PaleyFest_crop.jpg",
  curry:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Stephen_Curry%2C_Olympic_Games_2024_%28cropped%29.jpg/330px-Stephen_Curry%2C_Olympic_Games_2024_%28cropped%29.jpg",
  durant:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Kevin_Durant%2C_Paris_2024_%28cropped%29.jpg/330px-Kevin_Durant%2C_Paris_2024_%28cropped%29.jpg",
  montana:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Joe_Montana_Super_Bowl_50_%28cropped%29.jpg/330px-Joe_Montana_Super_Bowl_50_%28cropped%29.jpg",
  ayesha:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Ayesha_Curry_at_GOAT_Premiere.png/330px-Ayesha_Curry_at_GOAT_Premiere.png",
  weir:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Bob_Weir_1975_%28Cropped%29.jpg/330px-Bob_Weir_1975_%28Cropped%29.jpg",
  ginsberg:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Allen_Ginsberg_1979_-_cropped.jpg/330px-Allen_Ginsberg_1979_-_cropped.jpg",
  kerouac:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Kerouac_by_Palumbo_2_%28cropped%29.png/330px-Kerouac_by_Palumbo_2_%28cropped%29.png",
  choe: "https://upload.wikimedia.org/wikipedia/commons/b/b1/David_Choe%2C_2010.jpg",
  draymond:
    "https://commons.wikimedia.org/wiki/Special:FilePath/Draymond_Green_2019.jpg?width=330",
} as const;

export const SF_ENDORSEMENTS: SfEndorsement[] = [
  {
    id: "swan-oyster-depot",
    business: "Swan Oyster Depot",
    neighborhood: "Polk Street",
    category: "Seafood counter",
    note: "Anthony Bourdain called this tiny Polk Street counter his SF “happy zone” and praised it for years — turning it into a global food pilgrimage.",
    endorsers: [{ name: "Anthony Bourdain", img: PHOTO.bourdain }],
  },
  {
    id: "house-of-nanking",
    business: "House of Nanking",
    neighborhood: "Chinatown",
    category: "Chinese",
    note: "A Chinatown institution connected to Bob Odenkirk, Keanu Reeves, Anthony Bourdain and John Mulaney (per SFGATE).",
    endorsers: [
      { name: "Bob Odenkirk", img: PHOTO.odenkirk },
      { name: "Keanu Reeves", img: PHOTO.keanu },
      { name: "Anthony Bourdain", img: PHOTO.bourdain },
      { name: "John Mulaney", img: PHOTO.mulaney },
    ],
  },
  {
    id: "city-lights",
    business: "City Lights Booksellers",
    neighborhood: "North Beach",
    category: "Bookstore",
    note: "Not just endorsed — a real Beat Generation home, where Kerouac, Ginsberg and Cassady read and gathered.",
    endorsers: [
      { name: "Allen Ginsberg", img: PHOTO.ginsberg },
      { name: "Jack Kerouac", img: PHOTO.kerouac },
      { name: "Neal Cassady" },
    ],
  },
  {
    id: "upper-playground",
    business: "Upper Playground",
    neighborhood: "Haight / Fillmore",
    category: "Streetwear & art",
    note: "SF streetwear and art shop deeply tied to local artists — Jeremy Fish, Sam Flores and David Choe among them.",
    endorsers: [
      { name: "David Choe", img: PHOTO.choe },
      { name: "Jeremy Fish" },
      { name: "Sam Flores" },
    ],
  },
  {
    id: "sweetwater",
    business: "Sweetwater Music Hall",
    neighborhood: "Mill Valley",
    category: "Music venue",
    note: "A Bay Area music hall with deep Grateful Dead ties — Bob Weir among its celebrity-musician affiliations.",
    endorsers: [{ name: "Bob Weir", img: PHOTO.weir }],
  },
  {
    id: "tartine",
    business: "Tartine Bakery",
    neighborhood: "Mission",
    category: "Bakery",
    note: "Owner Chad Robertson became a celebrity artisan baker — Vogue profiled him as a major figure in American bread.",
    endorsers: [{ name: "Chad Robertson" }],
  },
  {
    id: "kokkari",
    business: "Kokkari Estiatorio",
    neighborhood: "Jackson Square",
    category: "Greek",
    note: "Kevin Durant publicly named Kokkari one of his favorite SF restaurants during his Warriors years.",
    endorsers: [{ name: "Kevin Durant", img: PHOTO.durant }],
  },
  {
    id: "north-beach-restaurant",
    business: "North Beach Restaurant",
    neighborhood: "North Beach",
    category: "Italian",
    note: "A classic SF Italian spot named a Kevin Durant favorite and a Warriors-crew go-to (KQED).",
    endorsers: [{ name: "Kevin Durant", img: PHOTO.durant }],
  },
  {
    id: "la-mediterranee",
    business: "La Méditerranée",
    neighborhood: "Castro / Fillmore",
    category: "Lebanese-Armenian",
    note: "Tied to Joe Montana's legendary “John Candy” story (ABC7) — a long-running neighborhood favorite.",
    endorsers: [{ name: "Joe Montana", img: PHOTO.montana }],
  },
  {
    id: "meski",
    business: "Meski",
    neighborhood: "Lower Nob Hill",
    category: "Ethiopian-Dominican",
    note: "Draymond Green is an owner/backer of this Ethiopian-Dominican fusion restaurant.",
    endorsers: [{ name: "Draymond Green", img: PHOTO.draymond }],
  },
  {
    id: "koja-kitchen",
    business: "KoJa Kitchen",
    neighborhood: "San Francisco",
    category: "Korean-Mexican",
    note: "Recent Bay Area coverage calls KoJa one of Stephen Curry's favorite local spots.",
    endorsers: [{ name: "Stephen Curry", img: PHOTO.curry }],
  },
  {
    id: "international-smoke",
    business: "International Smoke",
    neighborhood: "San Francisco",
    category: "BBQ",
    note: "Ayesha Curry co-founded International Smoke with chef Michael Mina; Steph was closely tied to its public story.",
    endorsers: [
      { name: "Ayesha Curry", img: PHOTO.ayesha },
      { name: "Stephen Curry", img: PHOTO.curry },
    ],
  },
  {
    id: "eat-learn-play",
    business: "200 Oakland restaurants",
    neighborhood: "Oakland",
    category: "Community · Eat. Learn. Play.",
    note: "Steph & Ayesha Curry supported 200 Oakland restaurants during COVID through a World Central Kitchen meals program.",
    endorsers: [
      { name: "Stephen Curry", img: PHOTO.curry },
      { name: "Ayesha Curry", img: PHOTO.ayesha },
    ],
  },
];

// ILLUSTRATIVE endorser personas — placeholders for real, verified endorsements.
export const SF_LEGENDS: SfLegend[] = [
  {
    id: "carla-mendez",
    name: "Carla Mendez",
    role: "3rd-generation Mission taquera",
    quote: "This city is its corner shops. Keep them alive and you keep San Francisco alive.",
  },
  {
    id: "marcus-lee",
    name: "Marcus Lee",
    role: "SF muralist & lifelong local",
    quote: "Every block here has a story painted on it. WhatsLocal puts those stories on the map.",
  },
  {
    id: "dede-wong",
    name: "Dede Wong",
    role: "Chinatown shopkeeper, 40 years",
    quote: "We've been here through every wave. Neighbors finding us is how we stay.",
  },
  {
    id: "andre-soto",
    name: "Andre Soto",
    role: "Warriors superfan & sports-bar owner",
    quote: "Nothing beats your neighborhood spot on game night. That's the whole city right there.",
  },
];
