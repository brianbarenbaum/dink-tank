# Screenshot Verification (Playwright Web)

## Applies when
- Changing layout, styling, or visual UI behavior
- Modifying components/pages with design references or golden screenshots

## Output directory
Save verification images under `validation_screenshots/` at the project root.

## Required actions
- Capture screenshots after visual changes and compare with expected design.
- Use clear filenames that describe flow/route/checkpoint.
- Re-capture after adjustments when parity issues are found.

## Script pattern
- Use `PLAYWRIGHT_BASE_URL` (for example `http://localhost:5173`).
- Navigate to target routes, perform required interactions, and save to `validation_screenshots/<name>.png`.

## Command examples
```bash
PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test
```
