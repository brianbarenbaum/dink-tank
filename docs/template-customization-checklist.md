# Template Customization Checklist

Before starting feature work in a cloned project:

1. Repoint git `origin` to your own repository.
2. Update `package.json` project metadata.
3. Update `.codex/AGENTS.md` for your architecture, verification gates, and reviewer mapping.
4. Prune/adjust `.codex/skills/*.md` to match your app domain.
5. Update `.codex/config.toml`:
   - set Supabase `project_ref` if used
   - remove MCP servers you do not use
6. Validate stack/tooling config is aligned:
   - `vite.config.*`
   - `components.json` (if using shadcn-vue)
   - `vitest.config.*`
   - `playwright.config.*`
7. Verify review script path mapping fits your file layout (`scripts/review-dispatch.sh`).
8. Confirm CI in `.github/workflows/verify.yml` runs your required verification commands.
