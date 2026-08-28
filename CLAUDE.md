# House rules — clarriu97.github.io

## Writing (issues, PRs, docs, commit messages)

No manual line wrapping inside a paragraph. Each paragraph is one unbroken line in the source; let the renderer wrap it. A stray `\n` mid-sentence in a GitHub issue/PR body renders as a visible line break — GitHub uses hard breaks on user content, unlike most Markdown.

## Python

Every Python project uses `uv` — `pyproject.toml` + `uv.lock`, never a hand-written `requirements.txt`. `uv add <pkg>` to add a dependency, `uv sync` to install, `uv run <cmd>` to execute inside the project's venv.

## aws-bot/ specifics

- `server/app/data/` (the knowledge dossier) is **committed**, not gitignored — it's the public-safe output of career-ops' `export-dossier.mjs` allowlist/denylist, and production has no other way to get it (CI never has access to `cv.md`, which never leaves the user's machine). After changing the CV in career-ops: regenerate, run `scripts/sync-dossier.sh`, commit the diff.
- Always cross-compile for Lambda via `scripts/build-lambda-package.sh` — never `pip install` directly on this Mac for a Lambda package (Apple Silicon wheels silently break on Lambda's Linux runtime).
- Terraform: `terraform fmt` before committing; `terraform validate` should pass (a missing `build/lambda-package.zip` is the one expected failure before a build has run).
- New AWS resources in `aws-bot/terraform/` must come with: an entry in `observability.tf` if failure is possible (CloudWatch alarm → the existing SNS topic), and cost awareness (tagged so the AWS Budget filter catches it, or a note in the README if it's free-tier-only).
- Single environment, no Terraform workspaces — this is a personal project, not something that needs dev/test/prod parity. Don't reintroduce multi-env machinery without a real reason.
