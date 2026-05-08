import { clerkMiddleware } from "@clerk/nextjs/server";
import { authkitProxy } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

const vendorMiddleware = authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/vendor/sign-in", "/vendor/auth/callback"],
  },
});

const shopperMiddleware = clerkMiddleware();

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname.startsWith("/vendor")) {
    return vendorMiddleware(req, event);
  }
  return shopperMiddleware(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
