/**
 * Provider adapter — the swappable boundary.
 *
 * Everything above this file (index.ts) is provider-agnostic. To move off
 * Cloudflare Workers AI to Bedrock Nova, Gemini, or Anthropic, you only change
 * this file. The contract is fixed:
 *
 *   callModel(env, messages) -> ReadableStream of plain UTF-8 text deltas
 *
 * The rest of the app just pipes that stream to the client.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Only the bindings the adapter needs. Env (in index.ts) satisfies this. */
export interface ModelEnv {
  AI: Ai
}

// Cheap, fast, good enough for Q&A about a person. Swap for a bigger model
// (e.g. @cf/meta/llama-4-scout-17b-16e-instruct) if you want more polish.
const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast'

export async function callModel(
  env: ModelEnv,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  // `stream: true` resolves to a ReadableStream that Workers AI also makes
  // async-iterable, yielding already-parsed `{ response: "..." }` chunks —
  // see Cloudflare's own docs (workers-ai gotchas: "Stream returns
  // ReadableStream" / `for await (const chunk of stream) chunk.response`).
  // We used to instead treat this as raw SSE bytes and hand-parse
  // `data: {...}\n\n` lines ourselves; that manual byte/line buffering was
  // the likely source of silently dropped tokens (any parse hiccup on a
  // chunk-boundary split was swallowed). Consuming the async iterator
  // directly lets the runtime handle framing instead of us.
  const stream = await env.AI.run(MODEL, {
    messages,
    stream: true,
    max_tokens: 600,
  })
  // TS can't match our exact model string (with the `-fp8-fast` suffix)
  // against its known-model overloads, so it falls back to an untyped
  // `Record<string, unknown>` — cast through `unknown` to assert the actual
  // runtime shape (a Workers AI streaming ReadableStream is async-iterable).
  const chunks = stream as unknown as AsyncIterable<{ response?: string }>

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          if (typeof chunk?.response === 'string' && chunk.response.length > 0) {
            controller.enqueue(encoder.encode(chunk.response))
          }
        }
      } catch (err) {
        controller.error(err)
        return
      }
      controller.close()
    },
  })
}
