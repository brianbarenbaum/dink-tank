<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import TurnstileWidget from "../features/auth/TurnstileWidget.vue";
import { useAuthStore } from "../stores/auth";

interface TurnstileWidgetExpose {
	execute: () => Promise<void>;
	reset: () => void;
}

const OTP_RESEND_SECONDS = 60;

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const code = ref("");
const email = ref("");
const resendCountdown = ref(OTP_RESEND_SECONDS);
const isVerifying = ref(false);
const isResending = ref(false);
const errorMessage = ref<string | null>(null);
const turnstileToken = ref<string | null>(null);
const pendingResend = ref(false);
const turnstileRef = ref<TurnstileWidgetExpose | null>(null);
let timerId: number | null = null;

const turnstileBypass = import.meta.env.VITE_AUTH_TURNSTILE_BYPASS === "true";
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
const requiresTurnstile = computed(
	() => !turnstileBypass && turnstileSiteKey.trim().length > 0,
);

const safeRedirect = (value: string | null): string => {
	if (!value) {
		return "/chat";
	}
	if (!value.startsWith("/") || value.startsWith("//")) {
		return "/chat";
	}
	return value;
};

const startCountdown = () => {
	if (timerId !== null) {
		window.clearInterval(timerId);
	}
	timerId = window.setInterval(() => {
		if (resendCountdown.value <= 0) {
			if (timerId !== null) {
				window.clearInterval(timerId);
				timerId = null;
			}
			return;
		}
		resendCountdown.value -= 1;
	}, 1_000);
};

const verifyCode = async () => {
	if (!code.value.trim() || isVerifying.value) {
		return;
	}
	errorMessage.value = null;
	isVerifying.value = true;
	try {
		await authStore.verifyOtp(email.value, code.value.trim());
		const redirect =
			typeof route.query.redirect === "string" ? route.query.redirect : null;
		await router.replace(safeRedirect(redirect));
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("retry_after:")) {
			const retryAfter = Number(error.message.split(":")[1] ?? "0");
			errorMessage.value =
				retryAfter > 0
					? `Please wait ${retryAfter} seconds before trying again.`
					: "Please wait before trying again.";
		} else {
			errorMessage.value = "Invalid code or code expired. Request a new code.";
		}
	} finally {
		isVerifying.value = false;
	}
};

const submitResend = async (token: string | null) => {
	if (isResending.value || resendCountdown.value > 0) {
		return;
	}
	isResending.value = true;
	errorMessage.value = null;
	try {
		const result = await authStore.requestOtp(email.value, token);
		resendCountdown.value = Math.max(1, result.resendAfterSeconds);
		startCountdown();
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("retry_after:")) {
			const retryAfter = Number(error.message.split(":")[1] ?? "0");
			resendCountdown.value = retryAfter > 0 ? retryAfter : OTP_RESEND_SECONDS;
			startCountdown();
			errorMessage.value = "Please wait before requesting another code.";
		} else {
			errorMessage.value = "Unable to resend code right now.";
		}
	} finally {
		isResending.value = false;
		pendingResend.value = false;
		if (requiresTurnstile.value) {
			turnstileRef.value?.reset();
			turnstileToken.value = null;
		}
	}
};

const resendCode = async () => {
	if (resendCountdown.value > 0 || isResending.value) {
		return;
	}
	if (!requiresTurnstile.value) {
		await submitResend(null);
		return;
	}
	pendingResend.value = true;
	if (turnstileToken.value) {
		await submitResend(turnstileToken.value);
		return;
	}
	await turnstileRef.value?.execute();
};

const onTurnstileToken = (token: string | null) => {
	turnstileToken.value = token;
	if (token && pendingResend.value) {
		void submitResend(token);
	}
};

const onTurnstileError = () => {
	errorMessage.value = "Unable to validate the challenge. Try again.";
	pendingResend.value = false;
};

onMounted(() => {
	const queryEmail = typeof route.query.email === "string" ? route.query.email : null;
	email.value = queryEmail ?? authStore.pendingEmail ?? "";
	if (!email.value) {
		void router.replace({
			path: "/auth/login",
			query: {
				...(typeof route.query.redirect === "string"
					? { redirect: route.query.redirect }
					: {}),
			},
		});
		return;
	}
	startCountdown();
});

onBeforeUnmount(() => {
	if (timerId !== null) {
		window.clearInterval(timerId);
	}
});
</script>

<template>
  <main class="chat-root min-h-screen px-4 py-12">
    <section class="mx-auto max-w-md rounded-xl border border-[var(--chat-divider)] bg-[color:var(--chat-panel)] p-6 md:p-8">
      <h1 class="text-lg font-semibold uppercase tracking-[0.18em]">Verify Code</h1>
      <p class="mt-2 text-sm text-[var(--chat-muted)]">
        Enter the 6-digit code sent to {{ email }}.
      </p>

      <form
        class="mt-6 space-y-4"
        @submit.prevent="verifyCode"
      >
        <label class="block space-y-2">
          <span class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--chat-muted)]">One-time code</span>
          <input
            v-model="code"
            autocomplete="one-time-code"
            class="h-11 w-full rounded-md border border-[var(--chat-divider)] bg-transparent px-3 text-sm tracking-[0.25em]"
            data-testid="auth-otp-code-input"
            inputmode="numeric"
            maxlength="6"
            required
            type="text"
          >
        </label>

        <TurnstileWidget
          ref="turnstileRef"
          :enabled="requiresTurnstile"
          :site-key="turnstileSiteKey"
          @token="onTurnstileToken"
          @error="onTurnstileError"
        />

        <p
          v-if="errorMessage"
          class="text-sm text-red-300"
          data-testid="auth-verify-error"
        >
          {{ errorMessage }}
        </p>

        <button
          :disabled="isVerifying"
          class="h-11 w-full rounded-md border border-[var(--chat-divider)] text-xs font-semibold uppercase tracking-[0.16em] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="auth-verify-otp-button"
          type="submit"
        >
          {{ isVerifying ? "Verifying..." : "Sign In" }}
        </button>
      </form>

      <div class="mt-6 flex items-center justify-between">
        <button
          :disabled="resendCountdown > 0 || isResending"
          class="h-10 rounded-md border border-[var(--chat-divider)] px-3 text-xs font-semibold uppercase tracking-[0.14em] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="auth-resend-otp-button"
          type="button"
          @click="resendCode"
        >
          {{ isResending ? "Sending..." : "Resend code" }}
        </button>
        <span class="text-xs text-[var(--chat-muted)]">
          {{ resendCountdown > 0 ? `Available in ${resendCountdown}s` : "You can resend now" }}
        </span>
      </div>
    </section>
  </main>
</template>
