import { createHash } from 'node:crypto'

// Product photos are stored on Cloudinary. The browser uploads them straight to Cloudinary with a
// signature from this server, so the photos never pass through Vercel or Render.
// CLOUDINARY_URL is "cloudinary://<api key>:<api secret>@<cloud name>", from Settings → API Keys.
function readConfig() {
  const value = process.env.CLOUDINARY_URL
  if (!value) return null
  const url = new URL(value)
  const config = {
    cloudName: url.hostname,
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
  }
  if (url.protocol !== 'cloudinary:' || !config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new Error('CLOUDINARY_URL should look like cloudinary://<api key>:<api secret>@<cloud name>')
  }
  return config
}

export const cloudinary = readConfig()

export const PRODUCT_IMAGE_FOLDER = 'fika/products'
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif,heic'

// Permission for one upload into the product folder. Cloudinary refuses it after an hour,
// or if the browser changes any of the signed fields.
export function signProductUpload(now = new Date()) {
  const { cloudName, apiKey, apiSecret } = cloudinary!
  const params: Record<string, string> = {
    allowed_formats: ALLOWED_FORMATS,
    folder: PRODUCT_IMAGE_FOLDER,
    timestamp: String(Math.floor(now.getTime() / 1000)),
  }
  // Cloudinary's scheme: the fields sorted by name as "a=1&b=2", followed by the secret, hashed with SHA-1
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  const signature = createHash('sha1').update(toSign + apiSecret).digest('hex')
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    fields: { ...params, api_key: apiKey, signature },
  }
}

// Only photos uploaded into this account's product folder can be put on the menu
export function isProductImageUrl(url: string) {
  if (!cloudinary) return false
  const prefix = `https://res.cloudinary.com/${cloudinary.cloudName}/image/upload/`
  return url.startsWith(prefix) && url.includes(`/${PRODUCT_IMAGE_FOLDER}/`) && !/[\s"'<>]/.test(url)
}
