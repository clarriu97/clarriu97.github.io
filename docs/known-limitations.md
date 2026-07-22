# Conversational Agent — Known Limitations & Future Work

Backlog of problems found in the chat agent, and what's been done about them.
See [`conversational-agent.md`](./conversational-agent.md) for the
architecture these all sit on top of.

Each entry can still be copy-pasted into a GitHub issue if you want to track
it there. Not auto-created as GitHub issues from this session because the
machine's `gh` CLI is authenticated as a different (work) account — issues
would have shown up publicly as opened by the wrong identity.

---

## 1. Poor / non-clickable references (links, repos, blog posts)

**Status: fix applied, verify link accuracy against real production traffic
over time.**

**Symptom:** when the bot mentions a project or link, it comes out as plain
text, not a clickable link — e.g. asked "what projects has Carlos built?" in
production, it replied with lines like:

> Vericlient, a Python client-integration interface for Veridas APIs... You
> can find it on GitHub: **github.com/clarriu/vericlient**.

Two problems in that one sentence: the URL rendered as plain text (see #2),
and the username was **wrong** (`clarriu` instead of `clarriu97`) — the model
was paraphrasing the link from prose instead of quoting a fixed source.

**Root cause:** [`worker/src/knowledge.ts`](../worker/src/knowledge.ts)'s
`DOSSIER` mentioned URLs inline as bare text (e.g. "github.com/clarriu97/...",
no protocol, no markdown syntax), with no instruction to reproduce them
verbatim. The model was reconstructing them from memory of the prose.

**Fix applied:**
- Every link in the dossier is now pre-formatted as a complete markdown link
  — `[label](https://...)` — co-located with the project it belongs to (in
  the Projects section) and consolidated again in the Contact & links
  section, so the model has a literal string to copy rather than something to
  reconstruct.
- Added an explicit system-prompt rule (`buildSystemPrompt()`): copy dossier
  links character-for-character, never retype/guess/alter a URL, and don't
  invent a link for anything the dossier doesn't have one for.
- Depended on #2 landing first (a correct markdown link is useless if the
  widget shows it as literal `[text](url)`) — both shipped together.

**Not fully closed:** this makes the wrong-username failure mode much less
likely (the model now has an exact string to copy instead of reconstructing
one), but an LLM copying text isn't a 100% guarantee the way a template
substitution would be. Worth spot-checking occasionally against real
questions, and worth extending the dossier's link coverage once the blog
ships (currently stashed, not live).

---

## 2. Markdown isn't rendered — literal `**`, `-`, `[]()` show up

**Status: fixed and verified locally (including an XSS check).**

**Symptom:** the model's markdown-formatted output (bold, bullet lists,
links) displayed as raw text in the widget — literal `- ` prefixes, literal
asterisks, literal `[text](url)`.

**Root cause:**
[`src/components/ChatAgent.astro`](../src/components/ChatAgent.astro) set
`replyEl.textContent = acc`, which never interprets markdown.

**Fix applied:**
- Added a small, purpose-built markdown renderer (`escapeHtml` /
  `renderInline` / `renderMarkdown` in `ChatAgent.astro`) — handles exactly
  what the model produces: **bold**, `[text](url)` links (http/https only,
  no `javascript:`/`data:` schemes), and `- `/`* ` bullet lists.
- **HTML-escapes the raw text first**, before any tag construction, so the
  model's output can never inject real HTML/script into the page even though
  it's rendered via `innerHTML` — verified by feeding a fake response
  containing `<script>alert(1)</script>` and an `onerror` payload through the
  real widget: both rendered as inert escaped text, nothing executed.
- Assistant replies render through this pipeline; **user messages stay plain
  `textContent`** (what a visitor types is never interpreted as markdown).
- Added CSS for the real `<p>`/`<ul>`/`<li>`/`<a>`/`<strong>` elements this
  now produces, and scoped the old `white-space: pre-wrap` rule to user
  bubbles only (it was written for a single plain-text node, not real markup).

**Verified locally** with a stubbed streaming response containing bold, a
link list, and an injection attempt — all rendered correctly, escaping held.
Not yet re-checked against real, live model output in production (do that
after deploying, alongside #1 and #3).

---

## 3. Numeric substrings silently dropped mid-response (not a clean truncation)

**Status: fix applied (root cause found), pending production verification —
could not test locally (Workers AI needs `wrangler dev --remote`, which needs
Cloudflare login this session doesn't have).**

**Symptom:** initially reported as "runs out of tokens / response stays
half-done." Reproduced in production — the response completed cleanly (full,
well-formed final sentence), but specific number-shaped substrings vanished:

> "...with **+** years of experience..." (should be "5+ years")
> "...he **shipped +** features..." (should be "shipped 80+ features")
> "...improved AI inference performance by **%**..." (should be "by 60%")

**Root cause, found:**
[`worker/src/providers.ts`](../worker/src/providers.ts) was treating the
Workers AI stream as raw SSE bytes and hand-parsing `data: {...}\n\n` lines
byte-by-byte (buffering on `\n`, `JSON.parse`-ing each line, **silently
swallowing any parse failure**). Checking Cloudflare's own Workers AI
documentation (gotchas/patterns references) showed this was unnecessary and
wrong: `env.AI.run(model, { stream: true })` returns a `ReadableStream` that
Workers AI *also* makes async-iterable, yielding **already-parsed**
`{ response: string }` chunks directly —

```typescript
const stream = await env.AI.run(model, { messages, stream: true });
for await (const chunk of stream) { console.log(chunk.response); }
```

— so the hand-rolled byte/line parser was reinventing something Cloudflare's
runtime already does correctly, and any edge case in that manual buffering
(a chunk boundary splitting a `data:` line awkwardly) silently dropped the
fragment with no logging. This lines up exactly with the symptom: short
tokens (a model tokenizes "5" and "+" separately) vanishing without a trace.

**Fix applied:** rewrote `callModel()` to consume the async iterator directly
(`for await (const chunk of chunks)`) and re-encode `chunk.response` as plain
UTF-8 text ourselves — no manual SSE/JSON parsing left at all. Typechecks
clean; the exact model string isn't in the type catalog (has the
`-fp8-fast` suffix), so TypeScript falls back to `Record<string, unknown>`
for `env.AI.run()`'s return — cast through `unknown` to assert the real
runtime shape, same pattern as before, now for the correct shape.

**Separately, and still unresolved:** `max_tokens: 600` is a real, separate
ceiling — worth revisiting (maybe 1000–1200) once real conversation costs are
observed (see cost table in `conversational-agent.md` §5). Not touched in
this pass; low priority next to the data-loss fix.

**Verification gap — do this once deployed:** this repo's `wrangler dev`
can't reach Workers AI without `--remote` and a Cloudflare login neither this
machine nor this session has. The fix is typechecked and the reasoning holds
up against Cloudflare's own documented behavior, but **re-run the original
repro prompt against production** ("Can you summarize Carlos's CV?" — the
same one that first surfaced the missing "5+", "80+", "60%") and confirm the
numbers survive before considering this fully closed.

---

## Suggested next step

All three have fixes applied and are ready to deploy together. After
deploying: re-run the CV-summary repro prompt (closes the loop on #3), ask a
projects question and check the links render as real, correct, clickable
`<a>` tags (closes the loop on #1 and #2 together).
