import type { Metadata } from "next";
import { Camera, Clock, Video, Sparkles } from "lucide-react";
import { CalendlyEmbed } from "@/components/interview/CalendlyEmbed";

export const metadata: Metadata = {
  title: "Get featured — book an on-camera interview",
  description:
    "Share your story and your place in the local ecosystem. Book a short on-camera interview with WhatsLocal AI.",
};

// Public landing page the flyer QR points to (whatslocal.ai/interview).
// Pitches the on-camera "get featured" interview, lays out the interview arc so
// people arrive prepared (we ask them live — no form here), then books via
// Calendly. The arc mirrors the conversational voice interview: about →
// collaboration → a closing message, with an optional deeper-story format.
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "About you",
    items: [
      "Who you are",
      "What you're all about",
      "Your specialty — what makes you, you",
    ],
  },
  {
    title: "Collaboration",
    items: [
      "Whether you're open to collaborating in the local ecosystem — events and beyond",
      "The kinds of collaborations that interest you",
      "What you can offer",
      "What you're looking for",
    ],
  },
  {
    title: "Your message",
    items: ["Anything you'd like to say to the community — a shout-out, an invite, a note"],
  },
];

const EXTENDED = {
  title: "Optional — the deeper story",
  items: [
    "How it all started, and how you got into this",
    "What it means to you",
    "Your community involvement",
    "Ideas you have — and problems worth solving",
  ],
};

export default function InterviewPage() {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {/* Pitch */}
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-600">
          <Camera className="h-6 w-6 text-white" />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-900">Want to be featured?</h1>
        <p className="mt-2 text-base text-stone-600">
          Book a short on-camera interview — share your story and your place in the local ecosystem.
        </p>
      </div>

      {/* What to expect */}
      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-stone-200 p-3">
          <Clock className="mx-auto h-5 w-5 text-violet-600" />
          <p className="mt-1.5 text-xs font-medium text-stone-700">15 minutes</p>
        </div>
        <div className="rounded-xl border border-stone-200 p-3">
          <Video className="mx-auto h-5 w-5 text-violet-600" />
          <p className="mt-1.5 text-xs font-medium text-stone-700">On camera</p>
        </div>
        <div className="rounded-xl border border-stone-200 p-3">
          <Sparkles className="mx-auto h-5 w-5 text-violet-600" />
          <p className="mt-1.5 text-xs font-medium text-stone-700">Relaxed &amp; casual</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-stone-400">
        Google Meet, Zoom, or in person — your choice when you book.
      </p>

      {/* Interview arc to prepare for */}
      <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <h2 className="text-sm font-semibold text-stone-900">What we&apos;ll chat about</h2>
        <p className="mt-1 text-xs text-stone-500">
          No prep required — but here&apos;s the flow, so you can think it over. We&apos;ll walk through it
          together on camera.
        </p>

        <div className="mt-4 space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-700">{section.title}</h3>
              <ul className="mt-1.5 space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-stone-700">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-violet-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Optional longer-form interview */}
      <div className="mt-4 rounded-2xl border border-dashed border-stone-300 p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Optional
          </span>
          <h3 className="text-sm font-semibold text-stone-900">Want to go deeper?</h3>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          If you&apos;re up for a longer, more in-depth interview, we can also get into:
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {EXTENDED.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-stone-700">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-stone-300" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Booking */}
      <div className="mt-8">
        <h2 className="mb-3 text-center text-lg font-bold text-stone-900">Pick a time</h2>
        <CalendlyEmbed url={calendlyUrl} />
      </div>
    </div>
  );
}
