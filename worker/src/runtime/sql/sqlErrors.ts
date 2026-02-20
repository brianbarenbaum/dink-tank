export const SQL_SAFETY_ERROR_CODES = [
	"EMPTY_QUERY",
	"MULTI_STATEMENT",
	"NON_READ_ONLY",
	"DDL_OR_WRITE_BLOCKED",
] as const;

export type SqlSafetyErrorCode = (typeof SQL_SAFETY_ERROR_CODES)[number];

/**
 * Error type raised when a generated SQL query violates runtime safety constraints.
 */
export class SqlSafetyError extends Error {
	readonly code: SqlSafetyErrorCode;

	/**
	 * Creates a typed SQL safety error with a stable machine-readable reason code.
	 */
	constructor(code: SqlSafetyErrorCode, message: string) {
		super(message);
		this.name = "SqlSafetyError";
		this.code = code;
	}
}

/**
 * Type guard for identifying SQL safety violations in generic error handlers.
 */
export const isSqlSafetyError = (error: unknown): error is SqlSafetyError =>
	error instanceof SqlSafetyError;
