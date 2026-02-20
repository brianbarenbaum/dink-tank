import type { RequestContext } from "./requestContext";

type LogLevel = "info" | "warn" | "error";

type LogData = Record<string, unknown>;

/**
 * Emits a single structured log line enriched with request context metadata.
 */
const emit = (
	level: LogLevel,
	message: string,
	context: RequestContext,
	data: LogData = {},
): void => {
	const payload = {
		level,
		message,
		requestId: context.requestId,
		path: context.path,
		...data,
	};
	const line = JSON.stringify(payload);
	if (level === "error") {
		console.error(line);
		return;
	}
	if (level === "warn") {
		console.warn(line);
		return;
	}
	console.log(line);
};

/**
 * Logs an informational runtime event.
 */
export const logInfo = (
	message: string,
	context: RequestContext,
	data?: LogData,
): void => {
	emit("info", message, context, data);
};

/**
 * Logs a warning runtime event.
 */
export const logWarn = (
	message: string,
	context: RequestContext,
	data?: LogData,
): void => {
	emit("warn", message, context, data);
};

/**
 * Logs an error runtime event.
 */
export const logError = (
	message: string,
	context: RequestContext,
	data?: LogData,
): void => {
	emit("error", message, context, data);
};
