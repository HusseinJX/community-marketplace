"use client";

import { useState } from "react";
import { VENUES, type Venue } from "@/lib/prototype-data";

type Step = "browse" | "slots" | "create" | "live";

// Named export so the profile "Book" button can embed the full flow
// (browse → slots → create event → live); default export below keeps the
// standalone /prototype/host route working.
//
// `startVenue` pre-selects the space (e.g. the business whose profile you're on)
// so the flow opens straight on its slots — the browse step and the breadcrumb
// are skipped (the modal chrome names the space instead).
export function BookFlow({ startVenue }: { startVenue?: Venue } = {}) {
  const locked = !!startVenue;
  const [step, setStep] = useState<Step>(locked ? "slots" : "browse");
  const [venue, setVenue] = useState<Venue | null>(startVenue ?? null);
  const [slotId, setSlotId] = useState<string | null>(null);

  // event draft
  const [title, setTitle] = useState("Tuesday Board-Game Night");
  const [price, setPrice] = useState(8);
  const [minRsvp, setMinRsvp] = useState(6);
  const [recurring, setRecurring] = useState(true);

  const slot = venue?.openSlots.find((s) => s.id === slotId) ?? null;
  const resetHome = () => {
    setSlotId(null);
    if (locked) setStep("slots");
    else { setStep("browse"); setVenue(null); }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      {!locked && <Breadcrumb step={step} venue={venue} onHome={resetHome} />}

      {step === "browse" && !locked && (
        <Browse
          onPick={(v) => { setVenue(v); setStep("slots"); }}
        />
      )}

      {step === "slots" && venue && (
        <Slots
          venue={venue}
          onBack={locked ? undefined : () => setStep("browse")}
          onPick={(id) => { setSlotId(id); setStep("create"); }}
        />
      )}

      {step === "create" && venue && slot && (
        <CreateEvent
          venue={venue}
          slot={slot}
          title={title} setTitle={setTitle}
          price={price} setPrice={setPrice}
          minRsvp={minRsvp} setMinRsvp={setMinRsvp}
          recurring={recurring} setRecurring={setRecurring}
          onBack={() => setStep("slots")}
          onLaunch={() => setStep("live")}
        />
      )}

      {step === "live" && venue && slot && (
        <LiveEvent
          venue={venue} slot={slot} title={title} price={price} minRsvp={minRsvp} recurring={recurring}
          onDone={resetHome}
        />
      )}
    </div>
  );
}

