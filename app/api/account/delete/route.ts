import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// In-app account deletion — required by App Store guideline 5.1.1(v) for any app
// that supports account creation (we create Clerk accounts). Removes the user's
// personal app data, then deletes the Clerk account itself. Irreversible.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // Best-effort cleanup of personal rows keyed to the Clerk user. Uses the
  // service-role key (RLS-hardened tables have no anon grants).
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    await Promise.allSettled([
      supabase.from('device_tokens').delete().eq('clerk_user_id', userId), // push devices
      supabase.from('vendor_profiles').delete().eq('clerk_user_id', userId), // unlinks the member
      supabase.from('broadcast_saves').delete().eq('clerk_user_id', userId), // saved venues
    ])
  } catch (e) {
    console.error('account delete — data cleanup failed (continuing to delete account):', e)
  }

  // Delete the Clerk account. This is the part Apple actually requires.
  try {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  } catch (e) {
    console.error('account delete — Clerk deleteUser failed:', e)
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
