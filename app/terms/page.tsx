import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { SITE_NAME } from "@/lib/seo";

export const metadata = {
  title: "Terms & Conditions",
  description: `The terms governing your use of ${SITE_NAME}, including SMS messaging terms.`,
};

const LAST_UPDATED = "June 30, 2026";
const SUPPORT_EMAIL = "support@whatslocal.ai";

export default function TermsPage() {
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
            <FileText className="h-3.5 w-3.5" /> Terms &amp; Conditions
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-4 text-sm text-white/70">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">
        <article className="space-y-8">
          <p className="text-lg leading-relaxed text-stone-700">
            Welcome to {SITE_NAME}. These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of our
            website and our SMS messaging service. By using the service, you agree to these Terms. If you do not
            agree, please do not use the service.
          </p>

          <Block title="1. The Service">
            <p>
              {SITE_NAME} is a community marketplace that helps local members &mdash; vendors, artists, organizers,
              shoppers, and community members &mdash; discover and connect with one another through our website and
              a conversational assistant available over web chat and SMS.
            </p>
          </Block>

          <Block title="2. Eligibility">
            <p>
              You must be at least 13 years old (and old enough to form a binding contract in your jurisdiction) to
              use the service.
            </p>
          </Block>

          <Block title="3. SMS Messaging Terms">
            <p>
              By texting our number, you consent to receive conversational text messages from {SITE_NAME} related
              to onboarding, member support, and relevant community connections. All messages are part of a two-way
              conversation you initiate.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Message frequency</strong> varies based on your interactions with our assistant.
              </li>
              <li>
                <strong>Message and data rates may apply</strong>, depending on your mobile carrier and plan.
              </li>
              <li>
                <strong>To opt out,</strong> reply <strong>STOP</strong> at any time. You will receive a
                confirmation and no further messages unless you rejoin by replying START.
              </li>
              <li>
                <strong>For help,</strong> reply <strong>HELP</strong> or email{" "}
                <a className="text-purple-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </li>
              <li>
                Carriers are not liable for delayed or undelivered messages.
              </li>
            </ul>
            <p className="mt-3">
              Our messages may include links &mdash; for example, to view or manage your member profile, open an
              introduction or invitation, join a collaboration chat, or view a local event. Only open links you
              expect to receive as part of your conversation with us.
            </p>
          </Block>

          <Block title="4. Acceptable Use & Zero Tolerance for Objectionable Content">
            <p>
              {SITE_NAME} has <strong>zero tolerance for objectionable content or abusive behavior</strong>. You
              agree not to use the service to:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Harass, bully, threaten, impersonate, or abuse other members.</li>
              <li>
                Post objectionable content — including content that is unlawful, hateful, harassing, sexually
                explicit, violent, defamatory, misleading, or infringing.
              </li>
              <li>Attempt to disrupt or gain unauthorized access to the service.</li>
              <li>Use the service for spam or unsolicited marketing.</li>
            </ul>
            <p className="mt-3">
              You can <strong>report</strong> any post you find objectionable, and <strong>block</strong> any user,
              from the post&rsquo;s options menu — blocking immediately removes that user&rsquo;s content from your
              view. We review reports and act on objectionable content and abusive users <strong>within 24
              hours</strong>, removing the content and, where warranted, terminating the responsible account. By
              using {SITE_NAME} you agree to these terms and to this content policy.
            </p>
          </Block>

          <Block title="5. Member Content & Introductions">
            <p>
              Information you share (such as what you offer and what you&rsquo;re looking for) may be shown to other
              members to enable relevant introductions and collaborations. You are responsible for the accuracy of
              the information you provide and for your interactions with other members. {SITE_NAME} facilitates
              connections but is not a party to, and is not responsible for, agreements or dealings between members.
            </p>
          </Block>

          <Block title="6. Disclaimers & Limitation of Liability">
            <p>
              The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the fullest extent
              permitted by law, {SITE_NAME} is not liable for any indirect, incidental, or consequential damages
              arising from your use of the service or interactions with other members.
            </p>
          </Block>

          <Block title="7. Changes to These Terms">
            <p>
              We may update these Terms from time to time. Continued use of the service after changes take effect
              constitutes acceptance of the revised Terms.
            </p>
          </Block>

          <Block title="8. Contact Us">
            <p>
              Questions about these Terms? Contact us at{" "}
              <a className="text-purple-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Block>

          <p className="pt-4 text-sm text-stone-500">
            See also our{" "}
            <Link href="/privacy" className="text-purple-700 underline">
              Privacy Policy
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
