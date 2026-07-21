# larri.dev chat Worker

Backend for the "ask me about Carlos" chat on larri.dev. A single Cloudflare
Worker that injects the dossier, calls the model, and streams the reply back.
Stateless — the browser keeps the transcript (localStorage) and sends it each turn.

See [`../docs/conversational-agent.md`](../docs/conversational-agent.md) for the
architecture and the decisions behind it.

## Layout

- `src/index.ts` — request handler: CORS, validation, streaming response.
- `src/knowledge.ts` — the dossier (what the bot knows) + system prompt / guardrails. **Edit this to change what the bot says.**
- `src/providers.ts` — the model adapter (the swappable boundary). Default: Cloudflare Workers AI + Llama 3.1 8B.

## Deploy

Requires a (free) Cloudflare account.

```bash
cd worker
npm install
npx wrangler login          # opens the browser, authorizes your Cloudflare account
npx wrangler deploy         # deploys the Worker; the [ai] binding enables Workers AI
```

After the first deploy you get a `*.workers.dev` URL. Test it:

```bash
curl -N -X POST https://larri-chat.<your-subdomain>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:4321" \
  -d '{"messages":[{"role":"user","content":"What does Carlos do?"}]}'
```

You should see the answer stream in as plain text.

## Custom domain (optional)

To serve it at `chat.larri.dev`: Cloudflare dashboard -> Workers & Pages ->
`larri-chat` -> Settings -> Domains & Routes -> add `chat.larri.dev`. Then point
the frontend widget at that URL.

## Local dev

```bash
npx wrangler dev
```

Note: Workers AI runs on Cloudflare's servers even in local dev, so `wrangler dev`
still needs you to be logged in (`wrangler login`).

## Config

- `ALLOWED_ORIGINS` (in `wrangler.toml`) — comma-separated origins allowed to
  call the Worker (CORS). Add your production domain.

## Cost & limits

- Workers AI free allocation: 10,000 neurons/day (~50+ conversations/day on the
  default model). Beyond that, ~$0.011 / 1,000 neurons.
- Current guardrails: topic scope (system prompt), max 20 messages/turn, max
  2,000 chars/message.
- **Phase 2 (before going public / heavy traffic):** Cloudflare Turnstile
  (bot protection) + KV rate-limiting per IP. Not in this MVP yet.
