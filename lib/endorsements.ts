export type Endorser = { id?: string; label: string };

export type Endorsements = {
  worksWith: Endorser[];
  activeIn: Endorser[];
};

export const ENDORSEMENTS: Record<string, Endorsements> = {
  // Zahab Energy (real)
  "89516919-256f-4a95-96df-fc9d285f664a": {
    worksWith: [
      { id: "demo-dani-cruz", label: "Dani Cruz" },
      { id: "demo-kira-wave", label: "Kira Wave" },
    ],
    activeIn: [
      { id: "demo-south-la-mutual-aid", label: "South LA Mutual Aid" },
      { label: "Inglewood Collective" },
      { label: "Eastside Makers" },
    ],
  },
  "demo-casa-verde": {
    worksWith: [
      { id: "demo-dani-cruz", label: "Dani Cruz" },
      { id: "demo-kira-wave", label: "Kira Wave" },
    ],
    activeIn: [
      { label: "Highland Park Small Biz" },
      { label: "Eastside Makers" },
    ],
  },
};
