import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export default async function VendorSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">Sign-in failed</h1>
          <p className="mt-2 font-mono text-sm text-red-600 break-all">{error}</p>
          <a
            href="/vendor/sign-in"
            className="mt-4 inline-block text-sm text-indigo-700 hover:underline"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  const url = await getSignInUrl({ returnTo: "/vendor" });
  redirect(url);
}
