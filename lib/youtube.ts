// Upload videos to a central company YouTube channel as UNLISTED, and store the
// watch URL — YouTube is our video store (free hosting + transcoding + adaptive
// streaming), embedded via an iframe (lib/embed.ts). Ported from the prolocaliq
// youtube-upload-service; adapted to our lazy/env-gated convention (mirrors
// lib/push.ts pushConfigured() + lib/openai.ts lazy singleton).
//
// One central account, tokens from env — no per-user/per-business OAuth here.

const CLIENT_ID = () => process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = () => process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || ''
const REFRESH_TOKEN = () => process.env.YOUTUBE_REFRESH_TOKEN || ''

// True once the central channel's OAuth is configured. Callers gate on this.
export function youtubeConfigured(): boolean {
  return Boolean(REFRESH_TOKEN() && CLIENT_ID() && CLIENT_SECRET())
}

// Cached access token (refresh tokens are long-lived; access tokens ~1h).
let accessToken: string | null = null
let tokenExpiry = 0 // epoch ms

async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken
  if (!youtubeConfigured()) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      refresh_token: REFRESH_TOKEN(),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    console.error('YouTube token refresh failed:', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
  return accessToken
}

export interface YouTubeUploadResult {
  videoId: string
  videoUrl: string // https://www.youtube.com/watch?v=<id>
  // WHICH channel it landed on. The upload already asks for `part=snippet`, so
  // the API returns this for free and we used to discard it — which left the
  // one thing worth confirming (that videos go to the brand channel, not
  // somebody's personal one) impossible to check without a second API call and
  // a wider scope. A refresh token binds to whichever channel was picked at
  // consent, and nothing in the token says which, so record it per upload.
  channelId?: string
  channelTitle?: string
}

// Resumable 2-step upload → unlisted video. Throws on failure so callers can
// return a clear error (video upload is YouTube-only, no Supabase fallback).
export async function uploadVideo(
  video: Buffer | Uint8Array,
  opts: { title: string; description?: string; tags?: string[] },
): Promise<YouTubeUploadResult> {
  const token = await getAccessToken()
  if (!token) throw new Error('YouTube not configured or token refresh failed')

  const buffer = Buffer.isBuffer(video) ? video : Buffer.from(video)
  const metadata = {
    snippet: {
      title: opts.title.slice(0, 100) || 'WhatsLocal video',
      description: opts.description?.slice(0, 4500) || '',
      tags: opts.tags ?? [],
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus: 'unlisted' as const,
      selfDeclaredMadeForKids: false,
    },
  }

  // Step 1 — initiate a resumable session; the upload URL comes back in Location.
  const init = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': String(buffer.length),
      },
      body: JSON.stringify(metadata),
    },
  )
  if (!init.ok) {
    throw new Error(`YouTube upload init failed: ${init.status} ${await init.text().catch(() => '')}`)
  }
  const uploadUrl = init.headers.get('Location')
  if (!uploadUrl) throw new Error('YouTube upload: no resumable URL returned')

  // Step 2 — PUT the bytes. (fetch sets Content-Length from the body; setting it
  // manually is a forbidden header. Body must be a BufferSource, not a Buffer.)
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/*' },
    body: new Uint8Array(buffer),
  })
  if (!put.ok) {
    throw new Error(`YouTube upload failed: ${put.status} ${await put.text().catch(() => '')}`)
  }
  const data = (await put.json()) as {
    id?: string
    snippet?: { channelId?: string; channelTitle?: string }
  }
  if (!data.id) throw new Error('YouTube upload: no video id returned')
  return {
    videoId: data.id,
    videoUrl: `https://www.youtube.com/watch?v=${data.id}`,
    channelId: data.snippet?.channelId,
    channelTitle: data.snippet?.channelTitle,
  }
}

/**
 * Delete a video from the central channel.
 *
 * Needed because a YouTube URL is its own access control: an unlisted video
 * stays playable forever by anyone holding the link, so dropping a post row
 * without this leaves the video up and the "delete" a lie.
 *
 * Requires the `youtube.force-ssl` scope — `youtube.upload` can only add. A
 * token minted before that scope was requested will 403 here while uploads keep
 * working, which is why this reports failure rather than throwing.
 *
 * Returns true when the video is gone, INCLUDING when it was already gone (404)
 * — the caller's intent is "this should not exist", and a second delete of the
 * same id is success, not an error.
 */
export async function deleteVideo(videoIdOrUrl: string): Promise<boolean> {
  const id = extractVideoId(videoIdOrUrl)
  if (!id) return false

  const token = await getAccessToken()
  if (!token) return false

  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204 || res.status === 404) return true

  console.error('YouTube delete failed:', res.status, await res.text().catch(() => ''))
  return false
}

/**
 * Video id from a watch URL, a youtu.be link, an embed URL, or a bare id.
 *
 * We store whole URLs in `posts.video_urls`, so deletion has to work from what
 * is actually on the row rather than an id nobody kept.
 */
const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

export function extractVideoId(input: string): string | null {
  const s = (input || '').trim()
  if (!s) return null
  // A bare id: 11 chars of the YouTube alphabet, no scheme or slashes.
  if (/^[\w-]{11}$/.test(s) && !s.includes('/')) return s
  try {
    const u = new URL(s)
    // HOST CHECK FIRST. A YouTube id is any 11 characters of [A-Za-z0-9_-], and
    // plenty of ordinary path segments are exactly that — "not-a-video" is 11.
    // Without this, a non-YouTube URL on a post yields a plausible-looking id
    // and we issue a delete for someone else's video id.
    if (!YT_HOSTS.has(u.hostname.toLowerCase())) return null
    const v = u.searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
    // youtu.be/<id>, /embed/<id>, /shorts/<id>, /v/<id>
    const last = u.pathname.split('/').filter(Boolean).pop() ?? ''
    return /^[\w-]{11}$/.test(last) ? last : null
  } catch {
    return null
  }
}

/**
 * Best-effort reap of every video on a post. Never throws and never blocks a
 * response — a post the user asked to delete should disappear even if YouTube
 * is having a bad day. Returns how many were removed.
 */
export async function deleteVideosSafe(urls: string[] | null | undefined): Promise<number> {
  if (!urls?.length || !youtubeConfigured()) return 0
  let gone = 0
  for (const u of urls) {
    try {
      if (await deleteVideo(u)) gone++
    } catch (err) {
      console.error('YouTube delete threw:', err)
    }
  }
  return gone
}
