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

const visibleByTestId = (page: Page, testId: string) =>
	page.locator(`[data-testid="${testId}"]:visible`).first();

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

const openLineupTabAndSeed = async (page: Page) => {
	await page.goto("/");
	await page.getByTestId("top-tab-lineup-lab").click();
	await expect(page.getByTestId("lineup-lab-root")).toBeVisible();

	if (await page.getByTestId("mobile-sidebar-toggle").isVisible()) {
		await page.getByTestId("mobile-sidebar-toggle").click();
		await expect(page.getByTestId("mobile-sidebar")).toBeVisible();
	}

	const divisionSelect = visibleByTestId(page, "lineup-division-select");
	await expect(divisionSelect.locator("option")).toHaveCount(2);
	await divisionSelect.selectOption({ index: 1 });

	const teamSelect = visibleByTestId(page, "lineup-team-select");
	await expect(teamSelect.locator("option")).toHaveCount(2);
	await teamSelect.selectOption({ index: 1 });

	const matchupSelect = visibleByTestId(page, "lineup-matchup-select");
	await expect(matchupSelect.locator("option")).toHaveCount(2);
	await matchupSelect.selectOption({ index: 1 });
};

test("lineup lab desktop visual parity", async ({ page }) => {
	await setupLineupRoutes(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await openLineupTabAndSeed(page);
	await visibleByTestId(page, "lineup-calculate-button").click();
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
	await openLineupTabAndSeed(page);

	fs.mkdirSync(validationScreenshotsDir, { recursive: true });
	await page.screenshot({
		path: path.join(validationScreenshotsDir, "lineup-lab-mobile-v1.png"),
		fullPage: true,
	});

	await expect(page).toHaveScreenshot("lineup-lab-mobile.png", {
		fullPage: true,
	});
});
