"use client";

import { useState } from "react";
import { EVENT_IDEAS, YOUR_INTERESTS, VENUES, type EventIdea } from "@/lib/prototype-data";

type View = "ideas" | "blueprint" | "live";

export default function PrototypeCreate() {
  const [view, setView] = useState<View>("ideas");
  const [idea, setIdea] = useState<EventIdea | null>(null);

  return (
    <div className="mx-auto w-full max-w-md">
      {view === "blueprint" && idea ? (
        <Blueprint idea={idea} onBack={() => setView("ideas")} onCreate={() => setView("live")} />
      ) : view === "live" && idea ? (
        <LiveEvent idea={idea} onDone={() => { setView("ideas"); setIdea(null); }} />
      ) : (
        <Ideas onPick={(i) => { setIdea(i); setView("blueprint"); }} />
      )}
    </div>
  );
}

// ── Inspiration + personalized ideas ─────────────────────────────────────────
function Ideas({ onPick }: { onPick: (i: EventIdea) => void }) {
  const [shuffle, setShuffle] = useState(0);
  const ideas = shuffle % 2 === 0 ? EVENT_IDEAS : [...EVENT_IDEAS].reverse();

  return (
    <div>
      {/* Inspiration hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">You want to go out</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">
          So does your whole neighborhood. Be the one who makes it happen.
        </h1>
        <p className="mt-2 text-sm text-white/85">
          You don&apos;t need a venue, a plan, or experience. We hand you the local spot,
          the idea, and every tool to host it.
        </p>
      </div>

      {/* Personalization */}
      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-stone-700">✨ Ideas for you</h2>
        <button
          onClick={() => setShuffle((s) => s + 1)}
          className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600"
        >
          ↻ More ideas
        </button>
      </div>
      <div className="mb-3 mt-1 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-stone-500 ring-1 ring-stone-200">📍 Mission</span>
        {YOUR_INTERESTS.map((t) => (
          <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-stone-500 ring-1 ring-stone-200">{t}</span>
        ))}
      </div>

      <div className="space-y-3">
        {ideas.map((i) => {
          const v = VENUES.find((x) => x.id === i.venueId);
          return (
            <button
              key={i.id}
              onClick={() => onPick(i)}
              className="w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-stone-200"
            >
              <div className="relative h-24" style={{ background: i.gradient }}>
                <span className="absolute left-3 top-3 text-3xl drop-shadow">{i.emoji}</span>
                {i.recurring && (
                  <span className="absolute right-3 top-3 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                    🔁 recurring
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-base font-bold leading-tight">{i.title}</h3>
                <p className="text-xs text-stone-500">{i.theme}</p>
                <p className="mt-1.5 rounded-lg bg-violet-50 px-2 py-1 text-xs italic text-violet-700">
                  💡 {i.whyForYou}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-stone-500">
                    📍 {v ? v.name : i.venueNote} · {i.suggestedWhen}
                  </span>
                  <span className="text-xs font-bold text-violet-600">Plan this →</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button className="mt-4 w-full rounded-2xl border-2 border-dashed border-stone-300 bg-white py-3 text-sm font-bold text-stone-600">
        ✏️ Start from scratch instead
      </button>
    </div>
  );
}

// ── The blueprint: theme, spot, description, prep, how-to-host ────────────────
function Blueprint({ idea, onBack, onCreate }: { idea: EventIdea; onBack: () => void; onCreate: () => void }) {
  const v = VENUES.find((x) => x.id === idea.venueId);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  return (
    <div>
      <button onClick={onBack} className="mb-1 text-xs font-semibold text-stone-500">‹ Ideas</button>

      <div className="overflow-hidden rounded-2xl">
        <div className="relative h-28" style={{ background: idea.gradient }}>
          <span className="absolute left-3 top-3 text-4xl drop-shadow">{idea.emoji}</span>
        </div>
      </div>
      <h1 className="mt-2 text-2xl font-extrabold leading-tight">{idea.title}</h1>
      <p className="text-sm text-stone-500">{idea.theme} · {idea.suggestedWhen} · {idea.crowd} people</p>
      <p className="mt-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs italic text-violet-700">💡 {idea.whyForYou}</p>

      {/* Suggested spot */}
      <Section title="Your spot">
        {v ? (
          <div className="overflow-hidden rounded-xl ring-1 ring-stone-200">
            <div className="relative h-20" style={{ background: v.gradient }}>
              <span className="absolute left-3 top-2 text-2xl">{v.emoji}</span>
              <span className="absolute bottom-2 right-3 rounded-full bg-white px-2 py-0.5 text-xs font-bold">${v.costPerEvent}/event</span>
            </div>
            <div className="bg-white p-2.5">
              <p className="text-sm font-bold">{v.name}</p>
              <p className="text-xs text-stone-500">{v.kind} · fits {v.minCap}–{v.maxCap} · {v.neighborhood}</p>
              <p className="mt-1 text-xs text-emerald-700">✓ Why here: right size, {v.perks[0].toLowerCase()}, open on your night.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-3 text-sm ring-1 ring-stone-200">
            <p className="font-bold">📍 {idea.venueNote}</p>
            <p className="text-xs text-stone-500">Outdoor / walk-in — no booking needed.</p>
          </div>
        )}
      </Section>

      {/* AI description */}
      <Section title="Description" hint="AI-drafted — tweak anything">
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700">{idea.description}</div>
      </Section>

      {/* Prep checklist */}
      <Section title="How to prep" hint="Tick as you go">
        <div className="space-y-1.5">
          {idea.prep.map((p, i) => (
            <button
              key={i}
              onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
              className="flex w-full items-start gap-2 rounded-xl bg-white p-2.5 text-left text-sm ring-1 ring-stone-200"
            >
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${checked[i] ? "border-emerald-500 bg-emerald-500 text-white" : "border-stone-300"}`}>
                {checked[i] ? "✓" : ""}
              </span>
              <span className={checked[i] ? "text-stone-400 line-through" : "text-stone-700"}>{p}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* How to host */}
      <Section title="On the day — what to do">
        <div className="space-y-1.5">
          {idea.hostSteps.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-xl bg-white p-2.5 text-sm ring-1 ring-stone-200">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-900 text-[11px] font-bold text-white">{i + 1}</span>
              <span className="text-stone-700">{s}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-3 mt-5">
        <button onClick={onCreate} className="w-full rounded-full bg-stone-900 py-3 text-sm font-bold text-white shadow-lg">
          Create this event →
        </button>
      </div>
    </div>
  );
}

// ── Live: the full host toolkit (promote, RSVPs, message, lists) ─────────────
function LiveEvent({ idea, onDone }: { idea: EventIdea; onDone: () => void }) {
  const v = VENUES.find((x) => x.id === idea.venueId);
  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
        <div className="relative h-24" style={{ background: idea.gradient }}>
          <span className="absolute left-3 top-3 text-3xl">{idea.emoji}</span>
          <span className="absolute bottom-3 left-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white">🎉 Your event is live</span>
        </div>
        <div className="p-3">
          <h1 className="text-lg font-bold leading-tight">{idea.title}</h1>
          <p className="text-sm text-stone-500">{idea.suggestedWhen} · {v ? v.name : idea.venueNote}</p>
        </div>
      </div>

      {/* Promote */}
      <ToolBlock title="Promote it" subtitle="Get people through the door">
        <ToolChip emoji="📣" label="Boost with ads" note="Meta / Google" />
        <ToolChip emoji="📲" label="Share to the feed" note="Local feed" />
        <ToolChip emoji="🔗" label="Copy invite link" note="Text it to friends" />
        <ToolChip emoji="📸" label="Auto-poster" note="AI flyer" />
      </ToolBlock>

      {/* Manage */}
      <ToolBlock title="Manage the night" subtitle="Everything in one place">
        <ToolChip emoji="✅" label="RSVPs" note="12 going · 8 spots" />
        <ToolChip emoji="💬" label="Message guests" note="Announce updates" />
        <ToolChip emoji="👥" label="Co-hosts & lineup" note="Add helpers/vendors" />
        <ToolChip emoji="🎟️" label="Check-in" note="At the door" />
      </ToolBlock>

      {/* The compounding list */}
      <div className="mt-5 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-4 text-white">
        <p className="text-sm font-bold">📇 Your guest list carries over</p>
        <p className="mt-1 text-sm text-white/85">
          Everyone who RSVPs joins your list. Host your next one and invite them all in a
          single tap — your community compounds every event.
        </p>
        <button className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-bold text-violet-700">
          Turn this into a recurring series
        </button>
      </div>

      <button onClick={onDone} className="mt-4 w-full rounded-full bg-stone-100 py-2.5 text-sm font-bold text-stone-700">
        Done — back to ideas
      </button>
    </div>
  );
}

// ── bits ─────────────────────────────────────────────────────────────────────
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-stone-700">{title}</h2>
        {hint && <span className="text-[11px] text-stone-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function ToolBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h2 className="text-sm font-bold text-stone-700">{title}</h2>
      <p className="mb-2 text-xs text-stone-400">{subtitle}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
function ToolChip({ emoji, label, note }: { emoji: string; label: string; note: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-stone-200">
      <span className="text-lg">{emoji}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{label}</p>
        <p className="truncate text-[11px] text-stone-400">{note}</p>
      </div>
    </div>
  );
}
