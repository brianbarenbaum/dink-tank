const DENY_RE = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|TRUNCATE|GRANT|REVOKE)\b/i;
const LIMIT_RE = /\blimit\b\s+\d+(\s*,\s*\d+)?\s*;?\s*$/i;

const countSemicolons = (query: string): number => [...query].filter((char) => char === ";").length;

export const sanitizeSqlQuery = (input: string): string => {
	const raw = String(input ?? "").trim();
	if (!raw) {
		throw new Error("SQL query cannot be empty.");
	}

	const semicolonCount = countSemicolons(raw);
	if (semicolonCount > 1 || (raw.endsWith(";") && raw.slice(0, -1).includes(";"))) {
		throw new Error("Only a single SQL statement is allowed.");
	}

	const query = raw.replace(/;+\s*$/g, "").trim();
	const lower = query.toLowerCase();
	if (!lower.startsWith("select") && !lower.startsWith("with")) {
		throw new Error("Only read-only SQL is allowed.");
	}

	if (DENY_RE.test(query)) {
		throw new Error("Write or DDL SQL is blocked.");
	}

	if (!LIMIT_RE.test(query)) {
		return `${query} LIMIT 25`;
	}

	return query;
};
