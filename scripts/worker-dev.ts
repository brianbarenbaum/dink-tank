import { spawn } from "node:child_process";

import { loadAuthScriptEnv, loadWorkerDevProcessEnv } from "./auth/shared.ts";

const run = async (): Promise<void> => {
	await loadAuthScriptEnv();
	const spawnEnv = await loadWorkerDevProcessEnv();
	const wranglerArgs = [
		"dev",
		"--config",
		"worker/wrangler.toml",
		...process.argv.slice(2),
	];

	const child = spawn("wrangler", wranglerArgs, {
		stdio: "inherit",
		env: spawnEnv,
	});

	await new Promise<void>((resolve, reject) => {
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (signal) {
				process.kill(process.pid, signal);
				return;
			}
			if (typeof code === "number") {
				process.exitCode = code;
			}
			resolve();
		});
	});
};

void run().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Failed to start worker dev",
	);
	process.exit(1);
});
