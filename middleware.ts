import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// The vendor portal is gated in `app/vendor/layout.tsx` (redirect to the
// public /vendor/sign-in landing) rather than here, so the sign-in page — a
// public modal-login landing modeled on /shopper — renders without looping.
// We forward the request path so the layout knows when it's on that page.
export default clerkMiddleware(async (_auth, req) => {
  const headers = new Headers(req.headers)
  headers.set('x-pathname', req.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
