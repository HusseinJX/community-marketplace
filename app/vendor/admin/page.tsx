import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { AdminPanel } from "./AdminPanel";

export default async function VendorAdminPage() {
  const { userId } = await auth();
  const admin = isAdmin(userId);

  if (!admin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-900">Admins only</p>
        <p className="mt-1 text-sm text-amber-700">
          This panel is restricted to super-admins (your Clerk ID must be in <code>ADMIN_CLERK_USER_IDS</code>).
        </p>
        <Link href="/vendor" className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // The admin's own member (if linked) owns any grouping tags / event lineups
  // created from the transcript flow. Empty string is fine if unlinked.
  const profile = userId ? await getVendorProfile(userId) : null;

  return (
    <Suspense>
      <AdminPanel ownerMemberId={profile?.member_id ?? ""} />
    </Suspense>
  );
}
