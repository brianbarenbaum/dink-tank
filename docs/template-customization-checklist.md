# Template Customization Checklist

Before starting a new project from this template:

1. Update `.codex/AGENTS.md` for your architecture, verification gates, and reviewer mapping.
2. Prune/adjust `.codex/memories/*.md` to match your app domain.
3. Update `.codex/config.toml`:
   - set Supabase `project_ref` if used
   - remove MCP servers you do not use
4. Validate stack/tooling config is aligned:
   - `vite.config.*`
   - `tailwind.config.*`
   - `components.json` (if using shadcn-vue)
   - `vitest.config.*`
   - `playwright.config.*`
5. Verify review script path mapping fits your file layout (`scripts/review-dispatch.sh`).
6. Confirm CI in `.github/workflows/verify.yml` runs your required verification commands.
