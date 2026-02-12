# Template Customization Checklist

Before starting a new project from this template:

1. Update `.codex/AGENTS.md` for project-specific architecture and verification commands.
2. Prune/adjust `.codex/memories/*.md` to match your stack.
3. Update `.codex/config.toml`:
   - set Supabase `project_ref`
   - remove MCP servers you do not use
4. Validate local MCP servers run:
   - `node mcp-servers/open-library-wrapper.mjs`
   - `node mcp-servers/gluestack-mcp/index.js`
5. Verify review scripts map to your file layout (`scripts/review-dispatch.sh`).
6. Add CI in `.github/workflows/verify.yml` for your final verification gates.
