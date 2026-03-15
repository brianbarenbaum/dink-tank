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

	await page.route("**/api/data-browser/query", async (route) => {
		const payload = route.request().postDataJSON() as
			| { queryType?: string }
			| undefined;
		if (payload?.queryType === "team_overview") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					queryId: "query-1",
					queryType: "team_overview",
					layout: "summary",
					breadcrumb: ["2025 S3", "3.5", "Drop Shotters", "Overview"],
					title: "Team Overview",
					fetchedAt: new Date(0).toISOString(),
					page: 1,
					pageSize: 10_000,
					totalRows: 1,
					totalPages: 1,
					sortKey: null,
					sortDirection: null,
					payload: {
						teamName: "Drop Shotters",
						matchRecord: {
							wins: 8,
							losses: 2,
							draws: 0,
							record: "8-2-0",
							homeRecord: "4-1",
							awayRecord: "4-1",
						},
						totalPoints: {
							totalPointsWon: 1240,
							averagePerMatch: 124,
						},
						leagueRank: {
							rank: 3,
							teamCount: 16,
							podRank: 2,
						},
						winBreakdown: {
							overallWinPercentage: 80,
							menWinPercentage: 75,
							womenWinPercentage: 82,
							mixedWinPercentage: 85,
						},
						otherStats: {
							gameRecord: "24-12",
							totalPointsWon: 1240,
							averagePointsPerGame: 48.2,
							teamPointDiff: 125,
						},
					},
				}),
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				queryId: "query-1",
				queryType: "team_schedule",
				layout: "table",
				breadcrumb: ["2025 S3", "3.5", "Drop Shotters", "Schedule"],
				title: "Team Schedule",
				fetchedAt: new Date(0).toISOString(),
				page: 1,
				pageSize: 10_000,
				totalRows: 1,
				totalPages: 1,
				sortKey: "weekNumber",
				sortDirection: "asc",
				payload: {
					columns: [
						{ key: "weekNumber", label: "Week" },
						{ key: "matchDateTime", label: "Match Time" },
						{ key: "opponentTeamName", label: "Opponent" },
						{ key: "matchResult", label: "Result" },
						{ key: "score", label: "Score" },
						{ key: "stage", label: "Stage" },
					],
					rows: [
						{
							weekNumber: 4,
							matchDateTime: "Mar 08, 2026 06:00pm",
							opponentTeamName: "Kitchen Kings",
							matchResult: "Win",
							score: "21-16",
							stage: "Playoff 2",
						},
					],
				},
			}),
		});
	});
});

test("data browser team schedule leaf renders the schedule table", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");

	await page.getByTestId("top-tab-data-browser").click();
	await expect(page.getByTestId("data-browser-root")).toBeVisible();

	await page.getByTestId("mobile-sidebar-toggle").click();
	const mobileSidebar = page.getByTestId("mobile-sidebar");
	await expect(mobileSidebar).toBeVisible();
	await expect(mobileSidebar.getByTestId("data-browser-tree")).toBeVisible();

	await mobileSidebar.getByTestId("data-browser-season-2025-3").click();
	await expect(
		mobileSidebar.getByTestId(
			"data-browser-division-11111111-1111-4111-8111-111111111111",
		),
	).toBeVisible();

	await mobileSidebar
		.getByTestId("data-browser-division-11111111-1111-4111-8111-111111111111")
		.click();
	await expect(
		mobileSidebar.getByTestId(
			"data-browser-leaf-division_players-11111111-1111-4111-8111-111111111111",
		),
	).toBeVisible();

	await mobileSidebar
		.getByTestId(
			"data-browser-teams-branch-11111111-1111-4111-8111-111111111111",
		)
		.click();
	await expect(
		mobileSidebar.getByTestId(
			"data-browser-team-22222222-2222-4222-8222-222222222222",
		),
	).toBeVisible();

	await mobileSidebar
		.getByTestId("data-browser-team-22222222-2222-4222-8222-222222222222")
		.click();
	await expect(
		mobileSidebar.getByTestId(
			"data-browser-leaf-team_schedule-22222222-2222-4222-8222-222222222222",
		),
	).toBeVisible();

	await mobileSidebar
		.getByTestId(
			"data-browser-leaf-team_schedule-22222222-2222-4222-8222-222222222222",
		)
		.click();
	await mobileSidebar.getByTestId("mobile-close-sidebar").click();

	await expect(
		page.getByText("2025 S3 / 3.5 / Drop Shotters / Schedule"),
	).toBeVisible();
	await expect(
		page.getByTestId("direct-query-table-scroll-region"),
	).toBeVisible();
	await expect(page.getByText("Kitchen Kings")).toBeVisible();
	await expect(page.getByText("21-16")).toBeVisible();
});

test("data browser team overview leaf renders the overview card", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto("/");

	await page.getByTestId("top-tab-data-browser").click();
	await expect(page.getByTestId("data-browser-root")).toBeVisible();

	const sidebar = page.getByTestId("data-browser-sidebar-scroll-region");
	await sidebar.getByTestId("data-browser-season-2025-3").click();
	await sidebar
		.getByTestId("data-browser-division-11111111-1111-4111-8111-111111111111")
		.click();
	await sidebar
		.getByTestId(
			"data-browser-teams-branch-11111111-1111-4111-8111-111111111111",
		)
		.click();
	await sidebar
		.getByTestId("data-browser-team-22222222-2222-4222-8222-222222222222")
		.click();
	await sidebar
		.getByTestId(
			"data-browser-leaf-team_overview-22222222-2222-4222-8222-222222222222",
		)
		.click();

	await expect(page.getByTestId("team-overview-card")).toBeVisible();
	await expect(page.getByText("MATCH RECORD")).toBeVisible();
	await expect(page.getByText("WIN PERCENTAGE BREAKDOWN")).toBeVisible();
	await expect(page.getByText("#03")).toBeVisible();
	await expect(page.getByText("1,240")).toBeVisible();
	await expect(page.getByText("80.0%")).toBeVisible();
});
