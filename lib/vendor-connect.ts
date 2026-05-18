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

export interface SupabaseProduct {
  id: string
  member_id: string
  member_name: string
  name: string
  description: string | null
  price: number
  currency: string
  image_url: string | null
  active: boolean
}

export async function getProductsByMember(memberId: string): Promise<SupabaseProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('member_id', memberId)
    .eq('active', true)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data as SupabaseProduct[]
}

export async function updateVendorConnectStatus(stripeAccountId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_connect_accounts')
    .update({ status })
    .eq('stripe_account_id', stripeAccountId)

  if (error) throw new Error(`Failed to update vendor connect status: ${error.message}`)
}

export interface VendorProfile {
  workos_user_id: string
  member_id: string
  email: string | null
  verification_status: string
  verification_method: string | null
  verification_evidence: Record<string, unknown> | null
}

export async function getVendorProfile(workosUserId: string): Promise<VendorProfile | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('*')
    .eq('workos_user_id', workosUserId)
    .single()

  if (error || !data) return null
  return data as VendorProfile
}

export async function setVendorProfile(
  workosUserId: string,
  memberId: string,
  email: string | null,
  verificationStatus: string = 'pending',
  verificationMethod?: string,
  verificationEvidence?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('vendor_profiles')
    .upsert(
      {
        workos_user_id: workosUserId,
        member_id: memberId,
        email,
        verification_status: verificationStatus,
        verification_method: verificationMethod ?? null,
        verification_evidence: verificationEvidence ?? null,
      },
      { onConflict: 'workos_user_id' }
    )

  if (error) throw new Error(`Failed to save vendor profile: ${error.message}`)
}
