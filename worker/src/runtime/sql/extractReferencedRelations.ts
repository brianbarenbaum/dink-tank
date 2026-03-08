import nodeSqlParser from "node-sql-parser";

const POSTGRES_DIALECT = { database: "Postgresql" as const };

const { Parser } = nodeSqlParser;
const parser = new Parser();

const normalizeIdentifier = (value: string): string => {
	const normalized = value
		.replace(/^"(.*)"$/, "$1")
		.trim()
		.toLowerCase();
	return normalized === "null" ? "" : normalized;
};

type SelectAst = {
	with?: Array<{
		name?: {
			value?: string;
		};
	}> | null;
};

const toAstArray = (ast: unknown): SelectAst[] =>
	Array.isArray(ast) ? (ast as SelectAst[]) : ([ast] as SelectAst[]);

const collectCteNames = (query: string): ReadonlySet<string> => {
	const ast = parser.astify(query, POSTGRES_DIALECT);
	const cteNames = new Set<string>();

	for (const statement of toAstArray(ast)) {
		for (const cte of statement.with ?? []) {
			const name = normalizeIdentifier(cte.name?.value ?? "");
			if (name) {
				cteNames.add(name);
			}
		}
	}

	return cteNames;
};

export const extractReferencedRelations = (
	query: string,
): ReadonlySet<string> => {
	const tableList = parser.tableList(query, POSTGRES_DIALECT);
	const cteNames = collectCteNames(query);
	const relations = new Set<string>();

	for (const entry of tableList) {
		const [, rawSchema, rawTable] = entry.split("::");
		const schema = normalizeIdentifier(rawSchema ?? "");
		const table = normalizeIdentifier(rawTable ?? "");
		if (!table) {
			continue;
		}
		if (!schema) {
			if (!cteNames.has(table)) {
				relations.add(table);
			}
			continue;
		}
		relations.add(`${schema}.${table}`);
	}

	return relations;
};
