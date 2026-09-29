import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { ChevronLeft } from "lucide-react";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";

export const metadata = { title: "Account" };

// Who you're signed in as, and the way out. Delete account is required to be
// reachable in-app (App Store 5.1.1(v)) — it lives here, one tap from the
// Profile hub, rather than under the dashboard's welcome title.
export default async function VendorAccountPage() {
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/vendor/profile"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <ChevronLeft className="h-4 w-4" /> Profile
      </Link>

      <h1 className="text-xl font-semibold text-stone-900">Account</h1>

      <div className="card-soft p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Signed in as</p>
        <p className="mt-1 break-all text-sm font-semibold text-stone-900">
          {email ?? "Not signed in"}
        </p>
      </div>

      {user && <DeleteAccountButton />}
    </div>
  );
}
