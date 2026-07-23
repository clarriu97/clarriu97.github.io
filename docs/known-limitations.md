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

**Status: prompt-based fix confirmed NOT sufficient on its own; patched with
a deterministic client-side correction + upgraded the model. Verify all
three together against real production traffic.**

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

**Turned out not to be enough:** re-tested against production with the exact
same "what projects has Carlos built" question — **same exact failure**,
`clarriu` instead of `clarriu97`, twice, despite the verbatim markdown link
and the explicit "copy exactly" instruction. Llama 3.1 8B just isn't a
reliable verbatim-copy machine for an unusual token sequence embedded in
longer generated text, no matter how the prompt is worded — this is a model
capability limit, not a prompt-wording problem.

**Two more fixes layered on top:**
- **Deterministic client-side correction**
  ([`src/components/ChatAgent.astro`](../src/components/ChatAgent.astro),
  `fixKnownLinks()`): a targeted regex patches the one specific, recurring
  failure — `clarriu/` (missing the "97") becomes `clarriu97/` — applied to
  the raw model output before markdown rendering. Verified locally: fixes the
  broken pattern, leaves an already-correct `clarriu97/` untouched (negative
  lookahead), doesn't affect anything else in the text.
- **Model upgrade** to `llama-4-scout-17b-16e-instruct` (see
  `conversational-agent.md` §5) — better instruction-following in general,
  which should reduce (though not provably eliminate) this class of failure
  across the board, not just for this one URL.

**Still not "fully closed" in the sense of a guarantee:** the regex only
covers the one specific pattern we've actually observed failing. If the model
mangles a *different* link in some other way, this fix won't catch it. The
model upgrade is the more general mitigation; the regex is a targeted
backstop for the one confirmed recurring case. Worth extending the dossier's
link coverage once the blog ships (currently stashed, not live), and worth
spot-checking other links (LinkedIn, portfolio) occasionally.

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

**Status: still open. The first fix attempt was wrong and caused a full
outage — reverted. Diagnostic logging added; root cause not actually
confirmed yet.**

**Symptom:** initially reported as "runs out of tokens / response stays
half-done." Reproduced in production — the response completed cleanly (full,
well-formed final sentence), but specific number-shaped substrings vanished:

> "...with **+** years of experience..." (should be "5+ years")
> "...he **shipped +** features..." (should be "shipped 80+ features")
> "...improved AI inference performance by **%**..." (should be "by 60%")

**First attempt (reverted — broke everything):**
[`worker/src/providers.ts`](../worker/src/providers.ts) was treating the
Workers AI stream as raw SSE bytes and hand-parsing `data: {...}\n\n` lines
byte-by-byte, silently swallowing any `JSON.parse` failure. Cloudflare's own
Workers AI documentation (gotchas/patterns references) describes the stream
as async-iterable, yielding already-parsed `{ response: string }` chunks
directly:

```typescript
const stream = await env.AI.run(model, { messages, stream: true });
for await (const chunk of stream) { console.log(chunk.response); }
```

Rewrote `callModel()` to consume it that way instead (`for await (const
chunk of chunks)`, re-encoding `chunk.response`) — typechecked clean, reasoning
matched the docs. **Deployed, and broke the chat entirely**: every request
returned a real `200 OK` with a **completely empty body** (confirmed by
instrumenting `fetch` in a fresh, unpolluted browser tab against production
— zero chunks, no error, stream just closed immediately). Whatever `stream`
actually is at runtime for this model, iterating it with `for await` drained
successfully but yielded nothing usable — the documented behavior didn't
hold here, and we don't yet know why (different behavior for the
`-fp8-fast` model suffix? a workerd/runtime version difference? doc
describing a different call shape?).

**Reverted to the original byte-parsing approach** — confirmed working again
against production. Added logging in place of the silent `catch` (and a
`flush()` check for unconsumed buffer at stream end), so if the missing-digit
symptom recurs, the exact malformed payload will show up in the Cloudflare
dashboard (Workers & Pages → `larri-chat` → Logs) instead of vanishing
without a trace.

**Actual status:** back to the original (still-buggy-in-some-edge-case, but
*working*) implementation. The digit-dropping bug is **not fixed** — only
better instrumented. Next time it's reproduced, check the Worker's dashboard
logs for a `sseToText: failed to parse` or `unconsumed buffer` entry before
attempting another fix; don't repeat the mistake of changing the parsing
strategy based on documentation alone without confirming the actual runtime
shape first (e.g. temporarily return the raw undecoded stream and inspect it
directly, the way we eventually did to catch this regression).

**Separately, and still unresolved:** `max_tokens: 600` is a real, separate
ceiling — worth revisiting (maybe 1000–1200) once real conversation costs are
observed (see cost table in `conversational-agent.md` §5).

---

## 4. Turnstile wait timeout too short — chat looked broken when a checkbox appeared

**Status: fixed and verified.**

**Symptom:** after deploying phase 2 (Turnstile), the chat appeared to not
respond at all — every message came back with the generic "Sorry, I couldn't
reach the assistant" fallback. Reported with a screenshot showing a real,
unchecked Turnstile checkbox still sitting at the bottom of the panel.

**Root cause:**
[`src/components/ChatAgent.astro`](../src/components/ChatAgent.astro)'s
`getTurnstileToken()` only waited **5 seconds** for the widget to produce a
token before giving up and sending the request without one (guaranteed `403`
from the server). Managed mode auto-passes most visitors near-instantly, but
sometimes decides a visitor needs an interactive checkbox — and a human
needs real time to notice a checkbox that just silently appeared at the
bottom of a chat panel and click it. 5 seconds isn't enough, and there was no
indication to the user that anything needed their attention.

**Fix applied:**
- Raised the wait to 60 seconds.
- Added a visible in-chat message if no token arrives within 1.5s: "One
  moment — verifying you're not a bot. If you see a checkbox appear below, go
  ahead and check it." — instead of silence followed by a confusing failure.
- Added a distinct, clearer failure message if verification genuinely never
  completes ("I couldn't verify you're not a bot. Try again in a moment, or
  reload the page.") instead of the generic network-error message, and
  confirmed the send button correctly re-enables so the visitor isn't stuck.

**Verified** by stubbing a fake Turnstile widget with an artificially delayed
callback: confirmed the hint appears, the wait doesn't give up early, and a
genuine timeout (no token ever arrives) recovers cleanly with a clear message
and a working retry.

**Not addressed — separate, optional ask:** the checkbox itself is a bit of
friction when it does appear ("un poco incómodo"). The Turnstile widget is
currently in **Managed** mode (Cloudflare's recommended default), which
sometimes shows an interactive checkbox to visitors it flags as risky.
Switching the widget to **Non-Interactive** mode (Cloudflare dashboard →
Turnstile → the widget → mode) would show a small loading-spinner widget
instead but never require a click — a code-free, dashboard-only change, not
done here since it's a preference call, not a bug.

---

## Suggested next step

#1 and #2 (links, markdown rendering) have fixes applied and deployed. #3
(dropped digits) is genuinely still open — only better instrumented; don't
attempt another fix without first confirming the actual failure via the new
logging. #4 (Turnstile timeout) is fixed and verified. After any future
deploy touching the chat: ask a projects question and check links render as
real clickable `<a>` tags (closes the loop on #1 and #2 together if not
already confirmed).
