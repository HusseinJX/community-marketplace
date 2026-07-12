import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { FeaturedManager } from "./FeaturedManager";

export default async function VendorFeaturedPage() {
  const { userId } = await auth();

  if (!isAdmin(userId)) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-sm font-medium text-stone-900">Superadmin only</p>
        <p className="mt-1 text-sm text-stone-500">
          Featured home-screen lists are managed by platform admins. Add your Clerk user ID to
          <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs">ADMIN_CLERK_USER_IDS</code>
          to manage them.
        </p>
      </div>
    );
  }

  return <FeaturedManager />;
}
