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
  const data = (await put.json()) as { id?: string }
  if (!data.id) throw new Error('YouTube upload: no video id returned')
  return { videoId: data.id, videoUrl: `https://www.youtube.com/watch?v=${data.id}` }
}
