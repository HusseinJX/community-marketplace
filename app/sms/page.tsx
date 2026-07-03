import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { SITE_NAME } from "@/lib/seo";

export const metadata = {
  title: "Text WhatsLocal AI",
  description: `How the ${SITE_NAME} text messaging program works — text to join, what you'll receive, and how to opt out.`,
};

// Set this to your live A2P/10DLC number once provisioned (e.g. "+1 (510) 555-0142").
// Shown as the number members text to join. Leave as-is to display generic copy.
const SMS_NUMBER = "+1 (562) 257-3224";
const SMS_VANITY = "+1-LOCAL-REACH"; // spells 562-257-3224
const SUPPORT_EMAIL = "support@whatslocal.ai";

export default function SmsPage() {
  return (
    <div className="bg-stone-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-purple-900 to-pink-800 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,rgba(236,72,153,0.4),transparent_50%),radial-gradient(circle_at_80%_60%,rgba(168,85,247,0.4),transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 md:px-8 md:pt-24">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <div className="mt-8 ml-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <MessageSquare className="h-3.5 w-3.5" /> Text messaging
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Text {SITE_NAME} to join
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            {SITE_NAME} is a two-way text assistant for your local community. You start the
            conversation — we only ever reply to a message you send us first.
          </p>
          {SMS_NUMBER && (
            <div className="mt-6 inline-flex flex-col rounded-2xl bg-white/10 px-5 py-3 backdrop-blur">
              <span className="text-xl font-semibold tracking-wide">Text {SMS_VANITY} to get started</span>
              <span className="mt-0.5 text-sm text-white/70">that&rsquo;s {SMS_NUMBER}</span>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">
        <article className="space-y-8">
          <Block title="How to join (opt in)">
            <p>
              To join, simply text {SMS_NUMBER ? <strong>{SMS_VANITY} ({SMS_NUMBER})</strong> : "our published number"} —
              for example with the keyword <strong>JOIN</strong>. By texting us first, you start the conversation and
              consent to receive replies. We never send you a message unless you have texted us first. Our number is
              shared on our website, at local community events, and on printed materials.
            </p>
          </Block>

          <Block title="What you'll receive">
            <p>
              After you text us, our assistant helps you set up your community member profile, answers your
              questions, and helps you find and connect with relevant local vendors, artists, and organizers. Every
              message is part of the two-way conversation you started — this is customer care and onboarding, not
              marketing blasts.
            </p>
          </Block>

          <Block title="Message frequency & rates">
            <p>
              Message frequency varies based on your interactions with the assistant. <strong>Message and data
              rates may apply</strong>, depending on your mobile carrier and plan.
            </p>
          </Block>

          <Block title="Opt out & help">
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Reply <strong>STOP</strong> at any time to unsubscribe. You will receive a confirmation and no
                further messages unless you rejoin by replying <strong>JOIN</strong>.
              </li>
              <li>
                Reply <strong>HELP</strong> for help, or contact us at{" "}
                <a className="text-purple-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </li>
            </ul>
          </Block>

          <Block title="Your privacy">
            <p>
              We do not sell, rent, or share your SMS opt-in information or phone number with third parties or
              affiliates for their marketing purposes. For full details, see our{" "}
              <Link href="/privacy" className="text-purple-700 underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-purple-700 underline">
                Terms &amp; Conditions
              </Link>
              .
            </p>
          </Block>
        </article>
      </section>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h2>
      <div className="mt-3 space-y-1 leading-relaxed text-stone-700">{children}</div>
    </div>
  );
}
