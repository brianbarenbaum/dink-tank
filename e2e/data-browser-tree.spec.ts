import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.route("**/api/data-browser/context/seasons", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				seasons: [{ seasonYear: 2025, seasonNumber: 3, label: "2025 S3" }],
			}),
		});
	});

	await page.route("**/api/data-browser/context/divisions?*", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				divisions: [
					{
						divisionId: "11111111-1111-4111-8111-111111111111",
						divisionName: "3.5",
						seasonYear: 2025,
						seasonNumber: 3,
						location: "NJ / PA",
					},
				],
			}),
		});
	});

	await page.route("**/api/data-browser/context/teams?*", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				teams: [
					{
						teamId: "22222222-2222-4222-8222-222222222222",
						teamName: "Drop Shotters",
					},
				],
			}),
		});
	});
});

test("data browser tree renders and leaves stay non-executing in phase 1", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");

	const transcriptMessages = page.locator(
		"[data-testid='chat-transcript'] article",
	);
	await expect(transcriptMessages).toHaveCount(1);

	await page.getByTestId("mobile-sidebar-toggle").click();
	await expect(page.getByTestId("mobile-sidebar")).toBeVisible();
	await expect(page.getByTestId("data-browser-tree")).toBeVisible();

	await page.getByTestId("data-browser-season-2025-3").click();
	await expect(
		page.getByTestId(
			"data-browser-division-11111111-1111-4111-8111-111111111111",
		),
	).toBeVisible();

	await page
		.getByTestId("data-browser-division-11111111-1111-4111-8111-111111111111")
		.click();
	await expect(
		page.getByTestId(
			"data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111",
		),
	).toBeVisible();

	await page
		.getByTestId(
			"data-browser-teams-branch-11111111-1111-4111-8111-111111111111",
		)
		.click();
	await expect(
		page.getByTestId("data-browser-team-22222222-2222-4222-8222-222222222222"),
	).toBeVisible();

	await page
		.getByTestId("data-browser-team-22222222-2222-4222-8222-222222222222")
		.click();
	await expect(
		page.getByTestId(
			"data-browser-leaf-team_schedule-22222222-2222-4222-8222-222222222222",
		),
	).toBeVisible();

	await page
		.getByTestId(
			"data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111",
		)
		.click();
	await expect(transcriptMessages).toHaveCount(1);
});
