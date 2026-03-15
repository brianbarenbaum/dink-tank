import { afterEach, describe, expect, it, vi } from "vitest";

const originalArgv = [...process.argv];
const originalEnv = { ...process.env };
const originalExitCode = process.exitCode;

const restoreProcessState = (): void => {
	process.argv = [...originalArgv];
	process.exitCode = originalExitCode;

	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) {
			delete process.env[key];
		}
	}

	for (const [key, value] of Object.entries(originalEnv)) {
		process.env[key] = value;
	}
};

const runCliModule = async (options?: {
	env?: Record<string, string | undefined>;
	pipelineError?: Error;
}): Promise<string> => {
	restoreProcessState();
	vi.resetModules();
	vi.restoreAllMocks();

	const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	const ingestCrossClub = options?.pipelineError
		? vi.fn().mockRejectedValue(options.pipelineError)
		: vi.fn().mockResolvedValue(undefined);

	vi.doMock("../data-ingestion/pipeline.ts", () => ({
		ingestCrossClub,
	}));

	process.argv = [
		"node",
		"/home/brian/repositories/dink-tank/data-ingestion/run.ts",
		"bootstrap",
		"players",
	];

	delete process.env.SUPABASE_URL;
	delete process.env.SUPABASE_SERVICE_ROLE_KEY;

	for (const [key, value] of Object.entries(options?.env ?? {})) {
		if (typeof value === "undefined") {
			delete process.env[key];
			continue;
		}
		process.env[key] = value;
	}

	await import("../data-ingestion/run.ts");
	await new Promise((resolve) => setTimeout(resolve, 0));

	return consoleError.mock.calls.flat().join("\n");
};

afterEach(() => {
	restoreProcessState();
	vi.restoreAllMocks();
	vi.resetModules();
});

describe("crossclub ingest runner", () => {
	it("prints env setup guidance when required Supabase vars are missing", async () => {
		const output = await runCliModule();

		expect(output).toContain(
			"Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
		);
		expect(output).toContain(".envrc");
		expect(output).toContain('source "$HOME/.config/dink-tank/env"');
		expect(output).toContain("direnv allow");
	});

	it("prints env status and setup guidance when the CrossClub fetch fails", async () => {
		const output = await runCliModule({
			env: {
				SUPABASE_URL: "https://example.supabase.co",
				SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
			},
			pipelineError: new TypeError("fetch failed"),
		});

		expect(output).toContain(
			"CrossClub request failed before a response was received: fetch failed",
		);
		expect(output).toContain(
			"Env check: SUPABASE_URL=set, SUPABASE_SERVICE_ROLE_KEY=set",
		);
		expect(output).toContain('source "$HOME/.config/dink-tank/env"');
	});
});
