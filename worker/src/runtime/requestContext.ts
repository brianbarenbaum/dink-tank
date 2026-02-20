export interface RequestContext {
	requestId: string;
	startMs: number;
	path: string;
}

/**
 * Generates a stable request identifier for log and telemetry correlation.
 */
const createRequestId = (): string => {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Builds per-request context metadata used across runtime modules.
 */
export const createRequestContext = (request: Request): RequestContext => {
	const url = new URL(request.url);
	return {
		requestId: createRequestId(),
		startMs: Date.now(),
		path: url.pathname,
	};
};
