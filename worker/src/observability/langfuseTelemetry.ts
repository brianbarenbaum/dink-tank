import type { WorkerEnv } from "../runtime/env";

type TelemetryPayload = Record<string, unknown>;
interface EmitTelemetryOptions {
	input?: unknown;
	output?: unknown;
}

export interface TelemetryEmitResult {
	ok: boolean;
	reason?:
		| "disabled"
		| "missing_config"
		| "http_error"
		| "timeout"
		| "network_error";
	statusCode?: number;
}

const withTimeout = async <T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> => {
	let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
	const timeout = new Promise<never>((_, reject) => {
		timeoutHandle = setTimeout(() => {
			reject(new Error(`langfuse timeout after ${timeoutMs}ms`));
		}, timeoutMs);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		if (timeoutHandle) {
			clearTimeout(timeoutHandle);
		}
	}
};

const sanitizePayload = (payload: TelemetryPayload): TelemetryPayload => {
	const next: TelemetryPayload = {};
	for (const [key, value] of Object.entries(payload)) {
		if (value === undefined) {
			continue;
		}
		next[key] = value;
	}
	return next;
};

const toBase64 = (input: string): string => {
	if (typeof btoa === "function") {
		return btoa(input);
	}
	const nodeBuffer = (
		globalThis as {
			Buffer?: {
				from: (value: string) => { toString: (encoding: string) => string };
			};
		}
	).Buffer;
	if (nodeBuffer) {
		return nodeBuffer.from(input).toString("base64");
	}
	throw new Error("No base64 encoder available");
};

const createUuid = (): string => {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const emitLangfuseTelemetry = async (
	env: WorkerEnv,
	name: string,
	payload: TelemetryPayload,
	options: EmitTelemetryOptions = {},
): Promise<TelemetryEmitResult> => {
	if (!env.LANGFUSE_ENABLED) {
		return { ok: false, reason: "disabled" };
	}
	const publicKey = env.LANGFUSE_PUBLIC_KEY;
	const secretKey = env.LANGFUSE_SECRET_KEY;
	const baseUrl = env.LANGFUSE_BASE_URL;
	if (!publicKey || !secretKey || !baseUrl) {
		return { ok: false, reason: "missing_config" };
	}

	const now = new Date().toISOString();
	const traceId = createUuid();
	const eventId = createUuid();
	const safePayload = sanitizePayload(payload);

	try {
		const response = await withTimeout(
			fetch(`${baseUrl.replace(/\/$/, "")}/api/public/ingestion`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Basic ${toBase64(`${publicKey}:${secretKey}`)}`,
					"x-langfuse-public-key": publicKey,
				},
				body: JSON.stringify({
					batch: [
						{
							type: "trace-create",
							id: eventId,
							timestamp: now,
							body: {
								id: traceId,
								timestamp: now,
								name,
								environment: env.LANGFUSE_TRACING_ENVIRONMENT,
								input: options.input,
								output: options.output,
								metadata: safePayload,
								tags: [
									"worker-chat",
									String(payload.orchestrator ?? "unknown"),
								],
							},
						},
					],
				}),
			}),
			1_500,
		);
		if (!response.ok) {
			return { ok: false, reason: "http_error", statusCode: response.status };
		}
		return { ok: true };
	} catch (error) {
		// Best-effort telemetry only; never fail chat requests due to tracing.
		const message =
			error instanceof Error ? error.message.toLowerCase() : String(error);
		if (message.includes("timeout")) {
			return { ok: false, reason: "timeout" };
		}
		return { ok: false, reason: "network_error" };
	}
};
