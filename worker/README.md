# larri.dev chat Worker

Backend for the "ask me about Carlos" chat on larri.dev. A single Cloudflare
Worker that injects the dossier, calls the model, and streams the reply back.
Stateless — the browser keeps the transcript (localStorage) and sends it each turn.

See [`../docs/conversational-agent.md`](../docs/conversational-agent.md) for the
architecture and the decisions behind it.

## Layout

- `src/index.ts` — request handler: CORS, validation, guardrails, streaming response.
- `src/knowledge.ts` — the dossier (what the bot knows) + system prompt / topic guardrail. **Edit this to change what the bot says.**
- `src/providers.ts` — the model adapter (the swappable boundary). Default: OpenAI API, `gpt-4.1-mini`.
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

2. **OpenAI API key:** get one at
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Add
   it as a GitHub repo secret named `OPENAI_API_KEY` — the deploy workflow
   pushes it to the Worker automatically — or push it manually with
   `npx wrangler secret put OPENAI_API_KEY`.

3. **Turnstile widget (proves a caller is a real browser, not a script):**
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
npx wrangler deploy
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

Create a `.dev.vars` file (gitignored) with a Turnstile secret and a real
OpenAI API key:

```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
OPENAI_API_KEY=sk-...
```

The Turnstile line is Cloudflare's public "always passes" test secret — pairs
with the default test site key already baked into `ChatAgent.astro`, so local
verification works without any real Turnstile setup. The `RATE_LIMIT` KV
binding is emulated locally by `wrangler dev` automatically, even before the
real namespace exists.

Note: `OPENAI_API_KEY` needs to be a real key even in local dev — OpenAI
calls aren't emulated. Everything before the model call (CORS, Turnstile,
rate limiting) can be tested without it.

## Config

- `ALLOWED_ORIGINS` (in `wrangler.toml`) — comma-separated origins allowed to
  call the Worker (CORS). Add your production domain.
- `RATE_LIMIT` (KV namespace, in `wrangler.toml`) — per-IP request counters.
- `TURNSTILE_SECRET_KEY` (Worker secret, set via GitHub Actions or
  `wrangler secret put`) — verifies the Turnstile token sent by the client.
- `OPENAI_API_KEY` (Worker secret, set via GitHub Actions or
  `wrangler secret put`) — authenticates calls to the OpenAI API.

## Cost & limits

- OpenAI has no free tier — `gpt-4.1-mini` is billed per token
  (see [openai.com/api/pricing](https://openai.com/api/pricing)). At the
  guardrail caps below (4 req/min, 15 req/day per IP) and typical short
  conversations, expect low cents/day at realistic traffic, but this is a
  real variable cost from the first request, unlike the previous Workers AI
  free allocation — see the cost table in `docs/conversational-agent.md` §5
  (written for Workers AI; treat the "$0/month" framing there as no longer
  accurate for the model call itself).
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
