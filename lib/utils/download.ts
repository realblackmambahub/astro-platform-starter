import { UAParser } from 'ua-parser-js'

export function generateSecureCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  for (let i = 0; i < array.length; i++) {
    code += chars[array[i] % chars.length]
  }
  return code
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const real = request.headers.get('x-real-ip')
  return (forwarded?.split(',')?.[0] || real || 'unknown').trim()
}

export async function getGeolocation(ip: string): Promise<{
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
  provider: string | null
  organization: string | null
  country_code: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
}> {
  if (ip === 'unknown' || !ip || ip === '127.0.0.1' || ip === '::1') {
    return {
      country: null,
      region: null,
      city: null,
      timezone: null,
      provider: null,
      organization: null,
      country_code: null,
      postal_code: null,
      latitude: null,
      longitude: null,
    }
  }

  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
    if (!response.ok) {
      return {
        country: null,
        region: null,
        city: null,
        timezone: null,
        provider: null,
        organization: null,
        country_code: null,
        postal_code: null,
        latitude: null,
        longitude: null,
      }
    }
    const data = await response.json()
    return {
      country: data.country_name || null,
      region: data.region || null,
      city: data.city || null,
      timezone: data.timezone || null,
      provider: data.asn_org || null,
      organization: data.org || null,
      country_code: data.country_code || null,
      postal_code: data.postal || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    }
  } catch (error) {
    console.error('[v0] Geolocation lookup failed:', error)
    return {
      country: null,
      region: null,
      city: null,
      timezone: null,
      provider: null,
      organization: null,
      country_code: null,
      postal_code: null,
      latitude: null,
      longitude: null,
    }
  }
}

export function getDeviceInfo(userAgent: string): {
  device_type: 'desktop' | 'mobile' | 'tablet' | 'other'
  operating_system: string | null
  browser: string | null
  browser_version: string | null
} {
  const parser = new UAParser(userAgent)
  const result = parser.getResult()

  let device_type: 'desktop' | 'mobile' | 'tablet' | 'other' = 'other'
  if (result.device.type === 'mobile') {
    device_type = 'mobile'
  } else if (result.device.type === 'tablet') {
    device_type = 'tablet'
  } else if (!result.device.type) {
    device_type = 'desktop'
  }

  return {
    device_type,
    operating_system: result.os.name || null,
    browser: result.browser.name || null,
    browser_version: result.browser.version || null,
  }
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
}
