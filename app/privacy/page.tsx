import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SITE_NAME } from "@/lib/seo";

export const metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, and protects your information, including SMS messaging data.`,
};

const LAST_UPDATED = "June 30, 2026";
const SUPPORT_EMAIL = "support@whatslocal.ai";

export default function PrivacyPage() {
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
            <ShieldCheck className="h-3.5 w-3.5" /> Privacy Policy
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-white/70">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">
        <article className="space-y-8">
          <p className="text-lg leading-relaxed text-stone-700">
            {SITE_NAME} (&ldquo;{SITE_NAME},&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates a
            community marketplace that helps local members &mdash; vendors, artists, organizers, shoppers, and
            community influencers &mdash; discover and connect with one another. This Privacy Policy explains what
            information we collect, how we use it, and the choices you have. By using our website or messaging
            with us over SMS, you agree to the practices described here.
          </p>

          <Block title="1. Information We Collect">
            <p>We collect the following categories of information:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Information you provide.</strong> When you join the community &mdash; on our website or by
                texting our number &mdash; you may share your name, phone number, neighborhood or city, interests,
                what you offer, what you&rsquo;re looking for, and other details you choose to tell our assistant
                during onboarding.
              </li>
              <li>
                <strong>Messaging content.</strong> The content of your conversations with our assistant, so we can
                build your member profile and suggest relevant connections.
              </li>
              <li>
                <strong>Usage information.</strong> Basic technical data such as pages visited and device/browser
                type, collected through standard analytics.
              </li>
            </ul>
          </Block>

          <Block title="2. How We Use Your Information">
            <ul className="list-disc space-y-2 pl-6">
              <li>To onboard you and build your community member profile.</li>
              <li>To match and introduce you to relevant local vendors, artists, organizers, and members.</li>
              <li>To send you conversational replies and helpful recommendations over SMS or web chat.</li>
              <li>To operate, maintain, and improve the marketplace.</li>
              <li>To respond to your questions and provide support.</li>
            </ul>
          </Block>

          <Block title="3. SMS / Text Messaging">
            <p>
              Members opt in to text messaging by texting our published number first. All messages are part of a
              two-way conversation that you initiate. Message frequency varies based on your interactions. Message
              and data rates may apply.
            </p>
            <p className="mt-3 font-medium text-stone-900">
              We do not sell, rent, or share your SMS opt-in information or phone number with third parties or
              affiliates for their marketing or promotional purposes. Your consent to receive text messages is not
              shared with anyone for their own use.
            </p>
            <p className="mt-3">
              You can opt out of text messages at any time by replying <strong>STOP</strong>. For help, reply{" "}
              <strong>HELP</strong> or contact us at{" "}
              <a className="text-purple-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Block>

          <Block title="4. How We Share Information">
            <p>
              Your profile details (such as what you offer and what you&rsquo;re looking for) may be shown to other
              community members to enable relevant introductions and collaborations. We do not sell your personal
              information. We share information with service providers who help us operate the platform (such as
              messaging, hosting, and analytics providers) only to the extent needed to provide the service, and we
              may disclose information when required by law.
            </p>
          </Block>

          <Block title="5. Data Retention & Security">
            <p>
              We retain your information for as long as your membership is active or as needed to provide the
              service, and we take reasonable measures to protect it. No method of transmission or storage is
              completely secure, but we work to safeguard your data.
            </p>
          </Block>

          <Block title="6. Your Choices">
            <ul className="list-disc space-y-2 pl-6">
              <li>Reply STOP at any time to stop receiving text messages.</li>
              <li>Request access to, correction of, or deletion of your information by contacting us.</li>
            </ul>
          </Block>

          <Block title="7. Children&rsquo;s Privacy">
            <p>
              The service is not directed to children under 13, and we do not knowingly collect information from
              them.
            </p>
          </Block>

          <Block title="8. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Material changes will be reflected by the
              &ldquo;Last updated&rdquo; date above.
            </p>
          </Block>

          <Block title="9. Contact Us">
            <p>
              Questions about this policy? Contact us at{" "}
              <a className="text-purple-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Block>

          <p className="pt-4 text-sm text-stone-500">
            See also our{" "}
            <Link href="/terms" className="text-purple-700 underline">
              Terms &amp; Conditions
            </Link>
            .
          </p>
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
