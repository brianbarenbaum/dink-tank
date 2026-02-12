# codex-expo-starter

Template repository for new Expo projects that should start with a Codex-first agent engineering workflow.

## Included

- `.codex/AGENTS.md` multi-agent review workflow and verification gates
- `.codex/memories/` reusable engineering standards
- `.codex/prompt-templates/review/` reusable reviewer prompts
- `.codex/config.toml` MCP server config template
- `mcp-servers/` local MCP wrappers and Gluestack MCP server source
- `scripts/review-dispatch.sh` and `scripts/review-run-all.sh` automation

## Quick start

1. Create a new repo from this template.
2. Run setup:
   - `npm run setup`
3. Configure MCPs:
   - update `.codex/config.toml` (especially Supabase `project_ref`)
4. Add secrets/env vars:
   - copy `.env.example` values into your local env
5. Run reviews:
   - `npm run review:dispatch`
   - `npm run review:base`

## Notes

- Keep runtime artifacts out of git (`.codex/review-results`, generated prompts).
- Keep secrets out of git; use env vars.
- Adapt `.codex/AGENTS.md` and memories per project before heavy implementation.
