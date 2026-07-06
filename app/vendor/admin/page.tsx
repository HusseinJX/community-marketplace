import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { AdminPanel } from "./AdminPanel";

export default async function VendorAdminPage() {
  const { userId } = await auth();

  // Not a super-admin → silently send back to the dashboard (no gate copy).
  if (!isAdmin(userId)) {
    redirect("/vendor");
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
