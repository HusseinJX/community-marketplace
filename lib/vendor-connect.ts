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
  source?: string
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

// Owner/admin view — includes drafts (active=false) for the approval queue.
export async function getAllProductsByMember(memberId: string): Promise<SupabaseProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as SupabaseProduct[]
}

export interface NewProduct {
  name: string
  description?: string | null
  price: number // cents
  currency?: string
  image_url?: string | null
  active?: boolean // false = draft pending approval
  source?: string // manual | ai_menu | ai_counter | shopify | square
}

export async function createProduct(
  memberId: string,
  memberName: string,
  p: NewProduct
): Promise<SupabaseProduct> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      member_id: memberId,
      member_name: memberName,
      name: p.name,
      description: p.description ?? null,
      price: p.price,
      currency: p.currency ?? 'usd',
      image_url: p.image_url ?? null,
      active: p.active ?? true,
      source: p.source ?? 'manual',
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to create product: ${error?.message}`)
  return data as SupabaseProduct
}

export async function updateProduct(
  id: string,
  memberId: string,
  fields: Partial<NewProduct>
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('member_id', memberId)
  if (error) throw new Error(`Failed to update product: ${error.message}`)
}

export async function deleteProduct(id: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id).eq('member_id', memberId)
  if (error) throw new Error(`Failed to delete product: ${error.message}`)
}

// ── Vendor Events (self-serve / AI-captured) ───────────────────────────────────

export interface VendorEvent {
  id: string
  member_id: string
  member_name: string | null
  title: string
  description: string | null
  event_date: string | null
  event_time: string | null
  location: string | null
  poster_image_url: string | null
  capacity: number | null
  source: string
  active: boolean
  created_at: string
}

export interface NewVendorEvent {
  title: string
  description?: string | null
  event_date?: string | null
  event_time?: string | null
  location?: string | null
  poster_image_url?: string | null
  capacity?: number | null
  active?: boolean
  source?: string
}

export async function getVendorEventsByMember(memberId: string, includeDrafts = false): Promise<VendorEvent[]> {
  let q = supabase.from('vendor_events').select('*').eq('member_id', memberId)
  if (!includeDrafts) q = q.eq('active', true)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error || !data) return []
  return data as VendorEvent[]
}

// All live (active) events across every member — for the public community feed.
export async function getPublicEvents(limit = 50): Promise<VendorEvent[]> {
  const { data, error } = await supabase
    .from('vendor_events')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as VendorEvent[]
}

export async function getVendorEventById(id: string): Promise<VendorEvent | null> {
  const { data, error } = await supabase.from('vendor_events').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return data as VendorEvent
}

export async function createVendorEvent(
  memberId: string,
  memberName: string,
  e: NewVendorEvent
): Promise<VendorEvent> {
  const { data, error } = await supabase
    .from('vendor_events')
    .insert({
      member_id: memberId,
      member_name: memberName,
      title: e.title,
      description: e.description ?? null,
      event_date: e.event_date ?? null,
      event_time: e.event_time ?? null,
      location: e.location ?? null,
      poster_image_url: e.poster_image_url ?? null,
      capacity: e.capacity ?? null,
      active: e.active ?? true,
      source: e.source ?? 'manual',
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to create event: ${error?.message}`)
  return data as VendorEvent
}

export async function updateVendorEvent(
  id: string,
  memberId: string,
  fields: Partial<NewVendorEvent>
): Promise<void> {
  const { error } = await supabase
    .from('vendor_events')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('member_id', memberId)
  if (error) throw new Error(`Failed to update event: ${error.message}`)
}

export async function deleteVendorEvent(id: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('vendor_events').delete().eq('id', id).eq('member_id', memberId)
  if (error) throw new Error(`Failed to delete event: ${error.message}`)
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

export async function getOrderByNumber(orderNumber: string, memberId?: string): Promise<Order | null> {
  let q = supabase.from('orders').select('*').eq('order_number', orderNumber)
  if (memberId) q = q.eq('member_id', memberId)
  const { data, error } = await q.single()
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
  assistant_enabled?: boolean
  assistant_persona?: string | null
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

// ── AI Assistant: knowledge, transcripts, leads ────────────────────────────────

export interface BusinessKnowledge {
  id: string
  member_id: string
  content: string
  source: string
  created_at: string
}

export async function getBusinessKnowledge(memberId: string): Promise<BusinessKnowledge[]> {
  const { data, error } = await supabase
    .from('business_knowledge')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data as BusinessKnowledge[]
}

export async function addBusinessKnowledge(memberId: string, content: string, source = 'manual'): Promise<void> {
  const { error } = await supabase
    .from('business_knowledge')
    .insert({ member_id: memberId, content, source })
  if (error) throw new Error(`Failed to add knowledge: ${error.message}`)
}

export async function deleteBusinessKnowledge(id: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('business_knowledge')
    .delete()
    .eq('id', id)
    .eq('member_id', memberId)
  if (error) throw new Error(`Failed to delete knowledge: ${error.message}`)
}

export async function createConversation(memberId: string): Promise<string> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ member_id: memberId })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`)
  return (data as { id: string }).id
}

export async function appendMessages(
  conversationId: string,
  memberId: string,
  messages: { role: string; content: string }[]
): Promise<void> {
  if (messages.length === 0) return
  const rows = messages.map((m) => ({
    conversation_id: conversationId,
    member_id: memberId,
    role: m.role,
    content: m.content,
  }))
  const { error } = await supabase.from('chat_messages').insert(rows)
  if (error) throw new Error(`Failed to append messages: ${error.message}`)
}

export interface ChatLead {
  id: string
  member_id: string
  conversation_id: string | null
  name: string | null
  contact: string | null
  message: string | null
  created_at: string
}

export async function createLead(lead: {
  memberId: string
  conversationId?: string | null
  name?: string | null
  contact?: string | null
  message?: string | null
}): Promise<void> {
  const { error } = await supabase.from('chat_leads').insert({
    member_id: lead.memberId,
    conversation_id: lead.conversationId ?? null,
    name: lead.name ?? null,
    contact: lead.contact ?? null,
    message: lead.message ?? null,
  })
  if (error) throw new Error(`Failed to create lead: ${error.message}`)
}

export async function getLeadsByMember(memberId: string): Promise<ChatLead[]> {
  const { data, error } = await supabase
    .from('chat_leads')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as ChatLead[]
}

export interface ConversationSummary {
  id: string
  member_id: string
  created_at: string
}

export async function getConversationsByMember(memberId: string, limit = 50): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as ConversationSummary[]
}

export async function getMessagesByConversation(conversationId: string): Promise<{ role: string; content: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as { role: string; content: string; created_at: string }[]
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
