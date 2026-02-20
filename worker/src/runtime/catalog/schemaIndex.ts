export interface SchemaColumnRow {
	tableSchema: string;
	tableName: string;
	columnName: string;
	dataType: string;
}

export interface SchemaColumn {
	name: string;
	dataType: string;
	tokens: string[];
}

export interface SchemaTable {
	tableSchema: string;
	tableName: string;
	tableId: string;
	tokens: string[];
	columns: SchemaColumn[];
}

export interface SchemaIndex {
	tables: SchemaTable[];
}

const TOKEN_RE = /[a-z0-9]+/g;

const SYNONYMS: Record<string, string[]> = {
	pct: ["percentage", "percent"],
	percentage: ["pct", "percent"],
	win: ["wins", "winning"],
	wins: ["win", "winning"],
	lose: ["loss", "losses"],
	losses: ["loss", "lose"],
	team: ["teams"],
	teams: ["team"],
	player: ["players"],
	players: ["player"],
};

/**
 * Normalizes a token for case-insensitive indexing and comparison.
 */
const normalizeToken = (token: string): string => token.toLowerCase().trim();

/**
 * Tokenizes free text into normalized searchable tokens with simple plural/synonym expansion.
 */
export const tokenize = (value: string): string[] => {
	const matches = value.toLowerCase().match(TOKEN_RE) ?? [];
	const expanded = new Set<string>();

	for (const token of matches.map(normalizeToken)) {
		if (!token) {
			continue;
		}
		expanded.add(token);
		if (token.endsWith("s") && token.length > 3) {
			expanded.add(token.slice(0, -1));
		} else if (token.length > 2) {
			expanded.add(`${token}s`);
		}
		for (const synonym of SYNONYMS[token] ?? []) {
			expanded.add(synonym);
		}
	}

	return [...expanded];
};

/**
 * Builds a table/column token index from raw schema rows for lookup and ranking tasks.
 */
export const buildSchemaIndex = (rows: SchemaColumnRow[]): SchemaIndex => {
	const tableMap = new Map<string, SchemaTable>();

	for (const row of rows) {
		const tableId = `${row.tableSchema}.${row.tableName}`;
		const tableTokens = tokenize(`${row.tableSchema} ${row.tableName}`);
		const columnTokens = tokenize(row.columnName);
		const existing = tableMap.get(tableId);

		if (!existing) {
			tableMap.set(tableId, {
				tableSchema: row.tableSchema,
				tableName: row.tableName,
				tableId,
				tokens: tableTokens,
				columns: [
					{
						name: row.columnName,
						dataType: row.dataType,
						tokens: columnTokens,
					},
				],
			});
			continue;
		}

		existing.columns.push({
			name: row.columnName,
			dataType: row.dataType,
			tokens: columnTokens,
		});
	}

	return {
		tables: [...tableMap.values()],
	};
};
