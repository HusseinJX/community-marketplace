// Demo mode: lets the vendor/admin portal be previewed without Clerk auth so
// each member type's admin UI is quickly testable. Gated by NEXT_PUBLIC_DEMO_MODE
// — when off, the portal is fully auth-protected as normal.

export type DemoMemberType = 'vendor' | 'artist' | 'organizer'

export const DEMO_TYPES: { key: DemoMemberType; label: string }[] = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'artist', label: 'Artist' },
  { key: 'organizer', label: 'Community Org' },
]

export const DEMO_TYPE_LABEL: Record<DemoMemberType, string> = {
  vendor: 'Vendor',
  artist: 'Artist',
  organizer: 'Community Org',
}

export const DEMO_COOKIE = 'demo_admin_type'
export const DEMO_SUBTYPE_COOKIE = 'demo_admin_subtype'

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === '1'
}

export function isDemoType(v: string | undefined | null): v is DemoMemberType {
  return v === 'vendor' || v === 'artist' || v === 'organizer'
}

// Client-only: persist the demo selection. Lives here (a plain module) so the
// cookie write isn't inside a component/hook body.
export function writeDemoCookies(type: DemoMemberType, subtype?: string): void {
  document.cookie = `${DEMO_COOKIE}=${type}; path=/; max-age=31536000`
  if (subtype !== undefined) {
    document.cookie = `${DEMO_SUBTYPE_COOKIE}=${encodeURIComponent(subtype)}; path=/; max-age=31536000`
  }
}
