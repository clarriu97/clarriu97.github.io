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
        } catch {
          // keep-alive / partial JSON — ignore
        }
      }
    },
  })
}
