import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export default async function VendorSignInPage() {
  const url = await getSignInUrl({ returnTo: "/vendor" });
  redirect(url);
}
