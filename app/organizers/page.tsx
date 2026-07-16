import type { Metadata } from "next";
import { OrganizeManager } from "@/app/vendor/organize/OrganizeManager";

// Public organizer preview — NO LOGIN.
//
// This is the real organizer toolkit (the same OrganizeManager that runs at
// /vendor/organize), mounted on sample data so you can hand an organizer the
// link — or walk them through it at a table — before they have an account.
// Every action works locally; nothing persists, nothing sends, no API is called.
// When organizers get logins, delete this page: the tool is already built.
export const metadata: Metadata = {
  title: "For organizers",
  description:
    "Run your market or festival: one lineup with roles and approvals, vendors who join by QR at the booth, SMS and email to everyone at once, and free RSVPs.",
};

export default function OrganizersPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-8">
      <div className="mb-6">
        <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
          Sample event — try anything
        </span>
        <h1 className="mt-3 text-xl font-semibold text-stone-900">
          Run your market without the group chat.
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-stone-600">
          One lineup with roles and approvals · vendors join by scanning a QR at the booth ·
          SMS and email the whole lineup at once · free RSVPs with capacity. This is the real
          tool, filled with a sample market — click through it. Nothing you do here saves or sends.
        </p>
      </div>

      <OrganizeManager memberId="demo-organizer" isAdmin={false} emailReady demo eventOrganizer />
    </div>
  );
}
