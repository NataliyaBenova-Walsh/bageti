import { postJson } from '../api'

// Cloudinary's limit for images on the free plan
const MAX_BYTES = 10 * 1024 * 1024

type SignedUpload = { uploadUrl: string; fields: Record<string, string> }

// Uploads a photo straight to Cloudinary, with a signature from our API, and returns its address.
// The address is then saved on the product, which the API only accepts from the shop's folder.
export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo (JPG, PNG, WebP, AVIF or HEIC).')
  if (file.size > MAX_BYTES) throw new Error('That photo is over 10 MB. Please choose a smaller one.')

  const { uploadUrl, fields } = await postJson<SignedUpload>('/api/admin/uploads/product-image')
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('file', file)

  const res = await fetch(uploadUrl, { method: 'POST', body: form })
  const body = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } }
  if (!res.ok || !body.secure_url) throw new Error(`The photo couldn't be uploaded${body.error?.message ? `: ${body.error.message}` : '.'}`)
  return body.secure_url
}
