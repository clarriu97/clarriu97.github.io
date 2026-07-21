/**
 * Guardrail Layer B — stops scripted abuse from exhausting the free model
 * quota or running up a bill. Two independent checks; both must pass:
 *
 *   1. Turnstile: proves the caller executed real browser JS and solved
 *      Cloudflare's challenge. Blocks curl/script traffic outright.
 *   2. Rate limit (KV): caps requests per IP even from a real browser, in
 *      case a token is reused or a human hammers the endpoint.
 */

export interface GuardrailEnv {
  RATE_LIMIT: KVNamespace
  TURNSTILE_SECRET_KEY?: string
}

const RATE_LIMIT_PER_MINUTE = 10
const RATE_LIMIT_PER_DAY = 50

export async function verifyTurnstile(secretKey: string, token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

/**
 * Fixed-window counters in KV. Not perfectly atomic (a concurrent get-then-put
 * race can under-count by a handful of requests), which is fine here — this
 * is an abuse backstop, not a billing meter.
 */
export async function checkRateLimit(env: GuardrailEnv, ip: string): Promise<boolean> {
  const now = new Date()
  const minuteBucket = Math.floor(now.getTime() / 60_000)
  const dayBucket = now.toISOString().slice(0, 10)
  const minuteKey = `rl:min:${ip}:${minuteBucket}`
  const dayKey = `rl:day:${ip}:${dayBucket}`

  const [minuteRaw, dayRaw] = await Promise.all([
    env.RATE_LIMIT.get(minuteKey),
    env.RATE_LIMIT.get(dayKey),
  ])
  const minuteCount = minuteRaw ? parseInt(minuteRaw, 10) : 0
  const dayCount = dayRaw ? parseInt(dayRaw, 10) : 0

  if (minuteCount >= RATE_LIMIT_PER_MINUTE || dayCount >= RATE_LIMIT_PER_DAY) {
    return false
  }

  await Promise.all([
    env.RATE_LIMIT.put(minuteKey, String(minuteCount + 1), { expirationTtl: 60 }),
    env.RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: 60 * 60 * 24 }),
  ])
  return true
}
