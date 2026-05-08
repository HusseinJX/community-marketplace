import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export interface VendorConnectAccount {
  member_id: string
  stripe_account_id: string
  status: string
  onboarding_url?: string | null
}

export async function getVendorConnectAccount(memberId: string): Promise<VendorConnectAccount | null> {
  const { data, error } = await supabase
    .from('stripe_connect_accounts')
    .select('*')
    .eq('member_id', memberId)
    .single()

  if (error || !data) return null
  return data as VendorConnectAccount
}

export async function setVendorConnectAccount(
  memberId: string,
  data: { stripeAccountId: string; status: string; onboardingUrl?: string }
): Promise<void> {
  const row = {
    member_id: memberId,
    stripe_account_id: data.stripeAccountId,
    status: data.status,
    onboarding_url: data.onboardingUrl ?? null,
  }

  const { error } = await supabase
    .from('stripe_connect_accounts')
    .upsert(row, { onConflict: 'member_id' })

  if (error) throw new Error(`Failed to save vendor connect account: ${error.message}`)
}

export async function updateVendorConnectStatus(stripeAccountId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_connect_accounts')
    .update({ status })
    .eq('stripe_account_id', stripeAccountId)

  if (error) throw new Error(`Failed to update vendor connect status: ${error.message}`)
}
