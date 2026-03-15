<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import TurnstileWidget from "../features/auth/TurnstileWidget.vue";
import { useAuthStore } from "../stores/auth";

interface TurnstileWidgetExpose {
	execute: () => Promise<void>;
	reset: () => void;
}

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref(authStore.pendingEmail ?? "");
const inviteCode = ref("");
const isSubmitting = ref(false);
const isCheckingEligibility = ref(false);
const errorMessage = ref<string | null>(null);
const turnstileToken = ref<string | null>(null);
const pendingSubmission = ref(false);
const inviteRequired = ref(false);
const inviteRequiredEmail = ref<string | null>(null);
const turnstileRef = ref<TurnstileWidgetExpose | null>(null);

const redirectTarget = computed(() =>
	typeof route.query.redirect === "string" ? route.query.redirect : null,
);

const turnstileBypass = import.meta.env.VITE_AUTH_TURNSTILE_BYPASS === "true";
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
const requiresTurnstile = computed(
	() => !turnstileBypass && turnstileSiteKey.trim().length > 0,
);
const isBusy = computed(
	() => isSubmitting.value || isCheckingEligibility.value,
);
const submitLabel = computed(() => {
	if (isSubmitting.value) {
		return "Sending...";
	}
	if (isCheckingEligibility.value) {
		return "Checking...";
	}
	return inviteRequired.value ? "Send Code" : "Continue";
});

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

watch(email, (value) => {
	const normalized = normalizeEmail(value);
	if (inviteRequiredEmail.value && inviteRequiredEmail.value !== normalized) {
		inviteRequired.value = false;
		inviteRequiredEmail.value = null;
		inviteCode.value = "";
		errorMessage.value = null;
	}
});

const submitOtpRequest = async (token: string | null) => {
	errorMessage.value = null;
	isSubmitting.value = true;
	try {
		await authStore.requestOtp(
			email.value,
			token,
			inviteRequired.value ? inviteCode.value.trim() : null,
		);
		await router.push({
			path: "/auth/verify",
			query: {
				email: normalizeEmail(email.value),
				...(redirectTarget.value ? { redirect: redirectTarget.value } : {}),
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("retry_after:")) {
			const retryAfter = Number(error.message.split(":")[1] ?? "0");
			errorMessage.value =
				retryAfter > 0
					? `Please wait ${retryAfter} seconds before requesting another code.`
					: "Please wait before requesting another code.";
		} else {
			errorMessage.value = "Unable to send a code right now. Try again.";
		}
	} finally {
		isSubmitting.value = false;
		pendingSubmission.value = false;
		if (requiresTurnstile.value) {
			turnstileRef.value?.reset();
			turnstileToken.value = null;
		}
	}
};

const ensureLoginEligible = async (): Promise<boolean> => {
	if (inviteRequired.value) {
		return true;
	}

	isCheckingEligibility.value = true;
	errorMessage.value = null;
	try {
		const result = await authStore.startLogin(email.value);
		if (result.status === "invite_required") {
			inviteRequired.value = true;
			inviteRequiredEmail.value = normalizeEmail(email.value);
			return false;
		}
		return true;
	} catch {
		errorMessage.value = "Unable to continue right now. Try again.";
		return false;
	} finally {
		isCheckingEligibility.value = false;
	}
};

const onSubmit = async () => {
	if (!email.value.trim() || isBusy.value) {
		return;
	}
	if (!(await ensureLoginEligible())) {
		return;
	}
	if (inviteRequired.value && !inviteCode.value.trim()) {
		errorMessage.value = "Enter the invite code to continue.";
		return;
	}
	if (!requiresTurnstile.value) {
		await submitOtpRequest(null);
		return;
	}
	pendingSubmission.value = true;
	if (turnstileToken.value) {
		await submitOtpRequest(turnstileToken.value);
		return;
	}
	await turnstileRef.value?.execute();
};

const onTurnstileToken = (token: string | null) => {
	turnstileToken.value = token;
	if (token && pendingSubmission.value) {
		void submitOtpRequest(token);
	}
};

const onTurnstileError = () => {
	errorMessage.value = "Unable to validate the challenge. Try again.";
	pendingSubmission.value = false;
};
</script>

<template>
  <main class="chat-root min-h-screen px-4 py-12">
    <section class="mx-auto max-w-md rounded-xl border border-[var(--chat-divider)] bg-[color:var(--chat-panel)] p-6 md:p-8">
      <h1 class="text-lg font-semibold uppercase tracking-[0.18em]">Sign In</h1>
      <p class="mt-2 text-sm text-[var(--chat-muted)]">
        Enter your email and we will send a one-time code.
      </p>
      <p
        v-if="inviteRequired"
        class="mt-2 text-sm text-[var(--chat-muted)]"
      >
        This email needs the current group invite code before we can send a sign-in code.
      </p>

      <form
        class="mt-6 space-y-4"
        @submit.prevent="onSubmit"
      >
        <label class="block space-y-2">
          <span class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--chat-muted)]">Email</span>
          <input
            v-model="email"
            autocomplete="email"
            class="h-11 w-full rounded-md border border-[var(--chat-divider)] bg-transparent px-3 text-sm"
            data-testid="auth-email-input"
            inputmode="email"
            required
            type="email"
          >
        </label>

        <label
          v-if="inviteRequired"
          class="block space-y-2"
        >
          <span class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--chat-muted)]">Invite code</span>
          <input
            v-model="inviteCode"
            autocomplete="one-time-code"
            class="h-11 w-full rounded-md border border-[var(--chat-divider)] bg-transparent px-3 text-sm uppercase tracking-[0.16em]"
            data-testid="auth-invite-code-input"
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
          data-testid="auth-login-error"
        >
          {{ errorMessage }}
        </p>

        <button
          :disabled="isBusy"
          class="h-11 w-full rounded-md border border-[var(--chat-divider)] text-xs font-semibold uppercase tracking-[0.16em] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="auth-request-otp-button"
          type="submit"
        >
          {{ submitLabel }}
        </button>
      </form>
    </section>
  </main>
</template>
