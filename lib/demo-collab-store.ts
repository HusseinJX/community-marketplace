// Collaborations created during the ADMIN DEMO.
//
// The demo has no backend, so a collaboration you create would vanish the moment
// you navigated to Messages — which broke the whole point of the flow ("create
// it → open its chat"). This keeps them in localStorage for the session so the
// demo behaves like the real thing end to end. Real accounts never touch this.

export type DemoCollabMember = { to_id: string; to_name: string | null; role: string | null }

export interface StoredDemoCollab {
  occasion_id: string
  label: string
  created_at: string
  members: DemoCollabMember[]
}

const KEY = 'wl_demo_created_collabs'

export function loadDemoCollabs(): StoredDemoCollab[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as StoredDemoCollab[]) : []
  } catch {
    return []
  }
}

export function addDemoCollab(c: StoredDemoCollab): void {
  try {
    const all = loadDemoCollabs().filter((x) => x.occasion_id !== c.occasion_id)
    localStorage.setItem(KEY, JSON.stringify([c, ...all]))
  } catch {
    /* private/full storage → the demo just won't remember it */
  }
}

/** The room id a demo collaboration's chat lives in. */
export const demoRoomIdFor = (occasionId: string) => `demo-room-${occasionId}`
