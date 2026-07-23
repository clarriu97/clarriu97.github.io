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
 *
 * NOTE ON STREAM SHAPE: Cloudflare's own docs suggest `env.AI.run(model,
 * {stream:true})` is async-iterable and yields parsed `{response}` objects
 * directly (`for await (const chunk of stream) chunk.response`). We tried
 * that (consuming it as an async iterator, no manual SSE parsing) and it
 * broke completely in production — the loop completed with zero chunks and
 * no error, meaning whatever we got back was NOT yielding `{response}`
 * objects the way the docs describe, at least not for this model/setup.
 * Reverted to treating it as a raw byte ReadableStream of SSE frames
 * (`data: {"response":"..."}\n\n`), which is what actually works here.
 * See docs/known-limitations.md #3 for the still-open, separate bug (some
 * numeric substrings occasionally missing) — the logging added below is
 * meant to catch a real failing payload next time it happens, rather than
 * changing the parsing strategy again without evidence.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Only the bindings the adapter needs. Env (in index.ts) satisfies this. */
export interface ModelEnv {
  AI: Ai
}

// Upgraded from llama-3.1-8b-instruct-fp8-fast: the 8B model reliably failed
// to copy dossier URLs verbatim (e.g. "clarriu97" -> "clarriu" — see
// docs/known-limitations.md #1), even with explicit "copy this exactly"
// instructions. Scout follows instructions more reliably at ~5x the neuron
// cost — still cheap, see the cost table in docs/conversational-agent.md §5.
const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

export async function callModel(
  env: ModelEnv,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  // `stream: true` returns an SSE ReadableStream, but the binding's types infer
  // the non-streaming response shape, so cast through `unknown`.
  const aiStream = (await env.AI.run(MODEL, {
    messages,
    stream: true,
    max_tokens: 600,
  })) as unknown as ReadableStream<Uint8Array>

  // Workers AI streams SSE (`data: {"response":"..."}`). Normalize to plain text
  // deltas so the client contract is provider-independent.
  return aiStream.pipeThrough(sseToText())
}

function sseToText(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // keep the (possibly partial) last line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '' || data === '[DONE]') continue
        try {
          const json = JSON.parse(data) as { response?: string }
          if (typeof json.response === 'string' && json.response.length > 0) {
            controller.enqueue(encoder.encode(json.response))
          }
        } catch (err) {
          // Log instead of silently swallowing — if a chunk-boundary split
          // ever produces unparseable JSON (the leading suspect for #3's
          // dropped digits), this shows up in the Cloudflare dashboard's
          // Worker Logs (Workers & Pages -> larri-chat -> Logs), viewable
          // without wrangler CLI access, with the exact malformed payload.
          console.error('sseToText: failed to parse SSE data line', { data, err: String(err) })
        }
      }
    },
    flush(controller) {
      // Anything left in `buffer` when the stream ends is either a
      // keep-alive fragment or a genuinely truncated final line — log it so
      // we can tell which, instead of silently discarding it.
      if (buffer.trim()) {
        console.error('sseToText: unconsumed buffer at stream end', { buffer })
      }
    },
  })
}