function Breadcrumb({ step, venue, onHome }: { step: Step; venue: Venue | null; onHome: () => void }) {
  const label =
    step === "browse" ? "Find a space" :
    step === "slots" ? venue?.name :
    step === "create" ? "Create your event" : "It's live";
  return (
    <div className="mb-3">
      {step !== "browse" && (
        <button onClick={onHome} className="mb-1 text-xs font-semibold text-stone-500">‹ Spaces</button>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight">{label}</h1>
    </div>
  );
}

// ── Step 1: browse venues ────────────────────────────────────────────────────
function Browse({ onPick }: { onPick: (v: Venue) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">
        Local spots opening their space — like Airbnb, but for hosting your gathering.
      </p>
      {VENUES.map((v) => (
        <button
          key={v.id}
          onClick={() => onPick(v)}
          className="w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-stone-200"
        >
          <div className="relative h-24" style={{ background: v.gradient }}>
            <span className="absolute left-3 top-3 text-3xl">{v.emoji}</span>
            <span className="absolute bottom-3 right-3 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-900">
              ${v.costPerEvent}/event
            </span>
          </div>
          <div className="p-3">
            <h3 className="font-bold leading-tight">{v.name}</h3>
            <p className="text-sm text-stone-500">{v.kind} · {v.neighborhood}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>👥 {v.minCap}–{v.maxCap} people</Chip>
              <Chip>🗓️ {v.openSlots.length} open slots</Chip>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Step 2: pick a calendar slot ─────────────────────────────────────────────
function Slots({ venue, onBack, onPick }: { venue: Venue; onBack?: () => void; onPick: (id: string) => void }) {
  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
        <div className="relative h-28" style={{ background: venue.gradient }}>
          <span className="absolute left-3 top-3 text-4xl">{venue.emoji}</span>
        </div>
        <div className="p-3">
          <p className="text-sm text-stone-600">{venue.kind} · {venue.neighborhood}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {venue.perks.map((p) => <Chip key={p}>{p}</Chip>)}
          </div>
          <div className="mt-2 flex gap-4 text-sm">
            <span><b>${venue.costPerEvent}</b> <span className="text-stone-500">to host</span></span>
            <span><b>{venue.minCap}–{venue.maxCap}</b> <span className="text-stone-500">capacity</span></span>
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-bold text-stone-700">Pick an open slot</h2>
      <div className="space-y-2">
        {venue.openSlots.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-stone-200">
            <div>
              <p className="font-bold">{s.day} · {s.date}</p>
              <p className="text-sm text-stone-500">{s.time}</p>
            </div>
            <button
              onClick={() => onPick(s.id)}
              className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-bold text-white"
            >
              Book
            </button>
          </div>
        ))}
      </div>
      {onBack && (
        <button onClick={onBack} className="mt-4 text-sm font-semibold text-stone-500">‹ Back to spaces</button>
      )}
    </div>
  );
}

// ── Step 3: create the threshold event ───────────────────────────────────────
function CreateEvent(props: {
  venue: Venue; slot: { day: string; date: string; time: string };
  title: string; setTitle: (s: string) => void;
  price: number; setPrice: (n: number) => void;
  minRsvp: number; setMinRsvp: (n: number) => void;
  recurring: boolean; setRecurring: (b: boolean) => void;
  onBack: () => void; onLaunch: () => void;
}) {
  const { venue, slot } = props;
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-stone-100 p-3 text-sm">
        <b>{venue.name}</b> · {slot.day} {slot.date}, {slot.time}
      </div>

      <Field label="Event name">
        <input
          value={props.title}
          onChange={(e) => props.setTitle(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ticket price">
          <div className="flex items-center rounded-xl border border-stone-200 bg-white px-3">
            <span className="text-stone-400">$</span>
            <input
              type="number" value={props.price}
              onChange={(e) => props.setPrice(+e.target.value)}
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
        </Field>
        <Field label="Min. RSVPs to go live">
          <input
            type="number" value={props.minRsvp}
            onChange={(e) => props.setMinRsvp(+e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>

      {/* The mechanic, explained */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <b>💡 Only happens if enough people commit.</b> Your event goes live once{" "}
        <b>{props.minRsvp} people</b> pay to RSVP. If it hasn&apos;t by{" "}
        <b>2 days before</b>, it auto-cancels and everyone&apos;s refunded — so you never
        pay {venue.name} for an empty room.
      </div>

      <label className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-stone-200">
        <div>
          <p className="font-semibold">Make it recurring</p>
          <p className="text-xs text-stone-500">Same slot, every week — build a regular community</p>
        </div>
        <input
          type="checkbox" checked={props.recurring}
          onChange={(e) => props.setRecurring(e.target.checked)}
          className="h-5 w-5 accent-stone-900"
        />
      </label>

      <div className="rounded-xl bg-stone-100 p-3 text-sm text-stone-600">
        You&apos;ll be charged <b>${venue.costPerEvent}</b> to host only when the event
        confirms. Hosting requires a <b>Creator plan ($10/mo)</b>.
      </div>

      <div className="flex gap-2">
        <button onClick={props.onBack} className="rounded-full bg-stone-100 px-5 py-2.5 text-sm font-bold text-stone-700">Back</button>
        <button onClick={props.onLaunch} className="flex-1 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white">
          Launch event →
        </button>
      </div>
    </div>
  );
}

// ── Step 4: live event with threshold progress + booking thread ──────────────
function LiveEvent(props: {
  venue: Venue; slot: { day: string; date: string; time: string };
  title: string; price: number; minRsvp: number; recurring: boolean; onDone: () => void;
}) {
  const { venue, slot, title, price, minRsvp } = props;
  const [rsvps, setRsvps] = useState(3);
  const met = rsvps >= minRsvp;
  const pct = Math.min(100, Math.round((rsvps / minRsvp) * 100));

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
        <div className="relative h-28" style={{ background: venue.gradient }}>
          <span className="absolute left-3 top-3 text-4xl">{venue.emoji}</span>
          <span
            className={`absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold ${
              met ? "bg-emerald-500 text-white" : "bg-amber-400 text-amber-950"
            }`}
          >
            {met ? "✓ Confirmed — it's happening" : "⏳ Filling up"}
          </span>
        </div>
        <div className="p-3">
          <h3 className="text-lg font-bold leading-tight">{title}</h3>
          <p className="text-sm text-stone-500">
            {slot.day} {slot.date} · {slot.time} · {venue.name}
          </p>
          {props.recurring && (
            <span className="mt-2 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              🔁 Repeats weekly
            </span>
          )}

          {/* Threshold meter */}
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{rsvps} / {minRsvp} RSVPs</span>
              <span className="text-stone-500">${price} each</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-200">
              <div
                className={`h-full rounded-full transition-all ${met ? "bg-emerald-500" : "bg-amber-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className={`mt-1.5 text-xs ${met ? "text-emerald-600" : "text-stone-500"}`}>
              {met
                ? "Threshold met — the room is booked & everyone's charged."
                : `${minRsvp - rsvps} more by Thu (2 days out) or it auto-cancels & refunds.`}
            </p>
          </div>

          <button
            onClick={() => setRsvps((r) => r + 1)}
            className="mt-3 w-full rounded-full bg-stone-900 py-2 text-sm font-bold text-white"
          >
            + Simulate an RSVP
          </button>
        </div>
      </div>

      {/* Booking thread — chat lives UNDER the booking, not a separate collab room */}
      <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-bold">Booking chat · with {venue.name}</h4>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
            Booking #{venue.id.toUpperCase()}-{slot.date.replace(" ", "")}
          </span>
        </div>
        <div className="space-y-2">
          <Bubble who="venue" name={venue.name}>Confirmed the {slot.time} slot — projector&apos;s all yours.</Bubble>
          <Bubble who="me" name="You">Amazing. Can we get in 30 min early to set up?</Bubble>
          <Bubble who="venue" name={venue.name}>Sure, door&apos;s open at {slot.time.split("–")[0].trim()} minus 30.</Bubble>
        </div>
        <div className="mt-2 flex gap-2">
          <input placeholder="Message the venue…" className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-sm" />
          <button className="rounded-full bg-stone-900 px-4 text-sm font-bold text-white">Send</button>
        </div>
      </div>

      <button onClick={props.onDone} className="w-full rounded-full bg-stone-100 py-2.5 text-sm font-bold text-stone-700">
        Done — back to spaces
      </button>
    </div>
  );
}

// ── little shared bits ───────────────────────────────────────────────────────
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">{children}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-stone-500">{label}</label>
      {children}
    </div>
  );
}
function Bubble({ who, name, children }: { who: "me" | "venue"; name: string; children: React.ReactNode }) {
  const mine = who === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-800"}`}>
        {!mine && <p className="text-[10px] font-bold text-stone-400">{name}</p>}
        {children}
      </div>
    </div>
  );
}

// Route entry for the standalone /prototype/host sandbox.
export default function PrototypeHostPage() {
  return <BookFlow />;
}
