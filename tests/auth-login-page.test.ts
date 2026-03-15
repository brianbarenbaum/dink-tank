import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authStore, push, route } = vi.hoisted(() => ({
	authStore: {
		pendingEmail: null as string | null,
		startLogin: vi.fn(),
		requestOtp: vi.fn(),
	},
	push: vi.fn(),
	route: {
		query: {
			redirect: "/lineup-lab",
		},
	},
}));

vi.mock("../src/stores/auth", () => ({
	useAuthStore: () => authStore,
}));

vi.mock("vue-router", () => ({
	useRouter: () => ({
		push,
	}),
	useRoute: () => route,
}));

import AuthLoginPage from "../src/pages/AuthLoginPage.vue";

describe("auth login page", () => {
	beforeEach(() => {
		authStore.pendingEmail = null;
		authStore.startLogin.mockReset();
		authStore.requestOtp.mockReset();
		push.mockReset();
		push.mockResolvedValue(undefined);
		route.query = {
			redirect: "/lineup-lab",
		};
	});

	it("submits email through login-start before requesting OTP", async () => {
		authStore.startLogin.mockResolvedValue({ status: "invite_required" });
		const wrapper = mount(AuthLoginPage, {
			global: {
				stubs: {
					TurnstileWidget: true,
				},
			},
		});

		await wrapper
			.get("[data-testid='auth-email-input']")
			.setValue("New@Example.com");
		await wrapper.get("form").trigger("submit.prevent");
		await flushPromises();

		expect(authStore.startLogin).toHaveBeenCalledWith("New@Example.com");
		expect(authStore.requestOtp).not.toHaveBeenCalled();
	});

	it("reveals an invite-code field when login-start requires it", async () => {
		authStore.startLogin.mockResolvedValue({ status: "invite_required" });
		const wrapper = mount(AuthLoginPage, {
			global: {
				stubs: {
					TurnstileWidget: true,
				},
			},
		});

		await wrapper
			.get("[data-testid='auth-email-input']")
			.setValue("new@example.com");
		await wrapper.get("form").trigger("submit.prevent");
		await flushPromises();

		expect(
			wrapper.find("[data-testid='auth-invite-code-input']").exists(),
		).toBe(true);
		expect(push).not.toHaveBeenCalled();
	});

	it("submits invite code and navigates only after OTP is sent", async () => {
		authStore.startLogin.mockResolvedValue({ status: "invite_required" });
		authStore.requestOtp.mockResolvedValue({
			status: "otp_sent",
			resendAfterSeconds: 60,
		});
		const wrapper = mount(AuthLoginPage, {
			global: {
				stubs: {
					TurnstileWidget: true,
				},
			},
		});

		await wrapper
			.get("[data-testid='auth-email-input']")
			.setValue("new@example.com");
		await wrapper.get("form").trigger("submit.prevent");
		await flushPromises();
		await wrapper
			.get("[data-testid='auth-invite-code-input']")
			.setValue("DTNK-ABCD-EFGH-IJKL");
		await wrapper.get("form").trigger("submit.prevent");
		await flushPromises();

		expect(authStore.requestOtp).toHaveBeenCalledWith(
			"new@example.com",
			null,
			"DTNK-ABCD-EFGH-IJKL",
		);
		expect(push).toHaveBeenCalledWith({
			path: "/auth/verify",
			query: {
				email: "new@example.com",
				redirect: "/lineup-lab",
			},
		});
	});

	it("keeps the approved-email flow direct to verify", async () => {
		authStore.startLogin.mockResolvedValue({ status: "approved" });
		authStore.requestOtp.mockResolvedValue({
			status: "otp_sent",
			resendAfterSeconds: 60,
		});
		const wrapper = mount(AuthLoginPage, {
			global: {
				stubs: {
					TurnstileWidget: true,
				},
			},
		});

		await wrapper
			.get("[data-testid='auth-email-input']")
			.setValue("friend@example.com");
		await wrapper.get("form").trigger("submit.prevent");
		await flushPromises();

		expect(authStore.startLogin).toHaveBeenCalledWith("friend@example.com");
		expect(authStore.requestOtp).toHaveBeenCalledWith(
			"friend@example.com",
			null,
			null,
		);
		expect(push).toHaveBeenCalledWith({
			path: "/auth/verify",
			query: {
				email: "friend@example.com",
				redirect: "/lineup-lab",
			},
		});
	});
});
