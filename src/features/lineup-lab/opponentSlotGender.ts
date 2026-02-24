import type { LineupMatchType } from "./types";
import type { OpponentRosterPlayer } from "./types";

export type NormalizedGender = "male" | "female";

export function normalizeGender(value: string | null | undefined): NormalizedGender | null {
	if (value == null || typeof value !== "string") {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === "m" || normalized === "male" || normalized === "man") {
		return "male";
	}
	if (
		normalized === "f" ||
		normalized === "female" ||
		normalized === "woman" ||
		normalized === "women"
	) {
		return "female";
	}
	return null;
}

export interface PlayersForSlotResult {
	playersForA: OpponentRosterPlayer[];
	playersForB: OpponentRosterPlayer[];
	emptyMessageForA: string | null;
	emptyMessageForB: string | null;
}

/**
 * Returns filtered opponent lists for the two dropdowns and optional inline
 * messages when a required gender has no players on the roster.
 * - Mixed: A = male, B = female.
 * - Female slot: both = female only.
 * - Male slot: both = male only.
 * Players with null/unknown gender are excluded. Currently selected player is
 * included in the list even if they would be filtered out, so we don't drop
 * invalid prior selections.
 */
export function getPlayersForSlot(
	matchType: LineupMatchType,
	players: OpponentRosterPlayer[],
	playerAId: string | null,
	playerBId: string | null,
): PlayersForSlotResult {
	const males = players.filter((p) => normalizeGender(p.gender) === "male");
	const females = players.filter((p) => normalizeGender(p.gender) === "female");

	const includeSelectedIfMissing = (
		list: OpponentRosterPlayer[],
		selectedId: string | null,
	): OpponentRosterPlayer[] => {
		if (!selectedId) return list;
		if (list.some((p) => p.playerId === selectedId)) return list;
		const selected = players.find((p) => p.playerId === selectedId);
		return selected ? [...list, selected] : list;
	};

	if (matchType === "mixed") {
		const playersForA = includeSelectedIfMissing(males, playerAId);
		const playersForB = includeSelectedIfMissing(females, playerBId);
		return {
			playersForA,
			playersForB,
			emptyMessageForA: males.length === 0 ? "No male opponents on roster." : null,
			emptyMessageForB: females.length === 0 ? "No female opponents on roster." : null,
		};
	}
	if (matchType === "female") {
		const list = includeSelectedIfMissing(females, playerAId);
		const listB = includeSelectedIfMissing(females, playerBId);
		return {
			playersForA: list,
			playersForB: listB,
			emptyMessageForA: females.length === 0 ? "No female opponents on roster." : null,
			emptyMessageForB: females.length === 0 ? "No female opponents on roster." : null,
		};
	}
	// male
	const list = includeSelectedIfMissing(males, playerAId);
	const listB = includeSelectedIfMissing(males, playerBId);
	return {
		playersForA: list,
		playersForB: listB,
		emptyMessageForA: males.length === 0 ? "No male opponents on roster." : null,
		emptyMessageForB: males.length === 0 ? "No male opponents on roster." : null,
	};
}

/**
 * Returns true if the assignment satisfies gender rules for the slot.
 * Uses normalized gender from the roster; unknown gender is invalid.
 */
export function isOpponentAssignmentGenderValid(
	matchType: LineupMatchType,
	assignment: { playerAId: string | null; playerBId: string | null },
	genderByPlayerId: Map<string, NormalizedGender>,
): boolean {
	const { playerAId, playerBId } = assignment;
	if (!playerAId || !playerBId) return false;
	const genderA = genderByPlayerId.get(playerAId) ?? null;
	const genderB = genderByPlayerId.get(playerBId) ?? null;
	if (genderA == null || genderB == null) return false;

	if (matchType === "mixed") {
		return (genderA === "male" && genderB === "female") || (genderA === "female" && genderB === "male");
	}
	if (matchType === "female") {
		return genderA === "female" && genderB === "female";
	}
	// male
	return genderA === "male" && genderB === "male";
}
