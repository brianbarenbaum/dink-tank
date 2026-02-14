# Vue Starter Readiness Checklist

Use this before starting feature work in a new repo created from this starter.

- `origin` points to your new repository (not the starter repository).
- `package.json` metadata is updated for your project.
- `.codex/AGENTS.md` reflects your architecture and review policy.
- `.codex/memories/` are pruned/extended for your project domain.
- `.codex/config.toml` MCP servers are configured and unnecessary entries removed.
- `.env.example` placeholders match your app runtime needs.
- `scripts/review-dispatch.sh` path mapping matches your file layout.
- CI workflow reflects your required verification gates.
- `npm run dev` launches successfully.
- `npm run typecheck`, `npm run test`, and `npm run review:dispatch` run successfully.
