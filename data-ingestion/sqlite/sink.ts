import type { SqliteDb } from "./db";

export type Row = Record<string, unknown>;

const buildUpsertSql = (
	table: string,
	columns: string[],
	conflictColumns: string[],
): string => {
	const values = columns.map((column) => `@${column}`).join(", ");
	const updateColumns = columns.filter(
		(column) => !conflictColumns.includes(column),
	);

	const updateSql =
		updateColumns.length === 0
			? "DO NOTHING"
			: `DO UPDATE SET ${updateColumns
					.map((column) => `${column}=excluded.${column}`)
					.join(", ")}`;

	return `
		INSERT INTO ${table} (${columns.join(", ")})
		VALUES (${values})
		ON CONFLICT (${conflictColumns.join(", ")}) ${updateSql}
	`;
};

export const upsertRows = (
	db: SqliteDb,
	table: string,
	rows: Row[],
	conflictColumns: string[],
): number => {
	if (rows.length === 0) {
		return 0;
	}

	const columns = Object.keys(rows[0] ?? {});
	if (columns.length === 0) {
		return 0;
	}

	const statement = db.prepare(buildUpsertSql(table, columns, conflictColumns));
	const tx = db.transaction((payload: Row[]) => {
		for (const row of payload) {
			statement.run(row);
		}
	});
	tx(rows);
	return rows.length;
};
