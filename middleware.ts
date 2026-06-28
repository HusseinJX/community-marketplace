import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isVendorRoute = createRouteMatcher(['/vendor((?!/sign-in).*)'])

// Demo mode lets the vendor portal be previewed without auth (gated by env).
// When on, skip route protection so the layout's demo bypass can render.
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === '1'

export default clerkMiddleware(async (auth, req) => {
  if (!demoMode && isVendorRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
