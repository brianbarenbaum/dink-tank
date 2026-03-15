import { deactivateActiveInviteCode } from "../../worker/src/runtime/auth/repository.ts";
import { loadAuthScriptEnv } from "./shared.ts";

const run = async (): Promise<void> => {
	const env = await loadAuthScriptEnv();
	const deactivated = await deactivateActiveInviteCode(env);
	if (!deactivated) {
		console.log("No active invite code to deactivate.");
		return;
	}

	console.log(`Deactivated active invite code record ${deactivated.id}.`);
};

void run().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Failed to deactivate invite code",
	);
	process.exit(1);
});
