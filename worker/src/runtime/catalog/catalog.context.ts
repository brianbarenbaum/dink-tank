import { AI_CATALOG } from "./catalog.data";
import type { CatalogEntry } from "./catalog.types";

/**
 * Serializes selected catalog entries into prompt-ready schema context text.
 */
export const buildSchemaContext = (
	entries: CatalogEntry[],
	maxColumnsPerView: number,
): string => {
	if (entries.length === 0) {
		return "No catalog views were selected.";
	}

	const lines: string[] = [];
	for (const entry of entries) {
		lines.push(`${entry.name}:`);
		lines.push(`- intent: ${entry.description}`);
		lines.push(`- avoid_for: ${entry.avoidFor.join("; ")}`);
		lines.push(`- default_sort: ${entry.defaultSort}`);
		lines.push(`- examples: ${entry.exampleQuestions.join(" | ")}`);
		for (const column of entry.columns.slice(0, maxColumnsPerView)) {
			lines.push(`- ${column}`);
		}
		lines.push("- sample_data:");
		for (const row of entry.sample_data) {
			lines.push(`  - ${JSON.stringify(row)}`);
		}
		lines.push("");
	}
	return lines.join("\n").trim();
};

/**
 * Builds schema context from a list of catalog view names.
 */
export const buildCatalogSchemaContextForViews = (
	viewNames: string[],
	maxColumnsPerView: number,
): string => {
	const entries = viewNames
		.map((name) => AI_CATALOG.find((entry) => entry.name === name))
		.filter((entry): entry is CatalogEntry => Boolean(entry));
	return buildSchemaContext(entries, maxColumnsPerView);
};
