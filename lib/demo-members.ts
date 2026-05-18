import type { Member } from "@/lib/types";

export const DEMO_MEMBERS: Member[] = [
  {
    id: "demo-dani-cruz",
    profile: {
      name: "Dani Cruz",
      memberType: "artist",
      city: "Los Angeles",
      neighborhood: "Boyle Heights",
      discipline: "Muralist",
      yearsExperience: "8",
      category: "Mural",
      subcategory: "Bilingual",
      approvedBlurb:
        "Boyle Heights muralist working with local schools and small businesses to tell neighborhood stories in big color.",
      services: ["Murals", "Sign painting", "Workshops"],
      venueTypes: ["Storefronts", "Schools", "Community centers"],
      vibe: "Loud color, slow work, lots of pan dulce.",
      instagramHandle: "danicruz",
      latitude: 34.0339,
      longitude: -118.2098,
    },
  },
  {
    id: "demo-kira-wave",
    profile: {
      name: "Kira Wave",
      memberType: "artist",
      city: "Los Angeles",
      neighborhood: "Silver Lake",
      discipline: "Sound artist",
      yearsExperience: "6",
      category: "Music",
      subcategory: "Late night",
      approvedBlurb:
        "Coffee, tacos, hidden patios — Kira posts the calmest, weirdest pressed-vinyl morning sets in town.",
      services: ["DJ sets", "Sound design", "Live shows"],
      venueTypes: ["Coffee shops", "Galleries", "Backyards"],
      vibe: "If a record skips in a room and nobody's bothered, that's the vibe.",
      instagramHandle: "kirawave",
      spotifyUrl: "https://open.spotify.com/user/kirawave",
      latitude: 34.0869,
      longitude: -118.2702,
    },
  },
  {
    id: "demo-south-la-mutual-aid",
    profile: {
      name: "South LA Mutual Aid",
      memberType: "organizer",
      city: "Los Angeles",
      neighborhood: "South LA",
      category: "Community",
      subcategory: "Mutual aid",
      cause: "Neighbors caring for neighbors. Weekly grocery drops, rental support, rapid-response funds.",
      approvedBlurb:
        "Volunteer-run neighborhood coordinating weekly grocery drops, rental support, and rapid-response funds across South LA.",
      needsMost: ["Volunteer drivers", "Pantry donations", "Bilingual organizers"],
      connectWith: ["Local churches", "Restaurants", "Schools"],
      shareTypes: ["Groceries", "Rent assistance", "Rides"],
      instagramHandle: "southlamutualaid",
      latitude: 33.9803,
      longitude: -118.3092,
    },
  },
  {
    id: "demo-casa-verde",
    profile: {
      name: "Casa Verde Plant Co",
      memberType: "organizer",
      city: "Los Angeles",
      neighborhood: "Highland Park",
      category: "Community",
      subcategory: "Garden collective",
      cause: "Family-run plant shop and propagation studio. We grow, you grow.",
      approvedBlurb:
        "Family-run plant shop and propagation studio. We grow, you grow.",
      needsMost: ["Pot donations", "Composting partners"],
      connectWith: ["Schools", "Community gardens"],
      shareTypes: ["Cuttings", "Workshops", "Pots"],
      businessName: "Casa Verde Plant Co",
      businessAddress: "5634 N Figueroa St, Los Angeles, CA",
      businessHours: "Wed–Sun · 11am – 6pm",
      businessPhone: "+1 (323) 555-0188",
      websiteUrl: "casaverde.la",
      instagramHandle: "casaverdeplantco",
      latitude: 34.1133,
      longitude: -118.1925,
    },
  },
];

export function getDemoMember(id: string): Member | undefined {
  return DEMO_MEMBERS.find((m) => m.id === id);
}
