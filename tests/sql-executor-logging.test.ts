import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolQueryMock, poolConfigCalls, MockPool } = vi.hoisted(() => {
	const queryMock = vi.fn();
	const configCalls: unknown[] = [];
	class PoolMock {
		constructor(config: unknown) {
			configCalls.push(config);
		}

		query = queryMock;
	}
	return {
		poolQueryMock: queryMock,
		poolConfigCalls: configCalls,
		MockPool: PoolMock,
	};
});

vi.mock("pg", () => ({
	Pool: MockPool,
}));

import {
	executeReadOnlySqlRows,
} from "../worker/src/runtime/sql/sqlExecutor";

const env = {
	SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
	SUPABASE_DB_SSL_NO_VERIFY: true,
	SQL_QUERY_TIMEOUT_MS: 25_000,
	SQL_CAPTURE_EXPLAIN_PLAN: false,
} as const;

describe("sql executor logging", () => {
	beforeEach(() => {
		poolQueryMock.mockReset();
		poolConfigCalls.length = 0;
	});

	it("logs query timing and query text on successful execution", async () => {
		poolQueryMock.mockResolvedValue({
			rows: [{ team_name: "Home Court", wins: 10 }],
		});
		const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await executeReadOnlySqlRows(
			env,
			"SELECT team_name, wins FROM public.vw_team_standings LIMIT 1",
		);

		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining('"message":"sql_query_executed"'),
		);
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining('"query":"SELECT team_name, wins FROM public.vw_team_standings LIMIT 1"'),
		);
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining('"rowCount":1'),
		);
		infoSpy.mockRestore();
	});

	it("logs query timing and query text on failed execution", async () => {
		poolQueryMock.mockRejectedValue(new Error("Query read timeout"));
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			executeReadOnlySqlRows(
				env,
				"SELECT team_name FROM public.vw_team_standings LIMIT 1",
			),
		).rejects.toThrow("Query read timeout");

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('"message":"sql_query_failed"'),
		);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('"query":"SELECT team_name FROM public.vw_team_standings LIMIT 1"'),
		);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('"error":{"name":"Error","message":"Query read timeout"}'),
		);
		errorSpy.mockRestore();
	});

	it("configures a wider pool and split timeouts", async () => {
		poolQueryMock.mockResolvedValue({ rows: [] });
		const envWithUniqueUrl = {
			...env,
			SUPABASE_DB_URL:
				"postgres://postgres:postgres@localhost:5432/postgres?test=pool-config",
		};

		await executeReadOnlySqlRows(
			envWithUniqueUrl,
			"SELECT team_name FROM public.vw_team_standings LIMIT 1",
		);

		expect(poolConfigCalls).toHaveLength(1);
		expect(poolConfigCalls[0]).toMatchObject({
			max: 4,
			connectionTimeoutMillis: 10000,
			query_timeout: 25000,
		});
	});

	it("retries once with a fresh pool when connect timeout occurs", async () => {
		poolQueryMock
			.mockRejectedValueOnce(new Error("timeout exceeded when trying to connect"))
			.mockResolvedValueOnce({
				rows: [{ team_name: "Lehigh Valley Spartans" }],
			});
		const envWithUniqueUrl = {
			...env,
			SUPABASE_DB_URL:
				"postgres://postgres:postgres@localhost:5432/postgres?test=retry-connect-timeout",
		};

		const rows = await executeReadOnlySqlRows(
			envWithUniqueUrl,
			"SELECT team_name FROM public.vw_team_standings LIMIT 1",
		);

		expect(rows).toEqual([{ team_name: "Lehigh Valley Spartans" }]);
		expect(poolQueryMock).toHaveBeenCalledTimes(2);
		expect(poolConfigCalls).toHaveLength(2);
	});

	it("retries once with a fresh pool when query read timeout occurs", async () => {
		poolQueryMock
			.mockRejectedValueOnce(new Error("Query read timeout"))
			.mockResolvedValueOnce({
				rows: [{ team_name: "Home Court" }],
			});
		const envWithUniqueUrl = {
			...env,
			SUPABASE_DB_URL:
				"postgres://postgres:postgres@localhost:5432/postgres?test=retry-query-timeout",
		};

		const rows = await executeReadOnlySqlRows(
			envWithUniqueUrl,
			"SELECT team_name FROM public.vw_team_standings LIMIT 1",
		);

		expect(rows).toEqual([{ team_name: "Home Court" }]);
		expect(poolQueryMock).toHaveBeenCalledTimes(2);
		expect(poolConfigCalls).toHaveLength(2);
	});

	it("captures and logs explain plan when enabled for failed query", async () => {
		poolQueryMock
			.mockRejectedValueOnce(new Error("permission denied"))
			.mockResolvedValueOnce({
				rows: [{ "QUERY PLAN": [{ Plan: { "Node Type": "Seq Scan" } }] }],
			});
		const envWithPlanCapture = {
			...env,
			SUPABASE_DB_URL:
				"postgres://postgres:postgres@localhost:5432/postgres?test=plan-capture",
			SQL_CAPTURE_EXPLAIN_PLAN: true,
		};
		const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await expect(
			executeReadOnlySqlRows(
				envWithPlanCapture,
				"SELECT team_name FROM public.vw_team_standings LIMIT 1",
			),
		).rejects.toThrow("permission denied");

		expect(poolQueryMock).toHaveBeenCalledTimes(2);
		expect(poolQueryMock.mock.calls[1]?.[0]).toContain(
			"EXPLAIN (FORMAT JSON)",
		);
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining('"message":"sql_query_plan_captured"'),
		);
		infoSpy.mockRestore();
	});
});
