**When:** Before marking a task complete, whenever you made any code or config changes (source files, dependencies, app entry, routing, Metro/Babel/Expo config, etc.).

If the superpowers `verification-before-completion` skill applies, follow it first and treat this file as project-specific addenda.

Run the app only if not already running:

- Check the terminals folder (or existing terminal output) for an already running dev server (e.g. expo start, npm run web, Metro bundler). If the app is already running, do not start a second instance; use the existing run to verify.
- If no dev server is running, start the app (e.g. npm run web or npx expo start --web, or npm run verify:start if present).

**What to do:**

- Ensure the app is running (start it only if needed, as above).
- Watch the terminal output and/or browser console for any runtime errors, including but not limited to:
  - Module resolution: "Unable to resolve", "Module not found", "Cannot find module"
  - Build/bundling: Metro or Webpack errors, syntax errors, transform errors
  - Runtime: uncaught exceptions, "TypeError", "ReferenceError", "undefined is not a function", red-screen errors, React render errors, and any stack traces or error messages in the console or terminal

If any such error appears, treat the task as not complete: fix the cause (e.g. install missing deps with npx expo install <pkg> for Expo packages, fix config or code), then re-check (reload or re-run) until the app runs without those errors.

Run npm test if the task touched code that has tests.

Run `npx tsc --noEmit` after code changes and fix any type errors before marking complete.

When implementing work from a plan that has existing todos, update todo status as you go (e.g. set the current task to in_progress when starting, then to completed when done) and do not recreate the same todos.

**Scope:** Prefer web for speed (npm run web); use iOS/Android only when the task is mobile-specific.
