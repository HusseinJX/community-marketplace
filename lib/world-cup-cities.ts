export interface WorldCupNeighborhood {
  name: string;
  note: string;
}

export interface WorldCupEssenceImage {
  src: string;
  alt: string;
}

export interface WorldCupEssence {
  poem: string;
  body: string;
  images: WorldCupEssenceImage[];
}

export interface CityChapter {
  era?: string;
  title: string;
  body: string;
  image?: string; // Unsplash photo ID
  imageAlt?: string;
}

export interface CityPerson {
  emoji: string;
  title: string;
  body: string;
}

export interface CityDish {
  name: string;
  body: string;
}

export interface CityNarrative {
  chapters: CityChapter[];
  people: CityPerson[];
  sounds: string[];
  foods: CityDish[];
}

export interface CityMatch {
  date: string;       // e.g. "2026-07-14"
  time: string;       // local time, e.g. "3:00 PM"
  stage: string;      // e.g. "Group Stage", "Round of 16", "Quarter-final"
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  venue: string;
}

export interface WorldCupCity {
  slug: string;
  name: string;
  displayName: string;
  country: "USA" | "Canada" | "Mexico";
  flag: string;
  region: string;
  stadium: string;
  gradient: string;
  accentFrom: string;
  accentTo: string;
  imagePath: string; // Unsplash CDN path e.g. "photo-1234567890"
  vibe: string;
  essence?: WorldCupEssence;
  narrative?: CityNarrative;
  pillars: string[];
  neighborhoods: WorldCupNeighborhood[];
  beforeYouArrive: string;
  matches?: CityMatch[];
}

export function cityImageUrl(path: string, w = 800): string {
  if (path.startsWith("/")) return path; // local public asset — ignore width param
  return `https://images.unsplash.com/${path}?auto=format&fit=crop&w=${w}&q=80`;
}

