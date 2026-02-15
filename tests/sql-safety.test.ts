import { describe, expect, it } from "vitest";

import { sanitizeSqlQuery } from "../worker/src/chat/sqlSafety";

describe("sql safety", () => {
	it("allows readonly select queries", () => {
		expect(sanitizeSqlQuery("SELECT team_name FROM crossclub.teams")).toContain(
			"SELECT team_name",
		);
	});

	it("rejects write or ddl queries", () => {
		expect(() => sanitizeSqlQuery("DROP TABLE crossclub.teams")).toThrow();
		expect(() => sanitizeSqlQuery("UPDATE crossclub.teams SET team_name = 'A'")).toThrow();
	});
});
