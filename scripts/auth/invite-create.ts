import {
	generateInviteCode,
	hashInviteCode,
} from "../../worker/src/runtime/auth/crypto.ts";
import { createInviteCode } from "../../worker/src/runtime/auth/repository.ts";
import { loadAuthScriptEnv, resolveInviteExpiration } from "./shared.ts";

const run = async (): Promise<void> => {
	const env = await loadAuthScriptEnv();
	const expiresAt = resolveInviteExpiration(process.argv.slice(2));
	const inviteCode = generateInviteCode();
	const codeHash = await hashInviteCode(
		env.AUTH_INVITE_CODE_HASH_SECRET,
		inviteCode,
	);
	const created = await createInviteCode(env, {
		codeHash,
		expiresAt,
	});

	console.log(`Invite code: ${inviteCode}`);
	console.log(`Expires at: ${created.expiresAt.toISOString()}`);
	console.log("Previous active code, if any, was deactivated.");
};

void run().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Failed to create invite code",
	);
	process.exit(1);
});
