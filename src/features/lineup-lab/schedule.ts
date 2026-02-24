import type { LineupMatchType } from "./types";

export const SCHEDULE_SLOT_TEMPLATE: Array<Array<LineupMatchType>> = [
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
	["mixed", "mixed", "mixed", "mixed"],
	["female", "female", "male", "male"],
];

export interface SlotTemplateEntry {
	roundNumber: number;
	slotNumber: number;
	matchType: LineupMatchType;
}

export const SCHEDULE_SLOTS: SlotTemplateEntry[] = SCHEDULE_SLOT_TEMPLATE.flatMap(
	(slotTypes, roundIndex) =>
		slotTypes.map((matchType, slotIndex) => ({
			roundNumber: roundIndex + 1,
			slotNumber: slotIndex + 1,
			matchType,
		})),
);

export const isExpectedMatchType = (
	roundNumber: number,
	slotNumber: number,
	matchType: LineupMatchType,
): boolean => {
	const roundTemplate = SCHEDULE_SLOT_TEMPLATE[roundNumber - 1];
	if (!roundTemplate) {
		return false;
	}
	const slotTemplate = roundTemplate[slotNumber - 1];
	if (!slotTemplate) {
		return false;
	}
	return slotTemplate === matchType;
};
