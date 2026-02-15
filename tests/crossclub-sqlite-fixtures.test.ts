import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixtureDir = join(process.cwd(), "data-ingestion", "mock-data");

const requiredFiles = [
	"README.md",
	"regions.json",
	"players.json",
	"teams.json",
	"standings.json",
	"matchups.json",
	"playoff-matchups.json",
	"matchup-details.json",
];

const loadJson = (name: string): unknown => {
	const filePath = join(fixtureDir, name);
	return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
};

describe("crossclub sqlite fixture contract", () => {
	it("contains all required fixture files", () => {
		for (const file of requiredFiles) {
			expect(existsSync(join(fixtureDir, file))).toBe(true);
		}
	});

	it("has regions with divisions and season metadata", () => {
		const regions = loadJson("regions.json") as Array<Record<string, unknown>>;
		expect(Array.isArray(regions)).toBe(true);
		expect(regions.length).toBeGreaterThan(0);

		const first = regions[0] ?? {};
		expect(typeof first.regionId).toBe("string");
		expect(Array.isArray(first.divisions)).toBe(true);

		const division =
			(first.divisions as Array<Record<string, unknown>>)[0] ?? {};
		expect(typeof division.divisionId).toBe("string");
		expect(typeof division.divisionName).toBe("string");
		expect(typeof division.seasonYear).toBe("number");
		expect(typeof division.seasonNumber).toBe("number");
	});

	it("has players with team and division context", () => {
		const players = loadJson("players.json") as Array<Record<string, unknown>>;
		expect(Array.isArray(players)).toBe(true);
		expect(players.length).toBeGreaterThan(0);

		const first = players[0] ?? {};
		expect(typeof first.playerId).toBe("string");
		expect(typeof first.divisionId).toBe("string");
		expect(typeof first.teamId).toBe("string");
		expect(typeof first.seasonYear).toBe("number");
		expect(typeof first.seasonNumber).toBe("number");
	});

	it("has matchup detail fixtures keyed by matchup id", () => {
		const details = loadJson("matchup-details.json") as Record<
			string,
			Record<string, unknown>
		>;
		expect(typeof details).toBe("object");
		const keys = Object.keys(details);
		expect(keys.length).toBeGreaterThan(0);
		const first = details[keys[0] ?? ""] ?? {};
		expect(typeof first.matchupId).toBe("string");
		expect(Array.isArray(first.lineups)).toBe(true);
		expect(Array.isArray(first.playerStats)).toBe(true);
	});

	it("documents sqlite-first local validation flow", () => {
		const readmePath = join(process.cwd(), "data-ingestion", "README.md");
		const readme = readFileSync(readmePath, "utf8");
		expect(readme.includes("npm run ingest:sqlite:init")).toBe(true);
		expect(readme.includes("npm run ingest:sqlite:mock")).toBe(true);
		expect(readme.includes("npm run ingest:sqlite:verify")).toBe(true);
	});
});
