# AWS twin — larri.dev chat, AWS backend

Second backend for the chat, on Lambda + Bedrock, next to the existing Cloudflare Worker in [`../worker`](../worker). Built from the "AI in Production" course (Ed Donner), adapted to this repo's conventions.

Tracking issues: [#1 migration](https://github.com/clarriu97/clarriu97.github.io/issues/1), [#2 streaming follow-up](https://github.com/clarriu97/clarriu97.github.io/issues/2).

**Status:** scaffolding, nothing deployed yet. `worker/` stays live and unchanged during this build.

## Same contract as the Worker — that's the switch mechanism

`server/app/main.py` implements the exact same `POST /chat` contract as `worker/src/index.ts`: `{ messages, turnstileToken }` in, plain-text reply out, stateless (client keeps the transcript in localStorage, resends it each turn). No separate "switcher" needed — the frontend already reads its backend URL from `PUBLIC_CHAT_ENDPOINT` (`src/components/ChatAgent.astro`). Point it at the Worker's `*.workers.dev` URL or this API Gateway URL, nothing else changes.

## Layout

- `server/` — FastAPI app (`app/`) + Mangum Lambda handler (`handler.py`), managed with `uv` (`pyproject.toml` + `uv.lock`).
- `terraform/` — Lambda, API Gateway, DynamoDB (rate limit), IAM, CloudWatch alarms, SNS, AWS Budget. Single environment, no workspaces — this is a personal project, not a multi-tenant service.
- `scripts/sync-dossier.sh` and `scripts/build-lambda-package.sh` — see below.

## Knowledge source

The bot's dossier (`server/app/data/`) is **generated from career-ops**, committed to this repo, and consumed as-is by the Lambda build — never regenerated in CI, never hand-edited.

```bash
# 1. In career-ops, after updating cv.md / config/profile.yml:
node export-dossier.mjs --payload <payload.json>

# 2. Here, sync and commit:
./aws-bot/scripts/sync-dossier.sh /path/to/career-ops
git add aws-bot/server/app/data && git commit -m "sync dossier"
```

`export-dossier.mjs` enforces an allowlist (only public-safe fields) and a denylist (refuses to export anything that looks like compensation, negotiation, or PII) — that's what makes it safe to commit publicly.

## Local dev

```bash
cd aws-bot/server
uv sync
uv run uvicorn app.main:app --reload
```

No AWS resources needed to run locally — Turnstile verification and the rate limiter will just fail closed (403/429) unless `TURNSTILE_SECRET_KEY` and `RATE_LIMIT_TABLE` are set. Bedrock calls need real AWS credentials either way (`AWS_PROFILE=...`).

## Deploy

Not wired up yet — needs a one-time bootstrap first (OIDC IAM role for GitHub Actions, S3 + DynamoDB for Terraform state). Tracked in issue #1.

```bash
./aws-bot/scripts/build-lambda-package.sh arm64   # cross-compiles for Lambda, not your Mac
cd aws-bot/terraform
terraform apply -var="alert_email=you@example.com" -var="turnstile_secret_key=..."
```

CI (`deploy-aws-bot.yml`) does the same on every push to `master` that touches `aws-bot/**`, behind a GitHub Environment approval gate.

## Observability & cost control

Out of the box:

- **CloudWatch alarms** (Lambda errors, throttles, p90 duration near timeout, Bedrock invocation spikes) → one SNS topic → your email.
- **AWS Budget**, monthly (`var.monthly_budget_usd`, default $10), alerts at 50% actual / 100% actual / 100% forecasted.
- **API Gateway throttling** (10 req/s, burst 20) as a hard backstop, independent of the app-level rate limiter.
- **X-Ray active tracing**, with boto3 patched (`handler.py`) — Bedrock and DynamoDB calls show as separate subsegments, not one opaque duration.
- **Log retention** set explicitly (30 days default) — unset, Lambda's log group keeps logs forever.

All in `terraform/observability.tf`.

## Known footguns

- **Cross-compilation.** `build-lambda-package.sh` always builds for Lambda's Linux platform, never your Mac's — `pydantic-core` has compiled extensions that silently produce a broken Lambda if you `pip install` normally on Apple Silicon.
- **No streaming.** Lambda behind API Gateway can't stream the response (worse UX than `worker/`, which does). Tracked in issue #2 — needs a Lambda Function URL with `RESPONSE_STREAM`.
- **Bedrock model access + inference profiles.** Requesting model access in the console isn't enough — many models now need a region-prefixed model ID (`eu.amazon.nova-lite-v1:0`), not the bare model ID.
