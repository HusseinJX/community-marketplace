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

// ── Orders ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  name: string
  qty: number
  price_cents: number
  product_id?: string
}

export interface Order {
  id: string
  order_number: string
  payment_intent_id: string
  member_id: string
  buyer_email: string | null
  status: string
  items: OrderItem[]
  subtotal_cents: number
  platform_fee_cents: number
  vendor_amount_cents: number
  delivery_requested: boolean
  uber_delivery_id: string | null
  uber_tracking_url: string | null
  created_at: string
  updated_at: string
}

export async function createOrder(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .upsert(order, { onConflict: 'payment_intent_id' })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create order: ${error?.message}`)
  return data as Order
}

export async function getOrdersByMember(memberId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as Order[]
}

export async function getOrderByPaymentIntent(paymentIntentId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_intent_id', paymentIntentId)
    .single()

  if (error || !data) return null
  return data as Order
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`Failed to update order status: ${error.message}`)
}

export async function updateOrderUber(
  id: string,
  uberDeliveryId: string,
  uberTrackingUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ uber_delivery_id: uberDeliveryId, uber_tracking_url: uberTrackingUrl, status: 'dispatched', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`Failed to update order uber fields: ${error.message}`)
}

// ── Vendor Settings ───────────────────────────────────────────────────────────

export interface VendorSettings {
  member_id: string
  uber_direct_enabled: boolean
  uber_pickup_address: string | null
  uber_pickup_phone: string | null
  composio_connection_id: string | null
  composio_platform: string | null
}

export async function getVendorSettings(memberId: string): Promise<VendorSettings | null> {
  const { data, error } = await supabase
    .from('vendor_settings')
    .select('*')
    .eq('member_id', memberId)
    .single()

  if (error || !data) return null
  return data as VendorSettings
}

export async function upsertVendorSettings(
  memberId: string,
  fields: Partial<Omit<VendorSettings, 'member_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('vendor_settings')
    .upsert({ member_id: memberId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'member_id' })

  if (error) throw new Error(`Failed to upsert vendor settings: ${error.message}`)
}

// ── Stripe Connect ────────────────────────────────────────────────────────────

export async function updateVendorConnectStatus(stripeAccountId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_connect_accounts')
    .update({ status })
    .eq('stripe_account_id', stripeAccountId)

  if (error) throw new Error(`Failed to update vendor connect status: ${error.message}`)
}

export interface VendorProfile {
  clerk_user_id: string
  member_id: string
  email: string | null
  verification_status: string
  verification_method: string | null
  verification_evidence: Record<string, unknown> | null
}

export async function getVendorProfile(clerkUserId: string): Promise<VendorProfile | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error || !data) return null
  return data as VendorProfile
}

export async function setVendorProfile(
  clerkUserId: string,
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
        clerk_user_id: clerkUserId,
        member_id: memberId,
        email,
        verification_status: verificationStatus,
        verification_method: verificationMethod ?? null,
        verification_evidence: verificationEvidence ?? null,
      },
      { onConflict: 'clerk_user_id' }
    )

  if (error) throw new Error(`Failed to save vendor profile: ${error.message}`)
}
