import { createClient } from '@supabase/supabase-js'

// Storage writes prefer the service-role key (bypasses RLS). Falls back to the
// anon key if that's all that's configured — in which case the bucket's policies
// must permit the upload. Used for menu/flyer/counter uploads, event posters,
// and AI-generated product images (Phase 2).
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

export const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'marketplace-media'

export interface UploadResult {
  path: string
  publicUrl: string
}

// Upload a binary buffer (image) and return its public URL. `prefix` namespaces
// the object (e.g. `uploads/<memberId>`, `products/<memberId>`).
export async function uploadImage(
  buffer: Buffer | Uint8Array,
  opts: { prefix: string; filename: string; contentType?: string }
): Promise<UploadResult> {
  const path = `${opts.prefix.replace(/\/+$/, '')}/${opts.filename}`
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, buffer, {
      contentType: opts.contentType || 'image/png',
      upsert: true,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}
