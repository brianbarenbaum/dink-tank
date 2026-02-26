import type { Pinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

import AuthLoginPage from "../pages/AuthLoginPage.vue";
import AuthVerifyPage from "../pages/AuthVerifyPage.vue";
import ProtectedShellPage from "../pages/ProtectedShellPage.vue";
import { useAuthStore } from "../stores/auth";

const isSafeRedirect = (value: string): boolean =>
	value.startsWith("/") && !value.startsWith("//");

export const createAppRouter = (pinia: Pinia) => {
	const router = createRouter({
		history: createWebHistory(),
		routes: [
			{
				path: "/auth/login",
				component: AuthLoginPage,
				meta: { public: true },
			},
			{
				path: "/auth/verify",
				component: AuthVerifyPage,
				meta: { public: true },
			},
			{
				path: "/chat",
				component: ProtectedShellPage,
				meta: { requiresAuth: true },
			},
			{
				path: "/lineup-lab",
				component: ProtectedShellPage,
				meta: { requiresAuth: true },
			},
			{
				path: "/",
				redirect: "/chat",
			},
			{
				path: "/:pathMatch(.*)*",
				redirect: "/chat",
			},
		],
	});

	router.beforeEach(async (to) => {
		const authStore = useAuthStore(pinia);
		await authStore.bootstrap();

		const isPublicRoute = Boolean(to.meta.public);
		if (authStore.isAuthBypassEnabled) {
			if (isPublicRoute) {
				return "/chat";
			}
			return true;
		}

		if (!isPublicRoute && !authStore.isAuthenticated) {
			return {
				path: "/auth/login",
				query: {
					redirect: to.fullPath,
				},
			};
		}

		if (isPublicRoute && authStore.isAuthenticated) {
			const redirectQuery =
				typeof to.query.redirect === "string" ? to.query.redirect : null;
			if (redirectQuery && isSafeRedirect(redirectQuery)) {
				return redirectQuery;
			}
			return "/chat";
		}

		return true;
	});

	return router;
};