export const WORLD_CUP_CITIES: WorldCupCity[] = [
  // ── USA ─────────────────────────────────────────────────────────────────
  {
    slug: "atlanta",
    name: "Atlanta",
    displayName: "Atlanta",
    country: "USA",
    flag: "🇺🇸",
    region: "Georgia",
    stadium: "Mercedes-Benz Stadium",
    gradient: "from-rose-600 via-purple-700 to-indigo-800",
    accentFrom: "from-rose-500",
    accentTo: "to-purple-600",
    imagePath: "photo-1753744402410-44319f72f8c5",
    vibe:
      "Atlanta is movement. Civil rights memory, Black excellence, music, film, business, churches, colleges, highways, and heat rising from the pavement. It is a city that knows history is not past. It is still active. Still organizing. Still creating. Atlanta turns struggle into institution, rhythm, style, and power.",
    pillars: ["civil rights", "hip-hop", "HBCUs", "Black business", "film", "food"],
    neighborhoods: [
      { name: "Sweet Auburn", note: "The birthplace of the civil rights movement — MLK's church, his birth home, the history you came to feel." },
      { name: "West End", note: "One of Atlanta's oldest Black neighborhoods, home to the Wren's Nest and a creative community building its own future." },
      { name: "Little Five Points", note: "Underground record shops, murals, thrift culture, music venues — Atlanta's counterculture corridor." },
      { name: "Ponce City Market", note: "A restored mill turned into a hub of local food, design, and Atlanta's new energy." },
    ],
    beforeYouArrive:
      "Atlanta does not owe you a map. The city is spread across highways and neighborhoods that don't connect the way grids do. Get off the main roads. The culture lives in the blocks between the landmarks. Food is serious here — from hole-in-the-wall soul food to James Beard-level kitchens. Dress for summer heat even in June.",
  },
  {
    slug: "boston",
    name: "Boston",
    displayName: "Boston",
    country: "USA",
    flag: "🇺🇸",
    region: "Massachusetts",
    stadium: "Gillette Stadium",
    gradient: "from-blue-800 via-blue-700 to-sky-600",
    accentFrom: "from-blue-700",
    accentTo: "to-sky-500",
    imagePath: "photo-1768326530593-00a0b2627063",
    vibe:
      "Boston is older than the country. Brick and cobblestone and memory. Irish identity, Black history in Roxbury and Dorchester, a university culture that keeps the city young and restless. Sports are sacred here. The harbor is still there. So is the attitude. Boston is proud, occasionally difficult, and serious about its past — but underneath the history, the city is alive and changing.",
    pillars: ["history", "academia", "Irish culture", "Black culture", "seafood", "sports"],
    neighborhoods: [
      { name: "Roxbury", note: "The heart of Boston's Black community — culture, music, activism, and institutions built over generations." },
      { name: "The North End", note: "Boston's oldest neighborhood: narrow streets, Italian bakeries, cannoli, and a harbor that still feels like the original city." },
      { name: "Jamaica Plain", note: "Artists, Latin culture, local food, and a pond — a neighborhood that resisted gentrification longer than most." },
      { name: "Chinatown", note: "Small but dense, with some of the best late-night food in the city — Vietnamese, Cantonese, and everything in between." },
    ],
    beforeYouArrive:
      "Boston's neighborhoods have specific pride and specific histories. Learn which area you're in before assuming. The T (subway) reaches the stadium but gets crowded on match days. The city runs on Dunkin', not Starbucks. Cold in the morning, warm by afternoon in June — layer accordingly.",
  },
  {
    slug: "dallas",
    name: "Dallas",
    displayName: "Dallas / Fort Worth",
    country: "USA",
    flag: "🇺🇸",
    region: "Texas",
    stadium: "AT&T Stadium",
    gradient: "from-amber-500 via-orange-600 to-red-700",
    accentFrom: "from-amber-500",
    accentTo: "to-orange-600",
    imagePath: "photo-1631660975301-b2b65e80c98a",
    vibe:
      "Dallas believes in itself without apology. It is Texan in the old sense — open land, big sky, certainty about the size of everything — and in the new sense — global money, stadium culture, a restaurant scene that keeps expanding outward. Hispanic roots run through it deeper than the skyline suggests. The city knows how to host.",
    pillars: ["Texan identity", "Mexican culture", "BBQ", "live music", "cowboy heritage", "big business"],
    neighborhoods: [
      { name: "Deep Ellum", note: "Blues, jazz, murals, bars, and live music in a district that has been the city's creative pulse for over a century." },
      { name: "Oak Cliff", note: "Dallas's most culturally layered neighborhood — Latino food, vintage shops, local art, and Bishop Arts District." },
      { name: "Uptown", note: "Walkable by Dallas standards, packed with restaurants and nightlife, the city's young professional energy." },
      { name: "Greenville Avenue", note: "Restaurant row that runs from dive bars to James Beard nominees — start hungry." },
    ],
    beforeYouArrive:
      "Dallas is car culture. Most of what you want is spread across a region larger than some countries. Rent a car or plan around DART light rail to the stadium. The heat in June is real — stay hydrated, dress light, and start your day early. Tipping culture is strong; service workers here depend on it.",
  },
  {
    slug: "houston",
    name: "Houston",
    displayName: "Houston",
    country: "USA",
    flag: "🇺🇸",
    region: "Texas",
    stadium: "NRG Stadium",
    gradient: "from-orange-500 via-amber-600 to-yellow-500",
    accentFrom: "from-orange-500",
    accentTo: "to-amber-500",
    imagePath: "photo-1622007149524-9d73353bd327",
    vibe:
      "Houston is the most quietly radical city in the country. The most diverse major city in America — Vietnamese, Salvadoran, Nigerian, Indian, and Mexican communities that built entire ecosystems inside the sprawl. There is no tidy downtown grid holding it together. Just highways, heat, and energy. The food here is extraordinary. The culture is underrated. The city contains multitudes and has no interest in being summarized.",
    pillars: ["diversity", "Tex-Mex", "Vietnamese", "Nigerian", "energy industry", "NASA", "zydeco"],
    neighborhoods: [
      { name: "Midtown", note: "Where Houston's creative class eats, drinks, and organizes — walkable, diverse, full of murals and patios." },
      { name: "Mahatma Gandhi District", note: "Houston's South Asian corridor: sari shops, biryani, mithai, and a community that built its own world here." },
      { name: "Bellaire / Chinatown", note: "A Vietnamese and Chinese commercial corridor with some of the best pho, banh mi, and dim sum in the South." },
      { name: "Freedmen's Town (4th Ward)", note: "One of the country's oldest African American neighborhoods — historic churches, architecture, and deep memory." },
    ],
    beforeYouArrive:
      "Houston requires a car and patience. The sprawl is real; distances that look short on a map take 30 minutes in traffic. June heat is intense — humidity makes it feel hotter. The city rewards those who explore off the main roads. Ask locals where they eat. The best spots are rarely reviewed anywhere.",
  },
  {
    slug: "kansas-city",
    name: "Kansas City",
    displayName: "Kansas City",
    country: "USA",
    flag: "🇺🇸",
    region: "Missouri / Kansas",
    stadium: "Arrowhead Stadium",
    gradient: "from-red-700 via-red-600 to-amber-500",
    accentFrom: "from-red-600",
    accentTo: "to-amber-500",
    imagePath: "photo-1619195048903-299e7f2f686b",
    vibe:
      "Kansas City is where the country's roots go deep and quiet. Jazz was born here and named elsewhere. The barbecue tradition is not regional pride — it is craft, slow and serious. The Crossroads art district turned industrial into alive. Chiefs football is religion. The city sits on a border — Missouri and Kansas, past and present, working class and creative — and holds both without needing to choose.",
    pillars: ["jazz", "BBQ", "Chiefs football", "art", "working class roots", "heartland"],
    neighborhoods: [
      { name: "18th & Vine", note: "The jazz district — Charlie Parker grew up nearby, and the history is still audible in the clubs that remain." },
      { name: "Crossroads Arts District", note: "Galleries, studios, food halls, and First Fridays: the city's creative center in converted warehouses." },
      { name: "Westport", note: "The oldest commercial district in the city — bars, live music, and a neighborhood that stays up late." },
      { name: "River Market", note: "A produce market since the 1800s, still running — great for street food, local vendors, and Sunday mornings." },
    ],
    beforeYouArrive:
      "The BBQ debate is real and regional: KC style is slow-smoked with a thick, sweet-savory sauce. Try more than one spot — locals have loyalties. The city straddles two states, which creates mild logistical oddity (different time zones for some events). Public transit is limited; a car helps for stadium access.",
  },
  {
    slug: "los-angeles",
    name: "Los Angeles",
    displayName: "Los Angeles",
    country: "USA",
    flag: "🇺🇸",
    region: "California",
    stadium: "SoFi Stadium",
    gradient: "from-orange-400 via-pink-500 to-purple-600",
    accentFrom: "from-orange-400",
    accentTo: "to-pink-500",
    imagePath: "photo-1767681774612-a3062667f6ac",
    vibe:
      "Los Angeles is a machine that makes dreams feel possible and occasionally true. It runs on movement — cars, cameras, ambition, music, migration. Latino culture shapes the sound, the food, the calendar, the street. The industry shapes the image. The ocean and the mountains hold it all in a frame that never quite fits because the city is always overflowing its edges.",
    pillars: ["Latino culture", "film", "music", "fashion", "beach culture", "street food"],
    neighborhoods: [
      { name: "Boyle Heights", note: "The heart of Mexican American LA — murals, panaderías, mercados, and a community that has held its ground." },
      { name: "Leimert Park", note: "The cultural center of Black Los Angeles: jazz, art, spoken word, and community anchored in Crenshaw." },
      { name: "Koreatown", note: "Dense, 24-hour, full of karaoke, Korean BBQ, and one of the most vital immigrant-built neighborhoods in America." },
      { name: "Echo Park / Silver Lake", note: "Where LA's creative edge lives — record shops, taquerias, murals, and the lake itself." },
    ],
    beforeYouArrive:
      "LA without a car is a different city. Traffic is not a surprise — it is the baseline. Plan extra time for everything. The beach is 30 minutes from downtown in good traffic; in bad traffic, it is a different kind of afternoon. Sunscreen is not optional. The best food in LA is not in tourist areas — it is in strip malls off major boulevards.",
  },
  {
    slug: "miami",
    name: "Miami",
    displayName: "Miami",
    country: "USA",
    flag: "🇺🇸",
    region: "Florida",
    stadium: "Hard Rock Stadium",
    gradient: "from-cyan-400 via-pink-400 to-fuchsia-600",
    accentFrom: "from-cyan-400",
    accentTo: "to-pink-500",
    imagePath: "photo-1754269675202-6fb0016d9f21",
    vibe:
      "Miami runs on heat — literal, cultural, commercial, physical. Cuban and Caribbean identity gave the city its rhythm, its food, its defiance, its sense of time. Wynwood became art. South Beach became spectacle. Little Havana stayed itself. The music changes block by block — reggaeton, bachata, Haitian kompa, hip-hop rising from Overtown. Miami knows how to be beautiful. It also knows how to be hard.",
    pillars: ["Cuban culture", "Caribbean", "art deco", "reggaeton", "nightlife", "Latin fusion food"],
    neighborhoods: [
      { name: "Little Havana", note: "Calle Ocho, dominoes in the park, cafecito through a window, murals, and the living heart of Cuban Miami." },
      { name: "Wynwood", note: "What a neighborhood looks like when artists take over a warehouse district — still interesting despite the crowds." },
      { name: "Little Haiti", note: "Haitian culture, kompa music, botanicas, and a neighborhood that moves to its own rhythm." },
      { name: "Overtown", note: "Miami's historic Black neighborhood — once called 'the Harlem of the South,' still carrying that story." },
    ],
    beforeYouArrive:
      "Miami time is real — events start late, nights run long, and schedules are suggestions. Spanish is the primary language in most neighborhoods; at minimum, know how to order in it. The heat and humidity are extreme in June. Dress accordingly, stay hydrated, and do not underestimate the sun off the water.",
  },
  {
    slug: "new-york",
    name: "New York",
    displayName: "New York / New Jersey",
    country: "USA",
    flag: "🇺🇸",
    region: "New York / New Jersey",
    stadium: "MetLife Stadium",
    gradient: "from-indigo-700 via-slate-700 to-zinc-700",
    accentFrom: "from-indigo-600",
    accentTo: "to-slate-600",
    imagePath: "photo-1764782979306-1e489462d895",
    vibe:
      "New York does not introduce itself. It moves at its own velocity and expects the world to keep up. Five boroughs, a hundred languages, a thousand neighborhoods — each with its own story, its own kitchen, its own particular pride. The city was built on arrival. On ambition that had nowhere else to go. It still feels like that. Dense, electric, punishing, and irreplaceable.",
    pillars: ["immigration", "finance", "hip-hop", "art", "fashion", "pizza"],
    neighborhoods: [
      { name: "Jackson Heights, Queens", note: "The most linguistically diverse neighborhood on earth — Nepali, Tibetan, Colombian, Indian, and dozens more, block by block." },
      { name: "Harlem", note: "The cultural capital of Black America, a century of music, literature, and institution-building that shaped the world." },
      { name: "Bushwick, Brooklyn", note: "Murals on every wall, artists in every building, and a nightlife scene that starts well after midnight." },
      { name: "The Bronx", note: "Where hip-hop was born — visit the block, Yankee Stadium, Arthur Avenue's Italian market, and the botanical garden in one day." },
    ],
    beforeYouArrive:
      "The subway is the only way to understand New York. It runs 24 hours and connects everything. MetLife Stadium is in New Jersey — take the NJ Transit train from Penn Station. Do not take taxis on game days. New York is loud, fast, and always under construction. Match the energy or step to the side.",
  },
  {
    slug: "philadelphia",
    name: "Philadelphia",
    displayName: "Philadelphia",
    country: "USA",
    flag: "🇺🇸",
    region: "Pennsylvania",
    stadium: "Lincoln Financial Field",
    gradient: "from-blue-700 via-indigo-700 to-blue-900",
    accentFrom: "from-blue-600",
    accentTo: "to-indigo-700",
    imagePath: "photo-1650389827024-4645a00b5095",
    vibe:
      "Philadelphia is not trying to impress you. It knows what it is. Grit, history, murals on every wall, block pride, serious food, serious basketball, serious sense of self. The city that drafted independence also built one of the most resilient Black urban cultures in America. Roxborough, Fishtown, West Philly, South Philly — each neighborhood has its own particular attitude. The spirit here does not perform. It just exists.",
    pillars: ["history", "Black culture", "murals", "cheesesteaks", "soul food", "working class pride"],
    neighborhoods: [
      { name: "West Philadelphia", note: "University City bleeds into a Black neighborhood with deep culture, community gardens, and one of the best food scenes in the city." },
      { name: "South Philly", note: "Italian Market, row houses, cheesesteaks, and a neighborhood pride that runs generational." },
      { name: "Fishtown", note: "A former working-class waterfront neighborhood turned into Philly's creative and nightlife district." },
      { name: "North Philly", note: "Puerto Rican culture, murals, La Feria de la Hispanidad — a community that builds its own visibility." },
    ],
    beforeYouArrive:
      "Philly is a city of neighborhoods, and each one has its own rules. The cheesesteak debate (Pat's vs. Geno's vs. somewhere else entirely) is a trap — the better spots are neither tourist landmark. SEPTA (transit) connects you to the stadium. The city has a chip on its shoulder about New York, and they are proud of it.",
  },
  {
    slug: "san-francisco",
    name: "San Francisco",
    displayName: "San Francisco Bay Area",
    country: "USA",
    flag: "🇺🇸",
    region: "California",
    stadium: "Levi's Stadium",
    gradient: "from-teal-500 via-sky-600 to-violet-700",
    accentFrom: "from-teal-500",
    accentTo: "to-violet-600",
    imagePath: "photo-1759994984308-da575aa5f009",
    vibe:
      "The Bay holds contradiction without resolving it. Technology wealth beside visible poverty. Indigenous land beneath the most expensive real estate on earth. A city of activism and displacement, fog and brilliance, taquerias and billion-dollar campuses. Oakland brings the soul. San Francisco carries the tension. The Bay Area is all of it at once — never simple, never finished.",
    essence: {
      poem: "Fog and circuitry. Ocean cold and golden hills. Skaters, builders, artists, fighters, dreamers — people trying to invent the future while standing on sacred ground.",
      body: "San Francisco Bay Area is fog, water, hills, bridges, code, protest, art, nature, wealth, contradiction, and invention. It is a place where the future keeps being imagined before the present has healed. Its culture lives in skaters, builders, activists, small businesses, athletes, dreamers, and people trying to make meaning on the edge of the continent.",
      images: [
        { src: "/world-cup/sf-soul.png", alt: "San Francisco — fog and circuitry, skaters, musicians, builders, dreamers" },
        { src: "photo-1501594907352-04cda38ebc29", alt: "Golden Gate Bridge rising through San Francisco fog" },
        { src: "photo-1518770660439-4636190af475", alt: "Circuit board — the invisible architecture beneath the Bay Area" },
        { src: "photo-1449034446853-66c86144b0ad", alt: "The Bay at night, bridges lit across dark water" },
        { src: "photo-1508193638397-1c4234db14d8", alt: "Golden California hills at the edge of the continent" },
      ],
    },
    narrative: {
      chapters: [
        {
          era: "10,000 years — 1848",
          title: "Before the rush",
          body: "Ohlone people lived on this bay for ten thousand years. They knew the fog, the bay, the hills. Then the Spanish, then the Mexicans, then the gold fever came and remade everything. The city that became San Francisco was built on land that was already ancient. That history is still here — still under the surface, still unresolved.",
          image: "photo-1551279816-a650ca6fb15b",
          imageAlt: "San Francisco's Painted Ladies Victorian houses at Alamo Square with the modern city skyline behind",
        },
        {
          era: "1848 — 1970s",
          title: "The world arrives",
          body: "Gold brought the Chinese, the Irish, the Italians, the Filipinos, the Mexicans. The waterfront built muscle. Chinatown survived earthquake and fire and rebuilt itself. The Beats questioned everything from North Beach. The Summer of Love bloomed in the Haight. Harvey Milk in the Castro. The city kept reinventing what freedom meant — and paying for it.",
          image: "photo-1745814512036-6407d2b9b1be",
          imageAlt: "Red lanterns in a San Francisco Chinatown alleyway",
        },
        {
          era: "1980s — 2000s",
          title: "Crisis and creation",
          body: "The AIDS crisis hit San Francisco harder than almost anywhere. The community organized, fought back, and built institutions that changed how the world responded. Out of grief came ACT UP, the Names Project, the quilt. The city learned what it costs to show up — and what it means to survive.",
          image: "photo-1621606016586-ebe58f96c2e5",
          imageAlt: "The Castro Theatre marquee and rainbow flags on Castro Street, San Francisco",
        },
        {
          era: "1995 — now",
          title: "The new gold rush",
          body: "Then the internet. Then the smartphones. Then the money. Rents tripled. Teachers and nurses drove three hours to work. Tech buses became the symbol of a city losing its character to its own success. But the murals stayed up. The burritos still come out at 2am. The activists never stopped. The contradiction is not resolved. It may be the point.",
          image: "photo-1598911154093-f12ac1883040",
          imageAlt: "San Francisco skyline at night — Salesforce Tower, Bay Bridge lights, the city that tech built",
        },
      ],
      people: [
        { emoji: "🛹", title: "The Skater", body: "Embarcadero has been a skateboarding mecca since the '80s. They cracked down, they came back. The city is a skatepark if you know how to read its hills, ledges, and plazas." },
        { emoji: "💻", title: "The Coder", body: "Laptop open in a Mission café, equity on the horizon, rent impossible, building the next thing. They came for the promise. Some stayed and changed the place. Most got changed by it." },
        { emoji: "🎨", title: "The Muralist", body: "The Mission walls have been painted and repainted for fifty years. Every mural is an argument for visibility. Every new layer is a reply to what came before." },
        { emoji: "🏈", title: "The Faithful", body: "49ers Nation travels. They tailgate at Levi's in the South Bay sun while the city sits in fog. They've been through dynasties and droughts. The faith doesn't break." },
        { emoji: "✊", title: "The Activist", body: "San Francisco has protested longer and louder than almost anywhere in America. From the dockworkers' strike of 1934 through Harvey Milk through AIDS through today — this city has always had people who refuse to go quiet." },
        { emoji: "🌊", title: "The Surfer", body: "Ocean Beach is cold, powerful, and unforgiving. The people who surf it every morning know something about the city that the tech campuses don't. The Pacific doesn't care about your valuation." },
      ],
      sounds: ["Grateful Dead", "Too $hort", "Mac Dre", "Latin from the Mission", "Jazz from the Fillmore", "SF Symphony", "DIY punk", "cumbia"],
      foods: [
        { name: "Mission burrito", body: "Not Mexican. San Franciscan. The full meal in foil — rice, beans, guac, meat, sour cream — invented on 24th Street and copied badly everywhere else." },
        { name: "Dungeness crab", body: "The bay provides. Cracked at a table on the Embarcadero or from a bag on a curb. December through April. Cold hands, sweet meat." },
        { name: "Sourdough", body: "The bacteria in SF sourdough starter is specific to this place. You cannot replicate it elsewhere. The bread tastes like the fog — wild, alive, slightly sharp." },
        { name: "Dim sum", body: "Sunday morning in the Sunset or the Richmond. Carts rolling, families at round tables, the language of the neighborhood filling the room." },
      ],
    },
    pillars: ["tech", "Latino culture", "activism", "AAPI culture", "Oakland soul", "the Mission"],
    neighborhoods: [
      { name: "The Mission, SF", note: "Murals, taquerias, Mission burritos, gentrification resistance, and the city's Latinx cultural core." },
      { name: "Fruitvale, Oakland", note: "Oakland's Mexican and Central American heart — Day of the Dead altars, tamales, and community that doesn't wait for outside permission." },
      { name: "Japantown, SF", note: "One of three remaining Japantowns in the US — a community rebuilt after internment, still very much alive." },
      { name: "Chinatown, SF", note: "The oldest Chinatown in North America, still functioning as a real neighborhood for Chinese-speaking SF residents." },
    ],
    beforeYouArrive:
      "The stadium is in Santa Clara — the Bay Area is large. Plan travel around BART + VTA transit or a car. SF summers are cold; the fog is real even in June. Oakland is a different city with its own culture — do not treat it as an extension of SF. Bring layers regardless of what the forecast says.",
    matches: [
      { date: "2026-06-15", time: "3:00 PM", stage: "Group Stage", home: "Mexico", away: "Ecuador", homeFlag: "🇲🇽", awayFlag: "🇪🇨", venue: "Levi's Stadium, Santa Clara" },
      { date: "2026-06-19", time: "6:00 PM", stage: "Group Stage", home: "Argentina", away: "Canada", homeFlag: "🇦🇷", awayFlag: "🇨🇦", venue: "Levi's Stadium, Santa Clara" },
      { date: "2026-06-23", time: "9:00 PM", stage: "Group Stage", home: "Portugal", away: "Morocco", homeFlag: "🇵🇹", awayFlag: "🇲🇦", venue: "Levi's Stadium, Santa Clara" },
      { date: "2026-06-27", time: "3:00 PM", stage: "Group Stage", home: "Germany", away: "Japan", homeFlag: "🇩🇪", awayFlag: "🇯🇵", venue: "Levi's Stadium, Santa Clara" },
      { date: "2026-07-02", time: "6:00 PM", stage: "Round of 32", home: "TBD", away: "TBD", homeFlag: "🏳️", awayFlag: "🏳️", venue: "Levi's Stadium, Santa Clara" },
      { date: "2026-07-08", time: "9:00 PM", stage: "Round of 16", home: "TBD", away: "TBD", homeFlag: "🏳️", awayFlag: "🏳️", venue: "Levi's Stadium, Santa Clara" },
    ],
  },
  {
    slug: "seattle",
    name: "Seattle",
    displayName: "Seattle",
    country: "USA",
    flag: "🇺🇸",
    region: "Washington",
    stadium: "Lumen Field",
    gradient: "from-emerald-600 via-teal-600 to-cyan-700",
    accentFrom: "from-emerald-500",
    accentTo: "to-teal-600",
    imagePath: "photo-1779515669672-c76cece7108a",
    vibe:
      "Seattle lives under layers — cloud, canopy, coast. Rain made the culture inward, patient, deeply musical. The Pacific Northwest feels alive in a specific way: green and ancient and breathing. Indigenous presence shapes the land and the awareness. Coffee, grunge, ferries, mountains, Pike Place, Asian Pacific culture woven into the grain of it. A city that grew fast and still seems to be listening for something underneath.",
    pillars: ["Indigenous land", "AAPI culture", "coffee", "grunge", "outdoors", "Pike Place"],
    neighborhoods: [
      { name: "Capitol Hill", note: "Queer culture, live music, bars, bookstores, and the creative energy that has defined Seattle's cultural identity for decades." },
      { name: "International District", note: "Japanese, Chinese, Vietnamese, and Filipino communities — restaurants, markets, and history in dense, walkable blocks." },
      { name: "Columbia City", note: "One of Seattle's most diverse neighborhoods — Ethiopian, Somali, Vietnamese restaurants alongside coffee shops and music venues." },
      { name: "Beacon Hill", note: "Filipino, Vietnamese, and Chinese communities, community gardens, and El Centro de la Raza — the city's social justice anchor." },
    ],
    beforeYouArrive:
      "June in Seattle can be warm, can be gray, can be both in one afternoon. The rain reputation is slightly exaggerated in summer. Locals do not carry umbrellas — that is the tell. The stadium is downtown and walkable from the ferry terminal. Seattle takes land acknowledgment seriously; the land is Duwamish territory.",
  },

  // ── Canada ───────────────────────────────────────────────────────────────
  {
    slug: "toronto",
    name: "Toronto",
    displayName: "Toronto",
    country: "Canada",
    flag: "🇨🇦",
    region: "Ontario",
    stadium: "BMO Field",
    gradient: "from-red-600 via-rose-500 to-orange-400",
    accentFrom: "from-red-500",
    accentTo: "to-rose-400",
    imagePath: "photo-1756172603176-23479ac4139b",
    vibe:
      "Toronto is layers. The most diverse city on the continent, built by people who came from everywhere and made something that belongs to all of them. It is food, music, fashion, finance, and basketball energy folded together across neighborhoods that each feel like their own world. Kensington. Little Portugal. Chinatown. Scarborough. The city is not one thing. It has never needed to be.",
    pillars: ["multiculturalism", "Caribbean", "South Asian", "LGBTQ+", "Raptors", "food scene"],
    neighborhoods: [
      { name: "Kensington Market", note: "A market district unlike anywhere else in North America — cheese shops, Caribbean food, vintage clothing, and a spirit that resists chains." },
      { name: "Scarborough", note: "Where Toronto's South and East Asian communities built their own version of the city — Tamil, Chinese, Filipino, Bangladeshi — and the food is extraordinary." },
      { name: "Little Portugal / Dundas West", note: "Portuguese bakeries, Brazilian restaurants, wine bars, and the creative corridor where Toronto's art scene lives." },
      { name: "Regent Park", note: "A neighborhood in transformation — one of Canada's oldest social housing communities, now with a cultural center and a story worth knowing." },
    ],
    beforeYouArrive:
      "Toronto is a city that takes its diversity seriously, not as a talking point but as daily life. The TTC (transit) covers most of the city. Summers are warm and humid — June is comfortable but can spike. Tipping is expected and culturally important here. The city has a quiet pride that doesn't announce itself; it just shows up in the food, the music, and the block.",
  },
  {
    slug: "vancouver",
    name: "Vancouver",
    displayName: "Vancouver",
    country: "Canada",
    flag: "🇨🇦",
    region: "British Columbia",
    stadium: "BC Place",
    gradient: "from-teal-500 via-sky-500 to-indigo-600",
    accentFrom: "from-teal-400",
    accentTo: "to-sky-500",
    imagePath: "photo-1757266562608-2bbf67f92e71",
    vibe:
      "Vancouver is water, glass, mountain, rain, forest, and edge. It holds Indigenous memory, Pacific movement, Asian influence, outdoor life, film, design, and a calm beauty that can still feel restless underneath. It is a city where nature is not far away from the skyline. The place itself feels like it is breathing.",
    pillars: ["Indigenous culture", "AAPI community", "outdoor life", "film", "rain", "design"],
    neighborhoods: [
      { name: "Chinatown", note: "One of the oldest in North America — a neighborhood shaped by Chinese immigrants who built the railroad, now navigating rapid change." },
      { name: "Commercial Drive", note: "Italian roots, Latin energy, coffee culture, independent bookstores — where Vancouver's old progressive identity still lives." },
      { name: "Strathcona", note: "Vancouver's oldest neighborhood: artists, activists, community gardens, and a resilience that gentrification hasn't fully erased." },
      { name: "Mount Pleasant", note: "Breweries, studios, Filipino restaurants, and a creative community that moved south when rents pushed them out of downtown." },
    ],
    beforeYouArrive:
      "Vancouver sits on unceded Indigenous territory — the Musqueam, Squamish, and Tsleil-Waututh Nations. That acknowledgment is genuine here, not performative. The city is expensive; budget accordingly. Transit (SkyTrain) is excellent and reaches BC Place easily. June weather is mild and green. The mountains are always there — take the time to look at them.",
  },

  // ── Mexico ───────────────────────────────────────────────────────────────
  {
    slug: "guadalajara",
    name: "Guadalajara",
    displayName: "Guadalajara",
    country: "Mexico",
    flag: "🇲🇽",
    region: "Jalisco",
    stadium: "Estadio Akron",
    gradient: "from-orange-500 via-red-600 to-rose-700",
    accentFrom: "from-orange-500",
    accentTo: "to-red-600",
    imagePath: "photo-1746419557682-21115eced897",
    vibe:
      "Guadalajara carries tradition with pride. Mariachi, craft, architecture, football, family, markets, plazas, and deep regional identity. It is not just old culture preserved behind glass. It is culture still worn, played, cooked, sung, and lived. A place where heritage does not feel frozen. It feels alive.",
    pillars: ["mariachi", "tequila", "Chivas football", "tapatío culture", "craft", "plazas"],
    neighborhoods: [
      { name: "Tlaquepaque", note: "One of Mexico's craft centers — blown glass, talavera ceramics, leather, and a colonial plaza surrounded by artisan workshops." },
      { name: "Chapultepec", note: "Guadalajara's young, walkable corridor: art galleries, coffee shops, craft cocktail bars, and bookstores." },
      { name: "Centro Histórico", note: "The original city — cathedral, government palace with murals by Clemente Orozco, and the rhythm of a plaza that never fully quiets." },
      { name: "Tonalá", note: "The wholesale craft market behind Tlaquepaque — furniture, textiles, carved wood, and makers who sell directly from the workshop." },
    ],
    beforeYouArrive:
      "Guadalajara is the city that gave the world mariachi, tequila, and birria. All three are done better here than anywhere else. Locals call themselves tapatíos and carry regional pride seriously — this is not a suburb of Mexico City, it is its own world. The climate in June is warm with afternoon rains. The Chivas de Guadalajara (Atlas FC too) take football personally.",
  },
  {
    slug: "mexico-city",
    name: "Mexico City",
    displayName: "Mexico City",
    country: "Mexico",
    flag: "🇲🇽",
    region: "CDMX",
    stadium: "Estadio Azteca",
    gradient: "from-amber-500 via-rose-600 to-red-700",
    accentFrom: "from-amber-500",
    accentTo: "to-rose-600",
    imagePath: "photo-1547995886-6dc09384c6e6",
    vibe:
      "Mexico City is ancient and modern at the same time. Built over older worlds, layered with empire, revolution, art, food, traffic, poetry, protest, and impossible scale. It is a city of murals and markets, museums and street corners, memory beneath concrete, beauty beside chaos. It does not ask to be simplified.",
    pillars: ["pre-Columbian history", "muralism", "street food", "design", "protest culture", "literature"],
    neighborhoods: [
      { name: "Coyoacán", note: "Frida Kahlo's neighborhood — cobblestone streets, the Casa Azul, a plaza full of books, and the best tlayudas you can find outside Oaxaca." },
      { name: "La Roma / La Condesa", note: "Art deco architecture, literary cafés, earthquake solidarity murals, the city's design and cultural moment." },
      { name: "Tepito", note: "A working-class neighborhood with its own economy, its own saints, and a fierce local pride that has nothing to do with tourists." },
      { name: "Xochimilco", note: "The ancient canal system — trajineras floating past chinampas that have been farmed continuously for 700 years." },
    ],
    beforeYouArrive:
      "Mexico City is one of the great cities of the world — treat it accordingly. The altitude (2,240m / 7,350ft) is real; pace yourself the first day. The metro is cheap, safe, and reaches almost everywhere. Street food is not a risk — it is the point. Learn the taco etiquette: two tortillas, salsa from the jar on the side, lime always. The city runs late; dinner before 8pm is breakfast.",
  },
  {
    slug: "monterrey",
    name: "Monterrey",
    displayName: "Monterrey",
    country: "Mexico",
    flag: "🇲🇽",
    region: "Nuevo León",
    stadium: "Estadio BBVA",
    gradient: "from-slate-600 via-zinc-600 to-stone-500",
    accentFrom: "from-slate-500",
    accentTo: "to-zinc-500",
    imagePath: "photo-1642321215251-bd9999b0b408",
    vibe:
      "Monterrey is mountain and industry. A place of steel, business, heat, ambition, northern pride, and dramatic landscape. Its culture has a harder edge, shaped by work, enterprise, family, music, and survival near the borderlands of geography and identity. It feels built, driven, and serious — but never empty.",
    pillars: ["norteño music", "carnitas", "border culture", "industry", "football (Rayados/Tigres)", "mountains"],
    neighborhoods: [
      { name: "Barrio Antiguo", note: "The old city made new — bars, galleries, street art, live music, and the Monterrey that the nightlife crowd claims." },
      { name: "Fundidora Park", note: "A former steel mill turned into a park and cultural campus — the city's industrial past reimagined as public space." },
      { name: "San Pedro Garza García", note: "The wealthy municipality bordering Monterrey — restaurants, galleries, and a different kind of norteño energy." },
      { name: "Centro", note: "The Macroplaza, the Cerro de la Silla in the background, government buildings, and the street food that feeds the workers who built the city." },
    ],
    beforeYouArrive:
      "Monterrey sits between two mountain ranges and hits 40°C (104°F) in summer. Heat is not a warning — it is the weather. The city is the industrial capital of Mexico and proud of it. Rayados vs. Tigres is one of the great football rivalries in Latin America; if a match overlaps with the World Cup, the city will feel it. Northern Mexican cuisine (cabrito, machacado, carne asada) is its own tradition — do not skip it.",
  },
];

export function getCityBySlug(slug: string): WorldCupCity | undefined {
  return WORLD_CUP_CITIES.find((c) => c.slug === slug);
}

export function getCitiesByCountry(country: WorldCupCity["country"]): WorldCupCity[] {
  return WORLD_CUP_CITIES.filter((c) => c.country === country);
}

export const COUNTRY_ORDER: WorldCupCity["country"][] = ["USA", "Canada", "Mexico"];

export const COUNTRY_LABELS: Record<WorldCupCity["country"], string> = {
  USA: "United States",
  Canada: "Canada",
  Mexico: "Mexico",
};
