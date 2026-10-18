// Feed seeding controls. Super-admin only.
//
// GET   → status: live / scheduled counts, paused, pending Xeno drafts
// POST  → { action: 'generate', drafts?: number }  house posts + recaps + drafts
//         { action: 'pause' | 'resume' }           the no-restart kill switch
// PATCH → { id, action: 'post', body }  post a draft AS THE CALLER
//         { id, action: 'skip' }
//
// "Post" publishes under the signed-in admin's own account — the person who
// read the draft and pressed the button. Nothing here can post as anyone else.

import { NextResponse, type NextRequest } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'
import { feedSeedStatus, generateFeedItems, setFeedItemsPaused, getDraft, markDraft } from '@/lib/feed-items'
import { createPost, invalidatePosts } from '@/lib/posts'
import { getVendorProfile } from '@/lib/vendor-connect'
import { getMember } from '@/lib/api'
import { screen } from '@/lib/ai-moderation'

export const runtime = 'nodejs'

async function gate() {
  const { userId } = await auth()
  return isAdmin(userId) ? userId : null
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  try {
    return NextResponse.json(await feedSeedStatus())
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const b = (await req.json().catch(() => ({}))) as { action?: string; drafts?: number }
  try {
    if (b.action === 'generate') {
      const drafts = Math.max(0, Math.min(10, Number(b.drafts ?? 6) || 0))
      return NextResponse.json({ written: await generateFeedItems({ drafts }) })
    }
    if (b.action === 'pause' || b.action === 'resume') {
      await setFeedItemsPaused(b.action === 'pause')
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await gate()
  if (!userId) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const b = (await req.json().catch(() => ({}))) as { id?: string; action?: string; body?: string }
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const draft = await getDraft(b.id)
  if (!draft || draft.status !== 'draft') return NextResponse.json({ error: 'That draft is gone' }, { status: 404 })

  if (b.action === 'skip') {
    await markDraft(draft.id, 'skipped', userId)
    return NextResponse.json({ ok: true })
  }
  if (b.action !== 'post') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const body = (b.body ?? draft.body).toString().trim()
  if (body.length < 3) return NextResponse.json({ error: 'The post is empty' }, { status: 400 })
  const imageUrls = draft.image_url ? [draft.image_url] : []

  // Same screening as every other post.
  const verdict = await screen({ text: body, imageUrls })
  if (verdict.action === 'block') {
    return NextResponse.json({ error: "That text breaks the content rules, so it wasn't posted." }, { status: 422 })
  }

  // The byline is the caller's own business page when they have one (Xeno),
  // else their first name — the same name their own composer posts would use.
  let authorName: string | null = null
  try {
    const vp = await getVendorProfile(userId)
    if (vp?.member_id) {
      const m = (await getMember(vp.member_id)) as unknown as { member?: { profile?: { name?: string; businessName?: string } } }
      authorName = m.member?.profile?.businessName || m.member?.profile?.name || null
    }
  } catch {
    /* fall through to the Clerk name */
  }
  if (!authorName) {
    const u = await currentUser()
    authorName = u?.firstName || u?.username || null
  }

  const coord = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 1000)
  try {
    const post = await createPost({
      author_id: userId,
      author_name: authorName,
      body,
      image_urls: imageUrls,
      video_urls: [],
      tagged_member_id: null,
      tagged_member_name: null,
      tagged_event_id: draft.event_id,
      tagged_event_title: draft.title,
      livestream_url: null,
      location: draft.venue || draft.neighborhood || 'San Francisco',
      lat: coord(draft.lat),
      lng: coord(draft.lng),
      moderation_status: verdict.action === 'review' ? 'pending' : 'allowed',
    })
    await markDraft(draft.id, 'posted', userId, { body, postId: post.id })
    invalidatePosts()
    return NextResponse.json({ ok: true, postId: post.id, held: verdict.action === 'review' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not post' }, { status: 500 })
  }
}
