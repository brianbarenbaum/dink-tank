import { createRemoteJWKSet, jwtVerify } from "jose";

import type { WorkerEnv } from "../env";

export interface VerifiedTokenContext {
	userId: string;
	email: string | null;
	expiresAt: number | null;
	issuedAt: number | null;
}

const CLOCK_SKEW_SECONDS = 60;

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const getJwks = (issuer: string): ReturnType<typeof createRemoteJWKSet> => {
	const existing = jwksByIssuer.get(issuer);
	if (existing) {
		return existing;
	}

	const endpoint = issuer.replace(/\/$/, "") + "/.well-known/jwks.json";
	const jwks = createRemoteJWKSet(new URL(endpoint));
	jwksByIssuer.set(issuer, jwks);
	return jwks;
};

export const verifyAccessToken = async (
	env: WorkerEnv,
	token: string,
): Promise<{ ok: true; value: VerifiedTokenContext } | { ok: false }> => {
	try {
		const { payload } = await jwtVerify(token, getJwks(env.AUTH_JWT_ISSUER), {
			issuer: env.AUTH_JWT_ISSUER,
			audience: env.AUTH_JWT_AUDIENCE,
			clockTolerance: CLOCK_SKEW_SECONDS,
		});
		const now = Math.floor(Date.now() / 1000);
		if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
			return { ok: false };
		}
		if (
			typeof payload.iat === "number" &&
			payload.iat > now + CLOCK_SKEW_SECONDS
		) {
			return { ok: false };
		}
		if (
			typeof payload.nbf === "number" &&
			payload.nbf > now + CLOCK_SKEW_SECONDS
		) {
			return { ok: false };
		}

		return {
			ok: true,
			value: {
				userId: payload.sub,
				email: typeof payload.email === "string" ? payload.email : null,
				expiresAt: typeof payload.exp === "number" ? payload.exp : null,
				issuedAt: typeof payload.iat === "number" ? payload.iat : null,
			},
		};
	} catch {
		return { ok: false };
	}
};
