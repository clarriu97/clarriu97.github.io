# larri.dev chat Worker

Backend for the "ask me about Carlos" chat on larri.dev. A single Cloudflare
Worker that injects the dossier, calls the model, and streams the reply back.
Stateless — the browser keeps the transcript (localStorage) and sends it each turn.

See [`../docs/conversational-agent.md`](../docs/conversational-agent.md) for the
architecture and the decisions behind it.

## Layout

- `src/index.ts` — request handler: CORS, validation, guardrails, streaming response.
- `src/knowledge.ts` — the dossier (what the bot knows) + system prompt / topic guardrail. **Edit this to change what the bot says.**
- `src/providers.ts` — the model adapter (the swappable boundary). Default: Cloudflare Workers AI + Llama 4 Scout 17B.
- `src/guardrails.ts` — Turnstile verification + per-IP KV rate limiting (abuse protection, see below).

## Deploy

Requires a (free) Cloudflare account. **One-time setup before the first deploy**
(both guardrails need a resource created outside `wrangler.toml`):

1. **KV namespace for rate limiting:**
   ```bash
   cd worker
   npm install
   npx wrangler login
   npx wrangler kv namespace create RATE_LIMIT
   ```
   Paste the returned `id` into `wrangler.toml`'s `[[kv_namespaces]]` block
   (replacing `REPLACE_WITH_KV_NAMESPACE_ID`).

2. **Turnstile widget (proves a caller is a real browser, not a script):**
   Cloudflare dashboard -> Turnstile -> Add site -> domain `larri.dev` (add
   `localhost` too if you want it to also fully verify in local dev, though the
   test keys below already work locally without this). You get a **Site Key**
   (public) and a **Secret Key** (private).
   - Site Key: update the fallback in `src/components/ChatAgent.astro`
     (`turnstileSiteKey`), or set `PUBLIC_TURNSTILE_SITE_KEY` when building the site.
   - Secret Key: add as a GitHub repo secret named `TURNSTILE_SECRET_KEY` — the
     deploy workflow pushes it to the Worker automatically.

   **Until you do this**, both sides default to Cloudflare's public test pair
   (site key `1x00000000000000000000AA`, secret `1x0000...AA`), which always
   passes verification. That keeps local dev working out of the box, but it
   means the Turnstile check is a no-op in production until you swap in real
   keys — the **rate limit still applies regardless** and is real protection
   even before you do this.

Then deploy:

```bash
npx wrangler deploy         # [ai] binding enables Workers AI, no API key needed
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

Create a `.dev.vars` file (gitignored) with a Turnstile secret so the
guardrail doesn't 500 locally:

```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

That's Cloudflare's public "always passes" test secret — pairs with the
default test site key already baked into `ChatAgent.astro`, so local
verification works without any real Turnstile setup. The `RATE_LIMIT` KV
binding is emulated locally by `wrangler dev` automatically, even before the
real namespace exists.

Note: the `[ai]` binding needs a real, authenticated connection even in local
dev (`wrangler login`) — Workers AI itself isn't emulated locally. Everything
before the model call (CORS, Turnstile, rate limiting) can be tested without it.

## Config

- `ALLOWED_ORIGINS` (in `wrangler.toml`) — comma-separated origins allowed to
  call the Worker (CORS). Add your production domain.
- `RATE_LIMIT` (KV namespace, in `wrangler.toml`) — per-IP request counters.
- `TURNSTILE_SECRET_KEY` (Worker secret, set via GitHub Actions or
  `wrangler secret put`) — verifies the Turnstile token sent by the client.

## Cost & limits

- Workers AI free allocation: 10,000 neurons/day. On Llama 4 Scout 17B
  (~850 neurons per typical 6-turn conversation), that's ~11 conversations/day
  free; beyond that, ~$0.011 / 1,000 neurons (still cents/day at realistic
  traffic). See the cost table in `docs/conversational-agent.md` §5.
- **Guardrails (both layers implemented):**
  - Layer A (scope): topic guardrail in the system prompt, max 20
    messages/turn, max 2,000 chars/message.
  - Layer B (abuse): Cloudflare Turnstile (blocks scripted/non-browser
    callers) + per-IP rate limit via KV — **4 requests/minute, 15/day**.
    Exceeding either returns 403 (failed verification) or 429 (rate limited).
    Deliberately tight relative to the free-tier math above: no site-wide
    daily cutoff exists, so the per-IP cap is the only thing standing between
    a handful of heavy individual users and exceeding the free tier — see
    `docs/known-limitations.md` for the site-wide-cap option that was
    considered and deliberately not built.
