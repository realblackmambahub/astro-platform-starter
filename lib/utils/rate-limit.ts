import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

interface RateLimitOptions {
  limit: number
  window: number // in seconds
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

export async function rateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    const current = await redis.incr(key)

    // Set expiration only on first request in the window
    if (current === 1) {
      await redis.expire(key, options.window)
    }

    const ttl = await redis.ttl(key)
    const resetTime = Date.now() + ttl * 1000

    if (current > options.limit) {
      return {
        success: false,
        remaining: 0,
        resetTime,
      }
    }

    return {
      success: true,
      remaining: Math.max(0, options.limit - current),
      resetTime,
    }
  } catch (error) {
    console.error('[v0] Rate limit error:', error)
    // Fail open - allow the request if Redis is unavailable
    return {
      success: true,
      remaining: options.limit,
      resetTime: Date.now() + options.window * 1000,
    }
  }
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
  return ip
}

export function createRateLimitKey(
  prefix: string,
  ip: string,
  identifier?: string
): string {
  return `ratelimit:${prefix}:${ip}${identifier ? `:${identifier}` : ''}`
}
