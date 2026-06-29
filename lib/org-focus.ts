import type { Member, MemberProfile } from "./types";

// "Who does this community org serve?" — lets us separate orgs that support
// small businesses from those that serve individuals/residents, so vendors and
// shoppers each see the orgs relevant to them.
export type OrgServes = "small-businesses" | "individuals";

export const ORG_SERVES: { key: OrgServes; label: string; blurb: string }[] = [
  { key: "small-businesses", label: "Small businesses", blurb: "Grants, mentorship, resources for makers & vendors" },
  { key: "individuals", label: "Individuals & families", blurb: "Mutual aid, services, support for residents" },
];

export function focusLabel(key: string): string {
  return ORG_SERVES.find((o) => o.key === key)?.label ?? key;
}

// Normalized list of who an org serves (empty when unset).
export function readServes(profile?: MemberProfile | null): OrgServes[] {
  const raw = profile?.serves;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is OrgServes => s === "small-businesses" || s === "individuals");
}

export function servesBusinesses(profile?: MemberProfile | null): boolean {
  return readServes(profile).includes("small-businesses");
}

export function servesIndividuals(profile?: MemberProfile | null): boolean {
  return readServes(profile).includes("individuals");
}

// Filter a member list to community orgs serving a given audience.
export function orgsServing(members: Member[], audience: OrgServes): Member[] {
  return members.filter(
    (m) => m.profile?.memberType === "organizer" && readServes(m.profile).includes(audience)
  );
}

// ─── Organizer focus (sub-type) ──────────────────────────────────────────────
// An "organizer" is either a community-service org (mutual aid, nonprofit) or an
// event organizer who runs large public events/festivals/gatherings. This is a
// distinct axis from `serves` (who they help) and tailors the organize toolkit.
export type OrganizerFocus = "public-events" | "community-service";

export const ORG_FOCUS: { key: OrganizerFocus; label: string; blurb: string }[] = [
  { key: "public-events", label: "Public events & festivals", blurb: "Markets, festivals, fairs, large public gatherings" },
  { key: "community-service", label: "Community service", blurb: "Mutual aid, nonprofits, resident & business support" },
];

export function orgFocusLabel(key: string): string {
  return ORG_FOCUS.find((o) => o.key === key)?.label ?? key;
}

export function readOrgFocus(profile?: MemberProfile | null): OrganizerFocus | null {
  const raw = profile?.organizerFocus;
  return raw === "public-events" || raw === "community-service" ? raw : null;
}

// True when this member runs large public events (festivals). Drives the
// festival-oriented organize experience + public festival pages.
export function isEventOrganizer(profile?: MemberProfile | null): boolean {
  return profile?.memberType === "organizer" && readOrgFocus(profile) === "public-events";
}
