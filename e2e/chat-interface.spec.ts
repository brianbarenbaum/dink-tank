import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const outputDir = path.resolve("validation_screenshots");

test.beforeEach(async ({ page }) => {
	await page.route("**/api/chat", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				reply:
					"Team A has a 62% mixed doubles win rate over the last six matches.",
			}),
		});
	});
});

test("desktop chat interface major layout parity", async ({ page }) => {
	fs.mkdirSync(outputDir, { recursive: true });

	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");

	await expect(page.getByTestId("chat-sidebar").first()).toBeVisible();
	await expect(page.getByTestId("chat-transcript")).toBeVisible();
	await expect(page.getByTestId("chat-composer")).toBeVisible();

	await page.getByLabel("Enter command").fill("Show me Team A win percentage");
	await page.getByRole("button", { name: "Send" }).click();

	await expect(
		page.getByText(
			"Team A has a 62% mixed doubles win rate over the last six matches.",
		),
	).toBeVisible();

	await page.screenshot({
		path: path.join(outputDir, "chat-desktop-v1.png"),
		fullPage: true,
	});
});

test("mobile chat interface major layout parity", async ({ page }) => {
	fs.mkdirSync(outputDir, { recursive: true });

	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto("/");

	await expect(page.getByTestId("mobile-sidebar-toggle")).toBeVisible();
	await expect(page.getByTestId("chat-transcript")).toBeVisible();
	await expect(page.getByTestId("chat-composer")).toBeVisible();

	await page.getByTestId("mobile-sidebar-toggle").click();
	await expect(
		page.getByRole("button", { name: "Close sidebar" }),
	).toBeVisible();

	await page.screenshot({
		path: path.join(outputDir, "chat-mobile-v1.png"),
		fullPage: true,
	});
});
