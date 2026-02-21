<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ChevronDown } from "lucide-vue-next";

interface ChatComposerProps {
	isSending?: boolean;
	modelLabel?: string;
	extendedThinking?: boolean;
}

const props = withDefaults(defineProps<ChatComposerProps>(), {
	isSending: false,
	modelLabel: "Unknown model",
	extendedThinking: false,
});

const emit = defineEmits<{
	submit: [value: string];
	"update:extended-thinking": [value: boolean];
}>();

const draft = ref("");
const menuOpen = ref(false);
const menuEl = ref<HTMLElement | null>(null);

const onSubmit = () => {
	const value = draft.value.trim();
	if (!value || props.isSending) {
		return;
	}

	emit("submit", value);
	draft.value = "";
};

const toggleMenu = () => {
	menuOpen.value = !menuOpen.value;
};

const toggleExtendedThinking = () => {
	emit("update:extended-thinking", !props.extendedThinking);
};

const onDocumentClick = (event: MouseEvent) => {
	if (!menuOpen.value || !menuEl.value) {
		return;
	}

	const target = event.target;
	if (target instanceof Node && !menuEl.value.contains(target)) {
		menuOpen.value = false;
	}
};

onMounted(() => {
	document.addEventListener("click", onDocumentClick);
});

onUnmounted(() => {
	document.removeEventListener("click", onDocumentClick);
});
</script>

<template>
  <form
    data-testid="chat-composer"
    class="sticky bottom-0 z-10 shrink-0 rounded-lg border p-4 backdrop-blur-xs"
    @submit.prevent="onSubmit"
  >
    <label for="chat-command" class="sr-only">Enter command</label>
    <div class="flex items-center gap-3">
      <input
        id="chat-command"
        v-model="draft"
        type="text"
        class="h-14 flex-1 rounded-md border px-4 text-sm focus-visible:outline-none focus-visible:ring-2"
        placeholder="Enter command..."
        :disabled="isSending"
      />
      <button
        type="submit"
        class="h-14 rounded-md border px-4 text-sm font-semibold uppercase tracking-wide cursor-pointer"
        :disabled="isSending"
      >
        Send
      </button>
    </div>
    <div class="mt-3 flex items-center justify-end">
      <div
        ref="menuEl"
        class="relative"
      >
        <button
          type="button"
          data-testid="chat-model-label"
          class="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold cursor-pointer"
          @click.stop="toggleMenu"
        >
          <span>{{ modelLabel }}</span>
          <span v-if="extendedThinking" class="text-[var(--chat-muted)]">Extended thinking on</span>
          <ChevronDown
            data-testid="model-menu-caret"
            class="h-3.5 w-3.5 transition-transform"
            :class="menuOpen ? 'rotate-180' : 'rotate-0'"
          />
        </button>
        <div
          v-if="menuOpen"
          data-testid="model-menu"
          class="absolute bottom-11 right-0 z-20 w-64 rounded-lg border bg-[color-mix(in_oklab,var(--chat-panel),black_12%)] p-3 shadow-lg"
        >
          <div class="space-y-3 text-sm">
            <div>
              <p class="text-xs uppercase tracking-[0.12em] text-[var(--chat-muted)]">Model</p>
              <p class="mt-1 font-semibold">{{ modelLabel }}</p>
            </div>
            <button
              type="button"
              data-testid="toggle-extended-thinking"
              class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left cursor-pointer"
              @click="toggleExtendedThinking"
            >
              <span class="text-xs font-semibold uppercase tracking-[0.12em]">Extended thinking</span>
              <span
                class="relative inline-flex h-6 w-11 items-center rounded-full border transition-colors"
                :class="extendedThinking ? 'bg-[var(--chat-glow)]' : 'bg-[var(--chat-panel)]'"
              >
                <span
                  class="inline-block h-4 w-4 rounded-full bg-[var(--chat-bg)] transition-transform"
                  :class="extendedThinking ? 'translate-x-6' : 'translate-x-1'"
                />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </form>
</template>
