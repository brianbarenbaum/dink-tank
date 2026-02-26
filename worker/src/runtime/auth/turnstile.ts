import type { WorkerEnv } from "../env";

interface TurnstileVerificationResponse {
	success?: unknown;
}

export const verifyTurnstileToken = async (
	env: WorkerEnv,
	token: string | null,
	ipAddress: string,
): Promise<boolean> => {
	if (env.AUTH_TURNSTILE_BYPASS) {
		return true;
	}
	if (!env.AUTH_TURNSTILE_SECRET || !token) {
		return false;
	}

	const body = new URLSearchParams();
	body.set("secret", env.AUTH_TURNSTILE_SECRET);
	body.set("response", token);
	body.set("remoteip", ipAddress);

	let response: Response;
	try {
		response = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
				},
				body: body.toString(),
			},
		);
	} catch {
		return false;
	}

	if (!response.ok) {
		return false;
	}

	let payload: TurnstileVerificationResponse | null = null;
	try {
		payload = (await response.json()) as TurnstileVerificationResponse;
	} catch {
		return false;
	}

	return payload?.success === true;
};
