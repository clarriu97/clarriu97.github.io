/**
 * larri.dev chat Worker.
 *
 * Contract:
 *   POST /chat  { messages: [{ role: 'user' | 'assistant', content: string }] }
 *   -> streamed plain-text response (the assistant's reply, token by token)
 *
 * The client keeps the transcript (localStorage) and sends it each turn. The
 * Worker is stateless: it prepends the system prompt, calls the model, streams
 * back. No storage, no sessions.
 */
import { buildSystemPrompt } from './knowledge'
import { callModel, type ChatMessage, type ModelEnv } from './providers'

export interface Env extends ModelEnv {
  // Comma-separated list of origins allowed to call this Worker.
  ALLOWED_ORIGINS?: string
}

// Guardrail Layer B (cheap caps). Turnstile + KV rate-limiting = phase 2.
const MAX_MESSAGES = 20 // only the most recent turns are used
const MAX_CHARS_PER_MESSAGE = 2000

const DEFAULT_ORIGINS = ['https://larri.dev', 'http://localhost:4321']

function allowedOrigin(env: Env, origin: string | null): string | null {
  if (!origin) return null
  const allowed = (env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? DEFAULT_ORIGINS)
  return allowed.includes(origin) ? origin : null
}

function corsHeaders(origin: string | null): HeadersInit {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin) h['Access-Control-Allow-Origin'] = origin
  return h
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(env, request.headers.get('Origin'))

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin)
    }
    // Reject cross-origin callers we don't recognize.
    if (request.headers.get('Origin') && !origin) {
      return json({ error: 'Origin not allowed' }, 403, null)
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400, origin)
    }

    const incoming = (payload as { messages?: unknown })?.messages
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return json({ error: 'Body must be { messages: [...] }' }, 400, origin)
    }

    // Validate + sanitize. Keep only user/assistant turns, cap size and count.
    const clean: ChatMessage[] = []
    for (const m of incoming as Array<{ role?: unknown; content?: unknown }>) {
      if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        return json({ error: 'Each message needs role user|assistant and string content' }, 400, origin)
      }
      const content = m.content.slice(0, MAX_CHARS_PER_MESSAGE).trim()
      if (content) clean.push({ role: m.role, content })
    }
    if (clean.length === 0) {
      return json({ error: 'No usable messages' }, 400, origin)
    }
    const trimmed = clean.slice(-MAX_MESSAGES)

    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...trimmed,
    ]

    try {
      const stream = await callModel(env, messages)
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          ...corsHeaders(origin),
        },
      })
    } catch (err) {
      console.error('model error', err)
      return json({ error: 'Model call failed' }, 502, origin)
    }
  },
}
