import posthog from 'posthog-js'

// The collaboration funnel — the only numbers that answer the thesis.
//
// The bet is: "helping one real event happen makes someone start a SECOND
// collaboration, unprompted." Nothing in the app measured that, so the ten-
// businesses-in-one-district test would have produced a vibe, not a result.
//
// Read it as a funnel:
//   matches_shown → invite_sent → invite_accepted → agreed → event_created
// and the one that actually decides the thesis:
//   collab_started with collaborations_before >= 1   ← a SECOND collaboration
//
// Client-side (posthog-js is browser-only) and best-effort: analytics must never
// break a user action, so every call is swallowed on failure.
export type TrackEvent =
  | 'matches_shown' // the matcher returned candidates
  | 'collab_started' // a new collaboration was created  ← carries collaborations_before
  | 'collab_invite_sent'
  | 'collab_invite_accepted'
  | 'collab_agreed' // "I'm in 👍" — consent, the step before an event
  | 'collab_event_created' // a collaboration became a real event
  | 'opportunity_ask_to_join' // asked to join someone else's event

export function track(event: TrackEvent, props: Record<string, unknown> = {}): void {
  try {
    posthog.capture(event, props)
  } catch {
    /* analytics is never allowed to break the app */
  }
}
