import { closeSqliteDb, openSqliteDb } from "./db.ts";

export interface SqliteVerificationReport {
	foreignKeyViolations: number;
	duplicateLogicalKeys: number;
	missingSeasonRows: number;
}

const readSingleCount = (value: unknown): number => {
	if (value && typeof value === "object" && "count" in value) {
		const count = (value as { count: number }).count;
		return Number.isFinite(count) ? count : 0;
	}
	return 0;
};

export const verifySqliteIngestion = (dbPath: string): SqliteVerificationReport => {
	const db = openSqliteDb(dbPath);
	try {
		const fkViolations = db.pragma("foreign_key_check") as unknown[];

		const duplicateLogicalKeys =
			readSingleCount(
				db
					.prepare(
						`SELECT COUNT(*) as count
						 FROM (
							SELECT lineup_id, slot_number, COUNT(*) c
							FROM lineup_slots
							GROUP BY lineup_id, slot_number
							HAVING c > 1
						 ) x`,
					)
					.get(),
			) +
			readSingleCount(
				db
					.prepare(
						`SELECT COUNT(*) as count
						 FROM (
							SELECT matchup_id, player_id, COUNT(*) c
							FROM matchup_player_stats
							GROUP BY matchup_id, player_id
							HAVING c > 1
						 ) x`,
					)
					.get(),
			);

		const missingSeasonRows = readSingleCount(
			db
				.prepare(
					`SELECT COUNT(*) as count
					 FROM players p
					 LEFT JOIN player_rosters pr ON pr.player_id = p.player_id
					 WHERE pr.player_id IS NULL`,
				)
				.get(),
		);

		return {
			foreignKeyViolations: fkViolations.length,
			duplicateLogicalKeys,
			missingSeasonRows,
		};
	} finally {
		closeSqliteDb(db);
	}
};

if (import.meta.url === `file://${process.argv[1]}`) {
	const dbPath =
		process.env.CROSSCLUB_SQLITE_PATH ?? "data-ingestion/sqlite/crossclub.db";
	const report = verifySqliteIngestion(dbPath);
	const failures =
		report.foreignKeyViolations +
		report.duplicateLogicalKeys +
		report.missingSeasonRows;

	console.log(`[crossclub-sqlite] verify ${JSON.stringify(report)}`);
	if (failures > 0) {
		process.exitCode = 1;
	}
}
