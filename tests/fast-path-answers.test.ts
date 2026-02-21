import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeReadOnlySqlRowsMock } = vi.hoisted(() => ({
	executeReadOnlySqlRowsMock: vi.fn(),
}));

vi.mock("../worker/src/runtime/sql/sqlExecutor", () => ({
	executeReadOnlySqlRows: executeReadOnlySqlRowsMock,
}));

import { tryResolveFastPathAnswer } from "../worker/src/runtime/fastPathAnswers";

const env = {} as never;

describe("fast path answers", () => {
	beforeEach(() => {
		executeReadOnlySqlRowsMock.mockReset();
	});

	it("answers best women's record using a single standings query", async () => {
		executeReadOnlySqlRowsMock.mockResolvedValueOnce([
			{ team_name: "Home Court", womens_record: "87-17", women_wins: 87 },
		]);

		const answer = await tryResolveFastPathAnswer(
			env,
			"Which team has the best Women's record in the 3.0 Northeast pod?",
		);

		expect(answer).toContain("Home Court has the best Women's record");
		expect(answer).toContain("87-17");
		expect(executeReadOnlySqlRowsMock).toHaveBeenCalledTimes(1);
		expect(executeReadOnlySqlRowsMock.mock.calls[0]?.[1]).toContain(
			"pod_name = 'Northeast'",
		);
	});

	it("answers most competitive pod using one aggregate query", async () => {
		executeReadOnlySqlRowsMock.mockResolvedValueOnce([
			{ pod_name: "Southeast", avg_point_diff: "0.44" },
		]);

		const answer = await tryResolveFastPathAnswer(
			env,
			"Which 3.0 pod is the most competitive based on point differential?",
		);

		expect(answer).toContain("Southeast is the most competitive pod");
		expect(executeReadOnlySqlRowsMock).toHaveBeenCalledTimes(1);
		expect(executeReadOnlySqlRowsMock.mock.calls[0]?.[1]).toContain(
			"ORDER BY ABS(AVG(average_point_differential::numeric)) ASC",
		);
	});

	it("answers worst away record using one ordered query", async () => {
		executeReadOnlySqlRowsMock.mockResolvedValueOnce([
			{ team_name: "Lehigh Valley Spartans", away_record: "0-8" },
		]);

		const answer = await tryResolveFastPathAnswer(
			env,
			"Which 3.0 team has the worst 'Away Record'?",
		);

		expect(answer).toContain("Lehigh Valley Spartans");
		expect(answer).toContain("0-8");
		expect(executeReadOnlySqlRowsMock).toHaveBeenCalledTimes(1);
		expect(executeReadOnlySqlRowsMock.mock.calls[0]?.[1]).toContain(
			"ORDER BY away_win_rate::numeric ASC",
		);
	});

	it("returns null when no fast path intent matches", async () => {
		const answer = await tryResolveFastPathAnswer(
			env,
			"What was the result of the last match for Pickle Juice?",
		);

		expect(answer).toBeNull();
		expect(executeReadOnlySqlRowsMock).not.toHaveBeenCalled();
	});
});
