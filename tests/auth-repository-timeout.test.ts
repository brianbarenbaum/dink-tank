import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolQueryMock, poolEndMock, poolConfigCalls, MockPool } = vi.hoisted(
	() => {
		const queryMock = vi.fn();
		const endMock = vi.fn();
		const configCalls: unknown[] = [];
		class PoolMock {
			constructor(config: unknown) {
				configCalls.push(config);
			}

			query = queryMock;
			end = endMock;
		}

		return {
			poolQueryMock: queryMock,
			poolEndMock: endMock,
			poolConfigCalls: configCalls,
			MockPool: PoolMock,
		};
	},
);

vi.mock("pg", () => ({
	Pool: MockPool,
}));

import { isApprovedEmail } from "../worker/src/runtime/auth/repository";

describe("auth repository timeout config", () => {
	beforeEach(() => {
		poolQueryMock.mockReset();
		poolEndMock.mockReset();
		poolConfigCalls.length = 0;
		poolQueryMock.mockResolvedValue({
			rowCount: 0,
			rows: [],
		});
	});

	it("uses the configured auth query timeout", async () => {
		await isApprovedEmail(
			{
				SUPABASE_DB_URL: "postgres://postgres:postgres@localhost:5432/postgres",
				SUPABASE_DB_SSL_NO_VERIFY: true,
				SQL_QUERY_TIMEOUT_MS: 5_000,
			},
			"user@example.com",
		);

		expect(poolConfigCalls[0]).toMatchObject({
			connectionTimeoutMillis: 5_000,
			query_timeout: 5_000,
		});
	});

	it("preserves larger configured auth query timeouts", async () => {
		await isApprovedEmail(
			{
				SUPABASE_DB_URL:
					"postgres://postgres:postgres@localhost:5432/postgres?test=larger-timeout",
				SUPABASE_DB_SSL_NO_VERIFY: true,
				SQL_QUERY_TIMEOUT_MS: 25_000,
			},
			"user@example.com",
		);

		expect(poolConfigCalls[0]).toMatchObject({
			connectionTimeoutMillis: 25_000,
			query_timeout: 25_000,
		});
	});

	it("retries a transient auth read failure once", async () => {
		poolQueryMock
			.mockRejectedValueOnce(new Error("Query read timeout"))
			.mockResolvedValueOnce({
				rowCount: 1,
				rows: [{ ok: 1 }],
			});

		const result = await isApprovedEmail(
			{
				SUPABASE_DB_URL:
					"postgres://postgres:postgres@localhost:5432/postgres?test=retry-once",
				SUPABASE_DB_SSL_NO_VERIFY: true,
				SQL_QUERY_TIMEOUT_MS: 3_000,
			},
			"user@example.com",
		);

		expect(result).toBe(true);
		expect(poolQueryMock).toHaveBeenCalledTimes(2);
		expect(poolEndMock).toHaveBeenCalledTimes(1);
		expect(poolConfigCalls).toHaveLength(2);
	});
});
