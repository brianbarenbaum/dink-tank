import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppRouter } from "../src/router";
import { useAuthStore } from "../src/stores/auth";

const SESSION_STORAGE_KEY = "dink_tank.auth.session.v1";

const createSessionFixture = () => ({
	accessToken: "access-token",
	refreshToken: "refresh-token",
	expiresAt: Math.floor(Date.now() / 1000) + 60 * 30,
	user: {
		id: "user-123",
		email: "user@example.com",
	},
});

describe("router auth guard", () => {
	beforeEach(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it("redirects unauthenticated users from protected routes to login", async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const router = createAppRouter(pinia);

		await router.push("/chat");

		expect(router.currentRoute.value.path).toBe("/auth/login");
		expect(router.currentRoute.value.query.redirect).toBe("/chat");
	});

	it("redirects authenticated users away from public auth routes", async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const authStore = useAuthStore(pinia);
		authStore.status = "authenticated";
		authStore.session = createSessionFixture();
		vi.spyOn(authStore, "bootstrap").mockResolvedValue();
		const router = createAppRouter(pinia);

		await router.push("/auth/login?redirect=/lineup-lab");

		expect(router.currentRoute.value.path).toBe("/lineup-lab");
	});
});
