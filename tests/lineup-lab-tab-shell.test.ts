import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LineupLabTabShell from "../src/features/lineup-lab/components/LineupLabTabShell.vue";

const baseProps = {
	lineupDivisions: [
		{
			divisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
			divisionName: "4.0",
			seasonYear: 2025,
			seasonNumber: 3,
			location: "NJ / PA",
		},
	],
	lineupTeams: [{ teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562", teamName: "Team A" }],
	lineupMatchups: [
		{
			matchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
			weekNumber: 1,
			scheduledTime: new Date(0).toISOString(),
			teamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
			oppTeamId: "6bb73493-1a15-4527-9765-6aadfaca773b",
			teamName: "Team A",
			oppTeamName: "Team B",
			opponentRosterPlayers: [
				{
					playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
					firstName: "Alex",
					lastName: "Opp",
					gender: "male",
					isSub: false,
				},
			],
		},
	],
	lineupRosterPlayers: [
		{
			playerId: "11111111-1111-4111-8111-111111111111",
			firstName: "Taylor",
			lastName: "One",
			gender: "female",
			isSub: false,
			suggested: true,
		},
	],
	opponentRosterPlayers: [
		{
			playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			firstName: "Alex",
			lastName: "Opp",
			gender: "male",
			isSub: false,
		},
	],
	selectedDivisionId: "e8d04726-4c07-447c-a609-9914d1378e8d",
	selectedTeamId: "a7d5c302-9ee0-4bd6-9205-971efe6af562",
	selectedMatchupId: "99bb7ced-889b-4e42-91b8-f84878c5c43b",
	selectedAvailablePlayerIds: [
		"11111111-1111-4111-8111-111111111111",
		"22222222-2222-4222-8222-222222222222",
		"33333333-3333-4333-8333-333333333333",
		"44444444-4444-4444-8444-444444444444",
		"55555555-5555-4555-8555-555555555555",
		"66666666-6666-4666-8666-666666666666",
		"77777777-7777-4777-8777-777777777777",
		"88888888-8888-4888-8888-888888888888",
	],
	opponentAssignments: {},
	recommendationResult: null,
	isLoadingTeams: false,
	isLoadingMatchups: false,
	isCalculating: false,
	canCalculate: true,
	knownOpponentCompletionError: null,
	errorMessage: null,
};

describe("LineupLabTabShell", () => {
	it("hides opponent slot inputs in blind mode", () => {
		const wrapper = mount(LineupLabTabShell, {
			props: {
				...baseProps,
				mode: "blind",
			},
		});

		expect(wrapper.find("[data-testid='lineup-lab-root']").exists()).toBe(true);
		expect(
			wrapper.find("[data-testid='schedule-metadata-header']").exists(),
		).toBe(true);
		expect(
			wrapper.find("[data-testid='round-slot-1-1-opponent-input']").exists(),
		).toBe(false);
		expect(
			wrapper.find("[data-testid='round-slot-1-1-optimizer-output']").exists(),
		).toBe(true);
	});

	it("renders opponent slot inputs in known-opponent mode", () => {
		const wrapper = mount(LineupLabTabShell, {
			props: {
				...baseProps,
				mode: "known_opponent",
			},
		});

		expect(
			wrapper.find("[data-testid='round-slot-1-1-opponent-input']").exists(),
		).toBe(true);
		// Calculate button lives in the app left sidebar (LineupLabSidebarContent), not in the tab shell
	});
});
