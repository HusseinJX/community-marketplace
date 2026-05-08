import { withAuth, signOut } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user } = await withAuth();

  if (!user) redirect("/vendor/sign-in");

  async function handleSignOut() {
    "use server";
    await signOut({ returnTo: "/vendor/sign-in" });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/vendor" className="text-sm font-semibold text-stone-900">
              Vendor Portal
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500">{user.email}</span>
            <form action={handleSignOut}>
              <button type="submit" className="text-sm text-stone-500 hover:text-stone-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
