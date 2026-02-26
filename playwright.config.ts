import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "e2e",
	timeout: 30_000,
	webServer: {
		command:
			"VITE_AUTH_BYPASS=true VITE_AUTH_TURNSTILE_BYPASS=true npm run dev -- --host 127.0.0.1 --port 4173",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: !process.env.CI,
	},
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
		trace: "on-first-retry",
	},
});
