import { SqlSafetyError } from "./sqlErrors";

const DENY_RE =
	/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|TRUNCATE|GRANT|REVOKE)\b/i;
const LIMIT_RE = /\blimit\b\s+\d+(\s*,\s*\d+)?\s*;?\s*$/i;

/**
 * Counts semicolons to detect potential multi-statement SQL payloads.
 */
const countSemicolons = (query: string): number =>
	[...query].filter((char) => char === ";").length;

/**
 * Enforces read-only single-statement SQL and applies a default limit when missing.
 */
export const sanitizeSqlQuery = (input: string): string => {
	const raw = String(input ?? "").trim();
	if (!raw) {
		throw new SqlSafetyError("EMPTY_QUERY", "SQL query cannot be empty.");
	}

	const semicolonCount = countSemicolons(raw);
	const withoutTrailingSemicolon = raw.replace(/;+\s*$/g, "");
	if (semicolonCount > 1 || withoutTrailingSemicolon.includes(";")) {
		throw new SqlSafetyError(
			"MULTI_STATEMENT",
			"Only a single SQL statement is allowed.",
		);
	}

	const query = raw.replace(/;+\s*$/g, "").trim();
	if (DENY_RE.test(query)) {
		throw new SqlSafetyError(
			"DDL_OR_WRITE_BLOCKED",
			"Write or DDL SQL is blocked.",
		);
	}

	const lower = query.toLowerCase();
	if (!lower.startsWith("select") && !lower.startsWith("with")) {
		throw new SqlSafetyError("NON_READ_ONLY", "Only read-only SQL is allowed.");
	}

	if (!LIMIT_RE.test(query)) {
		return `${query} LIMIT 25`;
	}

	return query;
};
