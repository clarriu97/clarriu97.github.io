/**
 * Provider adapter — the swappable boundary.
 *
 * Everything above this file (index.ts) is provider-agnostic. To move off
 * the OpenAI API to Bedrock Nova, Gemini, or Anthropic, you only change
 * this file. The contract is fixed:
 *
 *   callModel(env, messages) -> ReadableStream of plain UTF-8 text deltas
 *
 * The rest of the app just pipes that stream to the client.
 *
 * Previously ran on Cloudflare Workers AI (Llama 4 Scout) via the native
 * `env.AI` binding. Switched to OpenAI while Bedrock model access is stuck
 * in an AWS account eligibility review with no ETA — see aws-bot/README.md.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Only the bindings the adapter needs. Env (in index.ts) satisfies this. */
export interface ModelEnv {
  OPENAI_API_KEY: string
}

const MODEL = 'gpt-4.1-mini'

export async function callModel(
  env: ModelEnv,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: 600,
    }),
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI request failed: ${res.status} ${detail}`)
  }

  // OpenAI streams SSE (`data: {"choices":[{"delta":{"content":"..."}}]}`,
  // terminated by `data: [DONE]`). Normalize to plain text deltas so the
  // client contract is provider-independent.
  return res.body.pipeThrough(sseToText())
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
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const delta = json.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            controller.enqueue(encoder.encode(delta))
          }
        } catch (err) {
          // Log instead of silently swallowing — a chunk-boundary split
          // producing unparseable JSON would otherwise fail invisibly.
          // Viewable in the Cloudflare dashboard (Workers & Pages ->
          // larri-chat -> Logs) without wrangler CLI access.
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
