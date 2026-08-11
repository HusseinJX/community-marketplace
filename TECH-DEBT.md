# Tech debt — known, triaged, deliberately deferred

Things that are wrong but not urgent. Each entry says what happens **if nobody
ever does it**, because that is the number that decides whether it's worth doing.

Deferred is not the same as forgotten: if an item here starts costing real time
or real users, it moves up. If it never does, leaving it is a legitimate outcome.

---

## Lint backlog — 88 problems (triaged 2026-08-11, deferred by decision)

Reproduce with `npx eslint app components lib`. Counts as of 2026-08-11, after
`862c8bc` took `react-hooks/rules-of-hooks` from 3 to 0.

| Count | Rule | Real? |
|---|---|---|
| 53 | `react-hooks/set-state-in-effect` | mostly no |
| 12 | `@typescript-eslint/no-unused-vars` | no — pure noise |
| 6 | `@typescript-eslint/no-explicit-any` | cosmetic |
| 5 | `react-hooks/purity` | **probably yes** |
| 3 | `react-hooks/exhaustive-deps` | **probably yes** |
| 2 | `react-hooks/immutability` | **probably yes** |
| ~7 | misc (unescaped entities, require-import, unused expression) | no |

### What happens if we never do it

For ~70 of them: nothing, ever. Unused leftovers, and components that render
twice on mount instead of once. No user impact, no failure mode.

For ~10 of them: occasional small traps of three shapes — a handler using a
stale value (typed a new query, searched the old one), a change that doesn't
re-render because state was mutated in place, or a value that renders wrong or
resets itself. None crash anything. They cost an afternoon each, on some
unrelated day, because the symptom appears nowhere near the cause.

The compounding cost is signal: at 88 entries nobody reads the output, so the
next genuine warning arrives invisible.

**The honest counterweight, and the reason this is deferred:** the crash that
actually shipped (`044861a`, every carousel eager-loading its first image)
produced **no lint warning at all**. A clean lint list is not crash insurance.
That class of bug is found by rendering the thing and asking why a number looks
wrong — which is also how every defect in the event-sourcing sessions was found.

### Why not a blanket `set-state-in-effect` pass

It is an idiom rule, not a correctness rule; the usual cost is one extra render
on mount. Many instances are the *only* correct way to avoid a hydration
mismatch — `useEffect(() => setNowTs(Date.now()), [])` in `WhatsOn` exists
precisely because rendering a timestamp during SSR breaks hydration. Rewriting
~40 effects means touching hydration-sensitive code across the app, which fails
subtly and usually only in production or the native shell. Large risk, no
user-visible gain.

### The order to do it in, when someone does

1. **`MemoriesGrid.tsx:62`** — highest value single line. Its effect depends on
   what it sets, which is the infinite-loop shape, and per the comment in
   `lib/data-hooks.ts` this component **already caused a real "Maximum update
   depth exceeded" freeze once.** The only item here that can hurt a user today.
2. **`purity` (5) + `immutability` (2)** — impure work during render, or state
   mutated in place. The likeliest genuine defects: `LiveManager:209,290`,
   `ShareComposer:110,360`, `CommunityEventsLive:56`, `JoinFlow:160`,
   `BillingPlans:168`.
3. **`exhaustive-deps` (3)** — classic stale closures.
4. **Free hygiene** — 12 unused vars and the misc handful. Mechanical, zero
   risk, and deletes roughly a third of the noise on its own.
5. **Only if a quiet list is wanted:** collapse the mount-flag pattern into one
   `useMounted()` hook. ~26 call sites simplify and the rule fires once, in one
   reviewed place, with one honest suppression comment — rather than mass
   disabling. Do NOT mass-disable the rule instead; that removes the signal
   without removing the risk.

Steps 1 + 4 are the most value for the least risk and are the recommended
minimum if this is ever picked up piecemeal.

Note: a quick script to split the 53 into "mount-only" vs "has deps" mis-sorted
at least one known-benign case (`WhatsOn:76`), so **don't trust an automated
triage of that rule** — the classification needs the effects read individually,
which is most of the work anyway.
