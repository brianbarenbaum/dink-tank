# Screenshot Verification (Playwright)

## Applies when
- Changing layout/styling/visual UI behavior
- Modifying components/screens with design references or golden screenshots

## Priority
- This is the required verification step for UI visual changes.

Scope note: This file covers Playwright validation screenshots; OS-level screenshots must follow the superpowers `screenshot` skill.

## Output directory

All validation and checkpoint screenshots must be saved under **`validation_screenshots/`** at the project root, not in the repo root or in `scripts/`. Scripts should set the screenshot path to `path.join(process.cwd(), "validation_screenshots", "filename.png")`. This keeps the project root clean and groups all verification assets in one place.

## When to screenshot

- After layout/styling changes, take a screenshot and compare to design reference in `designs/` before marking done.
- If major diff, adjust spacing/colors and re-shoot.

## Feature checkpoint scripts

For feature work with multiple UI checkpoints, add a dedicated screenshot script per checkpoint (e.g. `scripts/screenshot-add-book-1.ts`, `-2.ts`, `-3.ts`) rather than overloading a single script. Each script should write its output into `validation_screenshots/` with a clear filename (e.g. `screenshot-add-book-checkpoint-1.png`).

**Pattern:** Set `PLAYWRIGHT_BASE_URL` (default e.g. `http://localhost:8081`), launch Chromium with a device (e.g. `devices["iPhone 14"]`), navigate to the route, perform any required interaction (e.g. fill search, wait for results), then take a screenshot to `validation_screenshots/<name>.png`. Compare to design references in `designs/` before marking the checkpoint done.

## Commands

```bash
PLAYWRIGHT_BASE_URL=http://localhost:808X npx tsx scripts/screenshot-iphone14.ts
```

For checkpoint scripts, use the same env and run the relevant script (e.g. `npx tsx scripts/screenshot-add-book-2.ts`).
