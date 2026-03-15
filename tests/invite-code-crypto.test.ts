import { describe, expect, it } from "vitest";

import * as authCrypto from "../worker/src/runtime/auth/crypto";

describe("invite code crypto helpers", () => {
	it("exposes invite code normalization and hashing helpers", async () => {
		const normalizeInviteCode = (authCrypto as Record<string, unknown>)
			.normalizeInviteCode as ((value: string) => string) | undefined;
		const hashInviteCode = (authCrypto as Record<string, unknown>)
			.hashInviteCode as
			| ((secret: string, value: string) => Promise<string>)
			| undefined;

		expect(normalizeInviteCode).toBeTypeOf("function");
		expect(hashInviteCode).toBeTypeOf("function");
		if (!normalizeInviteCode || !hashInviteCode) {
			return;
		}

		expect(normalizeInviteCode("dtnk-abcd-1234")).toBe("DTNKABCD1234");
		expect(normalizeInviteCode(" DTNK ABCD 1234 ")).toBe("DTNKABCD1234");

		const hashA = await hashInviteCode("invite-secret", "dtnk-abcd-1234");
		const hashB = await hashInviteCode("invite-secret", "DTNKABCD1234");

		expect(hashA).toBe(hashB);
		expect(hashA).toMatch(/^[a-f0-9]{64}$/);
	});

	it("generates grouped invite codes", () => {
		const generateInviteCode = (authCrypto as Record<string, unknown>)
			.generateInviteCode as (() => string) | undefined;

		expect(generateInviteCode).toBeTypeOf("function");
		if (!generateInviteCode) {
			return;
		}

		const code = generateInviteCode();

		expect(code).toMatch(/^DTNK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
	});
});
