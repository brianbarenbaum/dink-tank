import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixturesDir = path.resolve("e2e/fixtures/lineup-lab");

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
const recommendKnownFixture = loadFixture<Record<string, unknown>>(
	"recommend-known-opponent.json",
);
const validationErrorFixture = loadFixture<Record<string, unknown>>(
	"recommend-validation-error.json",
);

const OPPONENT_IDS = {
	maleA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	maleB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	femaleA: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
	femaleB: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
} as const;

const visibleByTestId = (page: Page, testId: string) =>
	page.locator(`[data-testid="${testId}"]:visible`).first();

const setupLineupRoutes = async (
	page: Page,
	mode: "normal" | "validation-error" = "normal",
) => {
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
		if (mode === "validation-error") {
			await route.fulfill({
				status: 400,
				contentType: "application/json",
				body: JSON.stringify(validationErrorFixture),
			});
			return;
		}
		const requestBody = route.request().postDataJSON() as { mode?: string };
		const body =
			requestBody.mode === "known_opponent"
				? recommendKnownFixture
				: recommendBlindFixture;
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(body),
		});
	});
};

const openLineupTab = async (page: Page) => {
	await page.goto("/");
	await page.getByTestId("top-tab-lineup-lab").click();
	await expect(page.getByTestId("lineup-lab-root")).toBeVisible();

	if (await page.getByTestId("mobile-sidebar-toggle").isVisible()) {
		await page.getByTestId("mobile-sidebar-toggle").click();
		await expect(page.getByTestId("mobile-sidebar")).toBeVisible();
	}

	const divisionSelect = visibleByTestId(page, "lineup-division-select");
	await expect(divisionSelect).toBeVisible();
	await expect(divisionSelect.locator("option")).toHaveCount(2);
	await divisionSelect.selectOption({ index: 1 });

	const teamSelect = visibleByTestId(page, "lineup-team-select");
	await expect(teamSelect.locator("option")).toHaveCount(2);
	await teamSelect.selectOption({ index: 1 });

	const matchupSelect = visibleByTestId(page, "lineup-matchup-select");
	await expect(matchupSelect.locator("option")).toHaveCount(2);
	await matchupSelect.selectOption({ index: 1 });
};

const fillKnownOpponentAssignments = async (page: Page) => {
	const assignmentForSlot = (
		roundNumber: number,
		slotNumber: number,
	): { playerAId: string; playerBId: string } => {
		if (roundNumber % 2 === 1) {
			return {
				playerAId: OPPONENT_IDS.maleA,
				playerBId: OPPONENT_IDS.femaleA,
			};
		}
		if (slotNumber <= 2) {
			return {
				playerAId: OPPONENT_IDS.femaleA,
				playerBId: OPPONENT_IDS.femaleB,
			};
		}
		return {
			playerAId: OPPONENT_IDS.maleA,
			playerBId: OPPONENT_IDS.maleB,
		};
	};

	for (let roundNumber = 1; roundNumber <= 8; roundNumber += 1) {
		for (let slotNumber = 1; slotNumber <= 4; slotNumber += 1) {
			const { playerAId, playerBId } = assignmentForSlot(roundNumber, slotNumber);
			const input = visibleByTestId(
				page,
				`round-slot-${roundNumber}-${slotNumber}-opponent-input`,
			);
			await input.locator("select").nth(0).selectOption({ value: playerAId });
			await input.locator("select").nth(1).selectOption({ value: playerBId });
		}
	}
};

test("tab separation", async ({ page }) => {
	await setupLineupRoutes(page);
	await page.goto("/");
	await expect(page.getByTestId("chat-shell")).toBeVisible();
	await expect(page.getByTestId("lineup-lab-root")).toHaveCount(0);

	await page.getByTestId("top-tab-lineup-lab").click();

	await expect(page.getByTestId("lineup-lab-root")).toBeVisible();
	await expect(page.getByTestId("chat-transcript")).toHaveCount(0);
});

test("blind mode layout", async ({ page }) => {
	await setupLineupRoutes(page);
	await openLineupTab(page);

	await expect(
		page
			.getByTestId("lineup-lab-roster-sidebar")
			.getByTestId("opponent-roster-panel"),
	).toBeVisible();
	await expect(visibleByTestId(page, "lineup-mode-toggle-blind")).toBeVisible();
	await expect(visibleByTestId(page, "round-slot-1-1-opponent-input")).toHaveCount(0);
});

test("known mode layout", async ({ page }) => {
	await setupLineupRoutes(page);
	await openLineupTab(page);
	await visibleByTestId(page, "lineup-mode-toggle-known-opponent").click();

	await expect(visibleByTestId(page, "round-slot-1-1-opponent-input")).toBeVisible();
	await expect(visibleByTestId(page, "lineup-calculate-button")).toBeDisabled();
});

test("known mode completion gate", async ({ page }) => {
	await setupLineupRoutes(page);
	await openLineupTab(page);
	await visibleByTestId(page, "lineup-mode-toggle-known-opponent").click();

	await expect(visibleByTestId(page, "lineup-calculate-button")).toBeDisabled();
	await fillKnownOpponentAssignments(page);
	await expect(visibleByTestId(page, "lineup-calculate-button")).toBeEnabled();
});

test("blind calculate flow", async ({ page }) => {
	await setupLineupRoutes(page);
	await openLineupTab(page);

	await visibleByTestId(page, "lineup-calculate-button").click();

	await expect(visibleByTestId(page, "schedule-expected-wins")).toContainText("14.5");
	await expect(visibleByTestId(page, "schedule-conservative-wins")).toContainText("12");
	await expect(visibleByTestId(page, "schedule-matchup-win-probability")).toContainText(
		"56%",
	);
	await expect(visibleByTestId(page, "round-slot-1-1-optimizer-output")).toContainText(
		"Taylor One",
	);
});

test("known calculate flow", async ({ page }) => {
	await setupLineupRoutes(page);
	await openLineupTab(page);
	await visibleByTestId(page, "lineup-mode-toggle-known-opponent").click();
	await fillKnownOpponentAssignments(page);

	await visibleByTestId(page, "lineup-calculate-button").click();

	await expect(visibleByTestId(page, "schedule-expected-wins")).toContainText("15.1");
	await expect(visibleByTestId(page, "schedule-matchup-win-probability")).toContainText(
		"61%",
	);
});

test("validation error mapping", async ({ page }) => {
	await setupLineupRoutes(page, "validation-error");
	await openLineupTab(page);

	await visibleByTestId(page, "lineup-calculate-button").click();
	await expect(
		page.getByText("Complete all opponent assignments before calculating."),
	).toBeVisible();
});

test("mobile parity", async ({ page }) => {
	await setupLineupRoutes(page);
	await page.setViewportSize({ width: 375, height: 812 });
	await openLineupTab(page);

	await expect(visibleByTestId(page, "lineup-mode-toggle-known-opponent")).toBeVisible();
	await visibleByTestId(page, "lineup-mode-toggle-known-opponent").click();
	await expect(visibleByTestId(page, "lineup-calculate-button")).toBeDisabled();
});
