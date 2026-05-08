import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export const GET = handleAuth({
  onError: ({ error }) => {
    console.error("[WorkOS callback error]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.redirect(
      new URL(`/vendor/sign-in?error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "http://localhost:3004")
    );
  },
});
