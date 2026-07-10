export type Endorser = { id?: string; label: string };

export type Endorsements = {
  worksWith: Endorser[];
  activeIn: Endorser[];
};

export const ENDORSEMENTS: Record<string, Endorsements> = {
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
