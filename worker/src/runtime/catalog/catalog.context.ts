import { AI_CATALOG } from "./catalog.data";
import type { CatalogEntry } from "./catalog.types";

const MAX_ALIASES = 6;
const MAX_LOGIC_BRIDGES = 3;
const MAX_FILTER_ALWAYS = 4;
const MAX_FILTER_DEFAULTS = 4;
const MAX_SAMPLE_ROWS = 1;

const toInlineList = (values: string[]): string =>
	values
		.map((value) => value.trim())
		.filter((value) => value.length > 0)
		.join(" | ");

const addFilterHints = (lines: string[], entry: CatalogEntry): void => {
	lines.push("- filter_hints:");

	const always = entry.filterHints.always?.slice(0, MAX_FILTER_ALWAYS) ?? [];
	if (always.length > 0) {
		lines.push("  - always:");
		for (const hint of always) {
			lines.push(`    - ${hint}`);
		}
	}

	if (entry.filterHints.onAmbiguity?.trim()) {
		lines.push(`  - on_ambiguity: ${entry.filterHints.onAmbiguity.trim()}`);
	}

	const defaults = Object.entries(entry.filterHints.defaults ?? {}).slice(
		0,
		MAX_FILTER_DEFAULTS,
	);
	if (defaults.length > 0) {
		lines.push("  - defaults:");
		for (const [key, value] of defaults) {
			lines.push(`    - ${key}: ${String(value)}`);
		}
	}
};

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
		lines.push(
			`- aliases: ${toInlineList(entry.aliases.slice(0, MAX_ALIASES))}`,
		);
		lines.push(`- avoid_for: ${entry.avoidFor.join("; ")}`);
		if (entry.logicBridges?.length) {
			lines.push("- logic_bridges:");
			for (const bridge of entry.logicBridges.slice(0, MAX_LOGIC_BRIDGES)) {
				lines.push(`  - ${bridge}`);
			}
		}
		addFilterHints(lines, entry);
		lines.push(`- default_sort: ${entry.defaultSort}`);
		lines.push(`- examples: ${entry.exampleQuestions.join(" | ")}`);
		for (const column of entry.columns.slice(0, maxColumnsPerView)) {
			lines.push(`- ${column}`);
		}
		lines.push("- sample_data:");
		for (const row of entry.sample_data.slice(0, MAX_SAMPLE_ROWS)) {
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
