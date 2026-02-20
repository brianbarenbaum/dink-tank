import { describe, expect, it } from "vitest";

import { sanitizeSqlQuery } from "../worker/src/runtime/sqlSafety";
import {
	SqlSafetyError,
	type SqlSafetyErrorCode,
} from "../worker/src/runtime/sql/sqlErrors";

const expectSqlSafetyCode = (query: string, code: SqlSafetyErrorCode): void => {
	try {
		sanitizeSqlQuery(query);
		throw new Error(`Expected SqlSafetyError for query: ${query}`);
	} catch (error) {
		expect(error).toBeInstanceOf(SqlSafetyError);
		expect((error as SqlSafetyError).code).toBe(code);
	}
};

describe("sql safety", () => {
	it("allows readonly select queries", () => {
		expect(sanitizeSqlQuery("SELECT team_name FROM crossclub.teams")).toContain(
			"SELECT team_name",
		);
	});

	it("appends a default limit when missing", () => {
		expect(sanitizeSqlQuery("SELECT team_name FROM crossclub.teams")).toBe(
			"SELECT team_name FROM crossclub.teams LIMIT 25",
		);
	});

	it("preserves explicit limits", () => {
		expect(
			sanitizeSqlQuery("SELECT team_name FROM crossclub.teams LIMIT 10"),
		).toBe("SELECT team_name FROM crossclub.teams LIMIT 10");
	});

	it("rejects write or ddl queries", () => {
		expectSqlSafetyCode("DROP TABLE crossclub.teams", "DDL_OR_WRITE_BLOCKED");
		expectSqlSafetyCode(
			"UPDATE crossclub.teams SET team_name = 'A'",
			"DDL_OR_WRITE_BLOCKED",
		);
	});

	it("rejects empty and multi-statement inputs with typed codes", () => {
		expectSqlSafetyCode("   ", "EMPTY_QUERY");
		expectSqlSafetyCode(
			"SELECT team_name FROM crossclub.teams; SELECT * FROM crossclub.teams",
			"MULTI_STATEMENT",
		);
	});
});
