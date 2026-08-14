// Should Sentry report from this process at all?
//
// A DSN alone used to be the whole condition, and `.env.local` has one — so
// `npm run dev` shipped every Turbopack compile error and every mid-HMR broken
// render straight into the production Sentry project. It is not a small effect:
// on 2026-08-13 the project held 46 unresolved issues and 43 of them were
// localhost, tagged `server_name: Johns-MacBook-Pro.local`, all of them
// transient states of an in-flight redesign that were already fixed by the time
// anyone read them. One even carried an absolute path out of this working copy.
// The three real production issues were buried under that.
//
// Two costs: the signal is unfindable, and the event quota gets spent on hot
// reloads. So dev is off by default.
//
// The escape hatch is deliberate — wiring Sentry up, or re-verifying it after a
// change to these config files, means being able to send a real event from a dev
// machine. Set the flag for that session and unset it after. The client half
// needs the `NEXT_PUBLIC_` copy because the browser bundle is built, not read at
// runtime.
//
// Note this is the ONE place that decides. Keep the three Sentry config files
// (client / server / edge) agreeing, or an error reported by one half of a
// request will be missing from the other.

export function sentryEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return true
  return (
    process.env.SENTRY_ENABLE_DEV === '1' ||
    process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === '1'
  )
}
