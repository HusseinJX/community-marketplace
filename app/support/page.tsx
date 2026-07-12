import Link from "next/link";
import { ArrowLeft, LifeBuoy, Mail, ShieldCheck, FileText } from "lucide-react";
import { SITE_NAME } from "@/lib/seo";

export const metadata = {
  title: "Support",
  description: `Get help with ${SITE_NAME} — contact support, manage your account, and find answers.`,
};

const SUPPORT_EMAIL = "support@whatslocal.ai";

export default function SupportPage() {
  return (
    <div className="bg-stone-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-teal-900 to-sky-800 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.4),transparent_50%),radial-gradient(circle_at_80%_60%,rgba(56,189,248,0.4),transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 md:px-8 md:pt-24">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <div className="mt-8 ml-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <LifeBuoy className="h-3.5 w-3.5" /> Support
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">How can we help?</h1>
          <p className="mt-4 max-w-xl text-white/70">
            Questions, feedback, or an issue with your account — we&apos;re here.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">
        <div className="space-y-8">
          {/* Contact */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
              <Mail className="h-5 w-5 text-teal-500" /> Contact us
            </h2>
            <p className="mt-2 text-stone-600">
              Email us and we&apos;ll get back to you, usually within 1–2 business days.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
            </a>
          </div>

          {/* Common topics */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-stone-900">Common questions</h2>
            <dl className="mt-4 space-y-5">
              <div>
                <dt className="font-medium text-stone-900">How do I claim my business?</dt>
                <dd className="mt-1 text-sm text-stone-600">
                  Open your business page and tap &ldquo;Claim this business,&rdquo; then verify ownership. Once
                  claimed you can edit your profile, post, add events, and collaborate.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">How do collaboration invites work?</dt>
                <dd className="mt-1 text-sm text-stone-600">
                  Businesses invite each other to collaborate on events. You&apos;ll get the invite in the app,
                  by notification, and by email so you don&apos;t miss it — accept to open a shared chat.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">How do I delete my account?</dt>
                <dd className="mt-1 text-sm text-stone-600">
                  Go to <Link href="/shopper" className="font-medium text-teal-600 hover:underline">Your space</Link>,
                  and under &ldquo;Account&rdquo; choose &ldquo;Delete account.&rdquo; This permanently removes your
                  account and personal data.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">How do I turn off notifications?</dt>
                <dd className="mt-1 text-sm text-stone-600">
                  Manage notifications in your device&apos;s Settings under WhatsLocal.
                </dd>
              </div>
            </dl>
          </div>

          {/* Legal */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-300"
            >
              <ShieldCheck className="h-4 w-4 text-teal-500" /> Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-300"
            >
              <FileText className="h-4 w-4 text-teal-500" /> Terms of Service
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
