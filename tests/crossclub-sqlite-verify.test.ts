import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runMockIngestion } from "../data-ingestion/sqlite/run-mock";
import { verifySqliteIngestion } from "../data-ingestion/sqlite/verify";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0, tempDirs.length)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("crossclub sqlite verifier", () => {
	it("returns no integrity failures for baseline fixture ingestion", () => {
		const dir = mkdtempSync(join(tmpdir(), "crossclub-verify-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "ingest.db");

		runMockIngestion({ dbPath, mode: "bootstrap", phase: "all" });

		const report = verifySqliteIngestion(dbPath);
		expect(report.foreignKeyViolations).toBe(0);
		expect(report.duplicateLogicalKeys).toBe(0);
		expect(report.missingSeasonRows).toBe(0);
	});
});

