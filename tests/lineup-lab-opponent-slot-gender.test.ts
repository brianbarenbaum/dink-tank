import { describe, expect, it } from "vitest";

import {
	getPlayersForSlot,
	isOpponentAssignmentGenderValid,
	normalizeGender,
} from "../src/features/lineup-lab/opponentSlotGender";

describe("opponentSlotGender", () => {
	describe("normalizeGender", () => {
		it("returns male for Male, M, male, man", () => {
			expect(normalizeGender("Male")).toBe("male");
			expect(normalizeGender("M")).toBe("male");
			expect(normalizeGender("male")).toBe("male");
			expect(normalizeGender("man")).toBe("male");
		});

		it("returns female for Female, F, female, woman, women", () => {
			expect(normalizeGender("Female")).toBe("female");
			expect(normalizeGender("F")).toBe("female");
			expect(normalizeGender("female")).toBe("female");
			expect(normalizeGender("woman")).toBe("female");
			expect(normalizeGender("women")).toBe("female");
		});

		it("returns null for null, undefined, empty, unknown", () => {
			expect(normalizeGender(null)).toBe(null);
			expect(normalizeGender(undefined)).toBe(null);
			expect(normalizeGender("")).toBe(null);
			expect(normalizeGender("unknown")).toBe(null);
		});
	});

	describe("getPlayersForSlot", () => {
		const malePlayer = {
			playerId: "male-id",
			firstName: "Alex",
			lastName: "M",
			gender: "male",
			isSub: false,
		};
		const femalePlayer = {
			playerId: "female-id",
			firstName: "Casey",
			lastName: "F",
			gender: "female",
			isSub: false,
		};
		const unknownGender = {
			playerId: "unknown-id",
			firstName: "Quinn",
			lastName: "U",
			gender: null,
			isSub: false,
		};
		const allPlayers = [malePlayer, femalePlayer, unknownGender];

		it("mixed slot: playersForA = males only, playersForB = females only", () => {
			const result = getPlayersForSlot("mixed", allPlayers, null, null);
			expect(result.playersForA).toHaveLength(1);
			expect(result.playersForA[0].playerId).toBe("male-id");
			expect(result.playersForB).toHaveLength(1);
			expect(result.playersForB[0].playerId).toBe("female-id");
			expect(result.emptyMessageForA).toBe(null);
			expect(result.emptyMessageForB).toBe(null);
		});

		it("female slot: both lists contain only female players", () => {
			const result = getPlayersForSlot("female", allPlayers, null, null);
			expect(result.playersForA).toHaveLength(1);
			expect(result.playersForA[0].playerId).toBe("female-id");
			expect(result.playersForB).toHaveLength(1);
			expect(result.playersForB[0].playerId).toBe("female-id");
		});

		it("male slot: both lists contain only male players", () => {
			const result = getPlayersForSlot("male", allPlayers, null, null);
			expect(result.playersForA).toHaveLength(1);
			expect(result.playersForA[0].playerId).toBe("male-id");
			expect(result.playersForB).toHaveLength(1);
			expect(result.playersForB[0].playerId).toBe("male-id");
		});

		it("mixed slot with no females: emptyMessageForB set", () => {
			const malesOnly = [malePlayer, unknownGender];
			const result = getPlayersForSlot("mixed", malesOnly, null, null);
			expect(result.playersForB).toHaveLength(0);
			expect(result.emptyMessageForB).toBe("No female opponents on roster.");
		});

		it("includes currently selected player in list when they would be filtered out", () => {
			const result = getPlayersForSlot(
				"mixed",
				allPlayers,
				"female-id",
				null,
			);
			expect(result.playersForA).toContainEqual(
				expect.objectContaining({ playerId: "female-id" }),
			);
		});
	});

	describe("isOpponentAssignmentGenderValid", () => {
		const genderByPlayerId = new Map<string, "male" | "female">([
			["m1", "male"],
			["m2", "male"],
			["f1", "female"],
			["f2", "female"],
		]);

		it("mixed: valid when one male and one female", () => {
			expect(
				isOpponentAssignmentGenderValid(
					"mixed",
					{ playerAId: "m1", playerBId: "f1" },
					genderByPlayerId,
				),
			).toBe(true);
			expect(
				isOpponentAssignmentGenderValid(
					"mixed",
					{ playerAId: "f1", playerBId: "m1" },
					genderByPlayerId,
				),
			).toBe(true);
		});

		it("mixed: invalid when both same gender", () => {
			expect(
				isOpponentAssignmentGenderValid(
					"mixed",
					{ playerAId: "m1", playerBId: "m2" },
					genderByPlayerId,
				),
			).toBe(false);
			expect(
				isOpponentAssignmentGenderValid(
					"mixed",
					{ playerAId: "f1", playerBId: "f2" },
					genderByPlayerId,
				),
			).toBe(false);
		});

		it("female: valid when both female", () => {
			expect(
				isOpponentAssignmentGenderValid(
					"female",
					{ playerAId: "f1", playerBId: "f2" },
					genderByPlayerId,
				),
			).toBe(true);
		});

		it("female: invalid when any male", () => {
			expect(
				isOpponentAssignmentGenderValid(
					"female",
					{ playerAId: "m1", playerBId: "f1" },
					genderByPlayerId,
				),
			).toBe(false);
		});

		it("male: valid when both male", () => {
			expect(
				isOpponentAssignmentGenderValid(
					"male",
					{ playerAId: "m1", playerBId: "m2" },
					genderByPlayerId,
				),
			).toBe(true);
		});

		it("returns false when player gender unknown", () => {
			const withUnknown = new Map<string, "male" | "female">([
				["m1", "male"],
				["f1", "female"],
			]);
			expect(
				isOpponentAssignmentGenderValid(
					"mixed",
					{ playerAId: "m1", playerBId: "missing" },
					withUnknown,
				),
			).toBe(false);
		});
	});
});
