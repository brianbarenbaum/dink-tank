import { AI_CATALOG } from "../catalog/catalog";

export const getApprovedSqlRelations = (): ReadonlySet<string> =>
	new Set(AI_CATALOG.map((entry) => entry.name.toLowerCase()));
