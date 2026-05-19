import { SignIn } from '@clerk/nextjs'

export default function VendorSignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <SignIn routing="hash" forceRedirectUrl="/vendor" />
    </div>
  )
}
