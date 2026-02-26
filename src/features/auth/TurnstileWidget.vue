<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

interface TurnstileWidgetProps {
	siteKey: string;
	enabled: boolean;
}

const props = defineProps<TurnstileWidgetProps>();

const emit = defineEmits<{
	token: [token: string | null];
	error: [];
}>();

const containerRef = ref<HTMLElement | null>(null);
const widgetId = ref<string | null>(null);

let scriptPromise: Promise<void> | null = null;

const ensureScript = async (): Promise<void> => {
	if (!props.enabled) {
		return;
	}
	if (typeof window === "undefined") {
		return;
	}
	if (window.turnstile) {
		return;
	}
	if (scriptPromise) {
		return scriptPromise;
	}

	scriptPromise = new Promise<void>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
		);
		if (existing) {
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener("error", () => reject(new Error("turnstile_script_failed")), {
				once: true,
			});
			return;
		}

		const script = document.createElement("script");
		script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
		script.async = true;
		script.defer = true;
		script.addEventListener("load", () => resolve(), { once: true });
		script.addEventListener("error", () => reject(new Error("turnstile_script_failed")), {
			once: true,
		});
		document.head.appendChild(script);
	});

	return scriptPromise;
};

const renderWidget = async (): Promise<void> => {
	if (!props.enabled || !props.siteKey || !containerRef.value) {
		return;
	}
	await ensureScript();
	if (!window.turnstile || !containerRef.value) {
		return;
	}
	widgetId.value = window.turnstile.render(containerRef.value, {
		sitekey: props.siteKey,
		size: "invisible",
		callback: (token: string) => {
			emit("token", token);
		},
		"expired-callback": () => {
			emit("token", null);
		},
		"error-callback": () => {
			emit("token", null);
			emit("error");
		},
	});
};

const execute = async (): Promise<void> => {
	if (!props.enabled) {
		emit("token", null);
		return;
	}
	if (!widgetId.value) {
		await renderWidget();
	}
	if (widgetId.value && window.turnstile) {
		window.turnstile.execute(widgetId.value);
	}
};

const reset = (): void => {
	if (widgetId.value && window.turnstile) {
		window.turnstile.reset(widgetId.value);
	}
	emit("token", null);
};

defineExpose({ execute, reset });

onMounted(() => {
	void renderWidget();
});

onBeforeUnmount(() => {
	if (widgetId.value && window.turnstile) {
		window.turnstile.remove(widgetId.value);
	}
});
</script>

<template>
  <div
    v-if="enabled"
    ref="containerRef"
    class="min-h-[1px]"
    data-testid="turnstile-widget"
  />
</template>
