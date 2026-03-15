import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
	loadAuthScriptEnv,
	loadWorkerDevProcessEnv,
	resolveInviteExpiration,
} from "../scripts/auth/shared.ts";

const tempPaths: string[] = [];

afterEach(async () => {
	await Promise.all(
		tempPaths.splice(0).map((path) => rm(path, { recursive: true })),
	);
});

describe("auth invite script helpers", () => {
	it("defaults invite expiration to 30 days when --expires-at is omitted", () => {
		const nowMs = Date.UTC(2026, 2, 15, 17, 17, 40);

		const expiresAt = resolveInviteExpiration([], nowMs);

		expect(expiresAt.toISOString()).toBe("2026-04-14T17:17:40.000Z");
	});

	it("uses the provided --expires-at value when present", () => {
		const expiresAt = resolveInviteExpiration([
			"--expires-at",
			"2026-04-01T00:00:00Z",
		]);

		expect(expiresAt.toISOString()).toBe("2026-04-01T00:00:00.000Z");
	});

	it("loads script env from the env file and seeds a missing invite secret", async () => {
		const root = await mkdtemp(join(tmpdir(), "dink-tank-auth-"));
		tempPaths.push(root);
		const envFilePath = join(root, "env");
		const workerDevVarsPath = join(root, "worker.dev.vars");
		await writeFile(
			envFilePath,
			"SUPABASE_DB_URL=postgres://db.example/postgres\nSQL_QUERY_TIMEOUT_MS=15000\n",
			"utf8",
		);

		const env = await loadAuthScriptEnv({
			env: {} as NodeJS.ProcessEnv,
			envFilePath,
			workerDevVarsPath,
			generateSecret: () => "generated-secret",
		});
		const saved = await readFile(envFilePath, "utf8");
		const workerSaved = await readFile(workerDevVarsPath, "utf8");

		expect(env.SUPABASE_DB_URL).toBe("postgres://db.example/postgres");
		expect(env.SQL_QUERY_TIMEOUT_MS).toBe(15_000);
		expect(env.AUTH_INVITE_CODE_HASH_SECRET).toBe("generated-secret");
		expect(saved).toContain("AUTH_INVITE_CODE_HASH_SECRET=generated-secret");
		expect(workerSaved).toContain(
			"AUTH_INVITE_CODE_HASH_SECRET=generated-secret",
		);
	});

	it("reuses the existing invite secret from the env file", async () => {
		const root = await mkdtemp(join(tmpdir(), "dink-tank-auth-"));
		tempPaths.push(root);
		const envFilePath = join(root, "env");
		const workerDevVarsPath = join(root, "worker.dev.vars");
		await writeFile(
			envFilePath,
			[
				"SUPABASE_DB_URL=postgres://db.example/postgres",
				"AUTH_INVITE_CODE_HASH_SECRET=existing-secret",
				"",
			].join("\n"),
			"utf8",
		);

		const env = await loadAuthScriptEnv({
			env: {} as NodeJS.ProcessEnv,
			envFilePath,
			workerDevVarsPath,
			generateSecret: () => {
				throw new Error("should not generate a new secret");
			},
		});
		const saved = await readFile(envFilePath, "utf8");
		const workerSaved = await readFile(workerDevVarsPath, "utf8");

		expect(env.AUTH_INVITE_CODE_HASH_SECRET).toBe("existing-secret");
		expect(saved.match(/AUTH_INVITE_CODE_HASH_SECRET=/g)).toHaveLength(1);
		expect(workerSaved).toContain(
			"AUTH_INVITE_CODE_HASH_SECRET=existing-secret",
		);
	});

	it("uses the local Hyperdrive connection string when SUPABASE_DB_URL is absent", async () => {
		const root = await mkdtemp(join(tmpdir(), "dink-tank-auth-"));
		tempPaths.push(root);
		const envFilePath = join(root, "env");
		const workerDevVarsPath = join(root, "worker.dev.vars");
		await writeFile(
			envFilePath,
			[
				"CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://hyperdrive.example/postgres",
				"AUTH_INVITE_CODE_HASH_SECRET=existing-secret",
				"",
			].join("\n"),
			"utf8",
		);

		const env = await loadAuthScriptEnv({
			env: {} as NodeJS.ProcessEnv,
			envFilePath,
			workerDevVarsPath,
		});

		expect(env.SUPABASE_DB_URL).toBe("postgres://hyperdrive.example/postgres");
		expect(env.SUPABASE_DB_SSL_NO_VERIFY).toBe(true);
	});

	it("loads worker dev vars into the spawned Wrangler environment", async () => {
		const root = await mkdtemp(join(tmpdir(), "dink-tank-auth-"));
		tempPaths.push(root);
		const workerDevVarsPath = join(root, "worker.dev.vars");
		await writeFile(
			workerDevVarsPath,
			[
				"SUPABASE_DB_URL=postgres://db.example/postgres",
				"CHAT_SUPABASE_DB_URL=postgres://chat.example/postgres",
				"AUTH_INVITE_CODE_HASH_SECRET=existing-secret",
				"",
			].join("\n"),
			"utf8",
		);

		const env = await loadWorkerDevProcessEnv({
			env: {} as NodeJS.ProcessEnv,
			workerDevVarsPath,
		});

		expect(env.SUPABASE_DB_URL).toBe("postgres://db.example/postgres");
		expect(env.CHAT_SUPABASE_DB_URL).toBe("postgres://chat.example/postgres");
		expect(env.AUTH_INVITE_CODE_HASH_SECRET).toBe("existing-secret");
	});
});
