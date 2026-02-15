# codex-vue-starter

Starter repository for **Vite + Vue 3 + Tailwind 4 + shadcn-vue + Vitest + Playwright** projects with a Codex-first multi-agent workflow.

## Included

- `.codex/AGENTS.md` agent workflow, review gates, dispatch rules
- `.codex/skills/` stack-specific engineering guidance (Vue, Pinia, testing, UI, runtime verification)
- `.codex/prompt-templates/review/` reviewer prompt templates
- `.codex/config.toml` MCP config starter (Context7/Supabase)
- `scripts/review-dispatch.sh`, `scripts/review-run-all.sh` review automation
- Minimal runnable Vite + Vue app scaffold (`src/`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`)

## Bootstrap A New Project (Clone-Based)

This starter is meant to be cloned directly. Do **not** run `npm create vite@latest` after cloning.

1. Clone this repository into your new project folder.
2. Change `origin` to your own repo:
   - `git remote set-url origin <your-new-repo-url>`
3. Install dependencies:
   - `npm install`
4. Run setup helper:
   - `npm run setup`
5. Update project metadata/config:
   - `package.json` name/description/version
   - `.env.example` placeholders
   - `.codex/config.toml` MCP settings (for example Supabase project ref)
6. Initialize shadcn-vue in your app if needed:
   - `npx shadcn-vue@latest init`
7. Run verification gates:
   - `npm run format:check`
   - `npm run lint:check`
   - `npm run typecheck`
   - `npm run test`
   - `npm run test:coverage`
   - `npm run test:e2e`

## Common Commands

- `npm run dev` start Vite dev server
- `npm run build` build for production
- `npm run preview` preview production build
- `npm run review:dispatch` identify required reviewer agents from changed files
- `npm run review:base` run reviewer prompts against branch diff

## Notes

- Tailwind v4 is configured via `@tailwindcss/vite`; no `autoprefixer` dependency is required.
- Keep runtime artifacts out of git (`.codex/review-results`, generated prompts, Playwright/test artifacts).
- Keep secrets out of git; use environment variables.
- Apply `docs/security/web-baseline.md` before production deployment.
- Adapt `.codex/AGENTS.md` and relevant memories before heavy implementation.
- See `docs/template-customization-checklist.md` and `docs/checklists/` for project readiness checks.
- Chat frontend v1 contract and deferred roadmap: `docs/architecture/chat-frontend-v1.md`.
