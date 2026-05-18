import type { EventSuggestion } from "@/lib/types";

export const DEMO_EVENTS: EventSuggestion[] = [
  {
    id: "demo-e1",
    memberId: "89516919-256f-4a95-96df-fc9d285f664a",
    memberName: "Zahab Energy",
    title: "Free Solar Consultation Day",
    date: "Sat, Jun 7",
    time: "10:00 AM – 2:00 PM",
    location: "Downtown LA Maker Space",
    description:
      "Meet our engineers for a one-on-one rooftop assessment. Learn about incentives, tax credits, and custom install quotes — no pressure.",
    source: { platform: "In-person" },
    status: "approved",
  },
  {
    id: "demo-e2",
    memberId: "89516919-256f-4a95-96df-fc9d285f664a",
    memberName: "Zahab Energy",
    title: "Clean Energy Workshop",
    date: "Thu, Jun 19",
    time: "6:00 PM – 8:00 PM",
    location: "Echo Park Community Center",
    description:
      "Hands-on intro to home solar + battery systems. Walk through real installs, costs, and the new CA incentive programs.",
    source: { platform: "Free" },
    status: "approved",
  },
  {
    id: "demo-e3",
    memberId: "89516919-256f-4a95-96df-fc9d285f664a",
    memberName: "Zahab Energy",
    title: "Sustainable Living Expo 2026",
    date: "Sat, Jul 12",
    time: "9:00 AM – 5:00 PM",
    location: "Grand Park, Los Angeles",
    description:
      "Stop by booth 14 for live demos, giveaways, and exclusive expo pricing on our full product line.",
    source: { platform: "Expo" },
    status: "approved",
  },
  {
    id: "demo-e4",
    memberId: "demo-south-la-mutual-aid",
    memberName: "South LA Mutual Aid",
    title: "Spring Community Swap Meet",
    date: "Sat, May 17",
    time: "10:00 AM – 4:00 PM",
    location: "Leimert Park Village, Los Angeles",
    description:
      "Quarterly swap meet — local vendors, live music, free entry. Bring items to trade or just come browse.",
    source: { platform: "Free" },
    status: "approved",
  },
  {
    id: "demo-e5",
    memberId: "demo-casa-verde",
    memberName: "Casa Verde Plant Co",
    title: "Propagation Sunday — Bring a Cutting",
    date: "Sun, May 25",
    time: "11:00 AM – 2:00 PM",
    location: "Highland Park · Casa Verde shop",
    description:
      "Open-house propagation workshop. Bring a cutting, leave with a new plant. Free, all skill levels welcome.",
    source: { platform: "Workshop" },
    status: "approved",
  },
  {
    id: "demo-e6",
    memberId: "demo-dani-cruz",
    memberName: "Dani Cruz",
    title: "Mural Unveiling — Boyle Heights",
    date: "Fri, May 30",
    time: "6:00 PM",
    location: "1st & Soto, Boyle Heights",
    description:
      "Unveiling a new community mural in collaboration with three local schools. Tacos and music after.",
    source: { platform: "In-person" },
    status: "approved",
  },
];
