import { expect, test } from "@playwright/test";

test("home page renders starter content", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { level: 1, name: "Codex Vue Starter" }),
	).toBeVisible();
});
