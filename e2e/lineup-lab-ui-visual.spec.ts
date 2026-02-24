import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixturesDir = path.resolve("e2e/fixtures/lineup-lab");
const validationScreenshotsDir = path.resolve("validation_screenshots");

const loadFixture = <T>(name: string): T =>
	JSON.parse(
		fs.readFileSync(path.join(fixturesDir, name), "utf-8"),
	) as T;

const divisionsFixture = loadFixture<{ divisions: unknown[] }>("divisions.json");
const teamsFixture = loadFixture<{ teams: unknown[] }>("teams.json");
const matchupsFixture = loadFixture<Record<string, unknown>>("matchups.json");
const recommendBlindFixture = loadFixture<Record<string, unknown>>(
	"recommend-blind.json",
);

const setupLineupRoutes = async (page: Page) => {
	await page.route("**/api/lineup-lab/context/divisions", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(divisionsFixture),
		});
	});
	await page.route("**/api/lineup-lab/context/teams*", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(teamsFixture),
		});
	});
	await page.route("**/api/lineup-lab/context/matchups*", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(matchupsFixture),
		});
	});
	await page.route("**/api/lineup-lab/recommend", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(recommendBlindFixture),
		});
	});
};

test("lineup lab desktop visual parity", async ({ page }) => {
	await setupLineupRoutes(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.getByTestId("top-tab-lineup-lab").click();
	await expect(page.getByTestId("lineup-lab-root")).toBeVisible();
	await page.getByTestId("lineup-calculate-button").click();
	await expect(page.getByTestId("schedule-expected-wins").first()).toContainText("14.5");

	fs.mkdirSync(validationScreenshotsDir, { recursive: true });
	await page.screenshot({
		path: path.join(validationScreenshotsDir, "lineup-lab-desktop-v1.png"),
		fullPage: true,
	});

	await expect(page).toHaveScreenshot("lineup-lab-desktop.png", {
		fullPage: true,
	});
});

test("lineup lab mobile visual parity", async ({ page }) => {
	await setupLineupRoutes(page);
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto("/");
	await page.getByTestId("top-tab-lineup-lab").click();
	await expect(page.getByTestId("lineup-lab-root")).toBeVisible();

	fs.mkdirSync(validationScreenshotsDir, { recursive: true });
	await page.screenshot({
		path: path.join(validationScreenshotsDir, "lineup-lab-mobile-v1.png"),
		fullPage: true,
	});

	await expect(page).toHaveScreenshot("lineup-lab-mobile.png", {
		fullPage: true,
	});
});
