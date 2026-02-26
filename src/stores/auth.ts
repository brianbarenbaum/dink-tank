import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { createAuthClient } from "../features/auth/authClient";
import type { AuthSession } from "../features/auth/types";

const SESSION_STORAGE_KEY = "dink_tank.auth.session.v1";
const PENDING_EMAIL_KEY = "dink_tank.auth.pending_email.v1";
const REFRESH_LEEWAY_SECONDS = 60;

const authClient = createAuthClient(fetch);

const parseSession = (raw: string | null): AuthSession | null => {
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as AuthSession;
		if (
			typeof parsed.accessToken !== "string" ||
			typeof parsed.refreshToken !== "string" ||
			typeof parsed.expiresAt !== "number" ||
			typeof parsed.user?.id !== "string"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
};

const serializeSession = (session: AuthSession | null): string | null => {
	if (!session) {
		return null;
	}
	return JSON.stringify(session);
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const useAuthStore = defineStore("auth", () => {
	const status = ref<"bootstrapping" | "authenticated" | "unauthenticated">(
		"bootstrapping",
	);
	const hasBootstrapped = ref(false);
	const session = ref<AuthSession | null>(null);
	const pendingEmail = ref<string | null>(null);
	let bootstrapPromise: Promise<void> | null = null;
	let refreshPromise: Promise<AuthSession | null> | null = null;
	let storageListenerBound = false;

	const isAuthBypassEnabled =
		import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS === "true";

	const isAuthenticated = computed(() => status.value === "authenticated");
	const accessToken = computed(() => session.value?.accessToken ?? null);

	const persistSession = (value: AuthSession | null) => {
		session.value = value;
		if (typeof window === "undefined") {
			return;
		}
		const serialized = serializeSession(value);
		if (!serialized) {
			window.localStorage.removeItem(SESSION_STORAGE_KEY);
			return;
		}
		window.localStorage.setItem(SESSION_STORAGE_KEY, serialized);
	};

	const persistPendingEmail = (value: string | null) => {
		pendingEmail.value = value;
		if (typeof window === "undefined") {
			return;
		}
		if (!value) {
			window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
			return;
		}
		window.sessionStorage.setItem(PENDING_EMAIL_KEY, value);
	};

	const clearSession = () => {
		persistSession(null);
		persistPendingEmail(null);
		status.value = "unauthenticated";
	};

	const bindStorageListener = () => {
		if (storageListenerBound || typeof window === "undefined") {
			return;
		}
		window.addEventListener("storage", (event) => {
			if (event.key === SESSION_STORAGE_KEY) {
				const incoming = parseSession(event.newValue);
				session.value = incoming;
				status.value = incoming ? "authenticated" : "unauthenticated";
			}
			if (event.key === PENDING_EMAIL_KEY) {
				pendingEmail.value = event.newValue ? normalizeEmail(event.newValue) : null;
			}
		});
		storageListenerBound = true;
	};

	const refreshSession = async (): Promise<AuthSession | null> => {
		if (isAuthBypassEnabled) {
			return session.value;
		}
		if (!session.value?.refreshToken) {
			clearSession();
			return null;
		}
		if (refreshPromise) {
			return refreshPromise;
		}
		refreshPromise = (async () => {
			try {
				const nextSession = await authClient.refresh({
					refreshToken: session.value?.refreshToken ?? "",
				});
				persistSession(nextSession);
				status.value = "authenticated";
				return nextSession;
			} catch {
				clearSession();
				return null;
			} finally {
				refreshPromise = null;
			}
		})();
		return refreshPromise;
	};

	const bootstrap = async (): Promise<void> => {
		bindStorageListener();
		if (hasBootstrapped.value) {
			return;
		}
		if (bootstrapPromise) {
			return bootstrapPromise;
		}
		bootstrapPromise = (async () => {
			try {
				if (isAuthBypassEnabled) {
					status.value = "authenticated";
					session.value = {
						accessToken: "",
						refreshToken: "",
						expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
						user: {
							id: "local-auth-bypass-user",
							email: "local-bypass@example.com",
						},
					};
					return;
				}

				if (typeof window !== "undefined") {
					persistPendingEmail(window.sessionStorage.getItem(PENDING_EMAIL_KEY));
				}
				const stored =
					typeof window === "undefined"
						? null
						: parseSession(window.localStorage.getItem(SESSION_STORAGE_KEY));
				if (!stored) {
					status.value = "unauthenticated";
					return;
				}

				persistSession(stored);
				try {
					const result = await authClient.getSession(stored.accessToken);
					if (result.authenticated) {
						status.value = "authenticated";
						if (result.session?.expiresAt) {
							persistSession({
								...stored,
								expiresAt: result.session.expiresAt,
								user: result.session.user,
							});
						}
						return;
					}
				} catch {
					// fall through to refresh
				}

				const refreshed = await refreshSession();
				status.value = refreshed ? "authenticated" : "unauthenticated";
			} finally {
				hasBootstrapped.value = true;
			}
		})();

		try {
			await bootstrapPromise;
		} finally {
			bootstrapPromise = null;
		}
	};

	const requestOtp = async (
		email: string,
		turnstileToken: string | null,
	): Promise<{ resendAfterSeconds: number }> => {
		const normalized = normalizeEmail(email);
		const result = await authClient.requestOtp({
			email: normalized,
			turnstileToken,
		});
		persistPendingEmail(normalized);
		return result;
	};

	const verifyOtp = async (email: string, code: string): Promise<void> => {
		const next = await authClient.verifyOtp({
			email: normalizeEmail(email),
			code,
		});
		persistSession(next);
		persistPendingEmail(null);
		status.value = "authenticated";
	};

	const signOut = async (): Promise<void> => {
		try {
			await authClient.signOut({
				accessToken: session.value?.accessToken ?? null,
				refreshToken: session.value?.refreshToken ?? null,
			});
		} finally {
			clearSession();
		}
	};

	const getTokenForRequest = async (): Promise<string | null> => {
		if (isAuthBypassEnabled) {
			return null;
		}
		if (!session.value) {
			return null;
		}
		const now = Math.floor(Date.now() / 1000);
		if (session.value.expiresAt - now <= REFRESH_LEEWAY_SECONDS) {
			const refreshed = await refreshSession();
			return refreshed?.accessToken ?? null;
		}
		return session.value.accessToken;
	};

	const refreshAfterUnauthorized = async (): Promise<boolean> => {
		const refreshed = await refreshSession();
		return Boolean(refreshed?.accessToken);
	};

	return {
		status,
		session,
		pendingEmail,
		isAuthenticated,
		accessToken,
		bootstrap,
		requestOtp,
		verifyOtp,
		signOut,
		getTokenForRequest,
		refreshAfterUnauthorized,
		clearSession,
		isAuthBypassEnabled,
	};
});
