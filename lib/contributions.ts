import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Community giving data layer. Service-role preferred (falls back to anon, which
// the open grant/policy permits).
let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key are required')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

export type ContributionKind = 'funds' | 'goods' | 'time' | 'other'
export type ContributionStatus = 'pending' | 'confirmed' | 'declined'

export interface Contribution {
  id: string
  vendor_id: string
  vendor_name: string | null
  org_id: string
  org_name: string | null
  kind: ContributionKind
  description: string
  amount_cents: number | null
  status: ContributionStatus
  confirmed_at: string | null
  created_at: string
}

export const KIND_LABEL: Record<ContributionKind, string> = {
  funds: 'Funds',
  goods: 'Goods',
  time: 'Time / volunteering',
  other: 'Other',
}

export type NewContribution = Pick<
  Contribution,
  'vendor_id' | 'vendor_name' | 'org_id' | 'org_name' | 'kind' | 'description' | 'amount_cents'
>

export async function createContribution(c: NewContribution): Promise<Contribution> {
  const { data, error } = await db()
    .from('community_contributions')
    .insert({ ...c, status: 'pending' })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to log contribution: ${error?.message}`)
  return data as Contribution
}

// Gifts a vendor has logged (any status).
export async function getContributionsByVendor(vendorId: string): Promise<Contribution[]> {
  const { data, error } = await db()
    .from('community_contributions')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as Contribution[]
}

// Gifts addressed to an org, optionally only those awaiting confirmation.
export async function getContributionsForOrg(
  orgId: string,
  status?: ContributionStatus
): Promise<Contribution[]> {
  let q = db().from('community_contributions').select('*').eq('org_id', orgId)
  if (status) q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error || !data) return []
  return data as Contribution[]
}

// Public: confirmed gifts shown on a vendor's profile ("Gives back").
export async function getConfirmedContributions(vendorId: string): Promise<Contribution[]> {
  const { data, error } = await db()
    .from('community_contributions')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false })
  if (error || !data) return []
  return data as Contribution[]
}

// Org confirms or declines. Scoped by orgId so a member can only act on gifts
// addressed to them.
export async function setContributionStatus(
  id: string,
  orgId: string,
  status: 'confirmed' | 'declined'
): Promise<void> {
  const { error } = await db()
    .from('community_contributions')
    .update({ status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('org_id', orgId)
  if (error) throw new Error(`Failed to update contribution: ${error.message}`)
}
