<script setup lang="ts">
import { ref } from "vue";

interface ChatComposerProps {
	isSending?: boolean;
}

const props = withDefaults(defineProps<ChatComposerProps>(), {
	isSending: false,
});

const emit = defineEmits<{
	submit: [value: string];
}>();

const draft = ref("");

const onSubmit = () => {
	const value = draft.value.trim();
	if (!value || props.isSending) {
		return;
	}

	emit("submit", value);
	draft.value = "";
};
</script>

<template>
  <form data-testid="chat-composer" class="rounded-lg border p-3" @submit.prevent="onSubmit">
    <label for="chat-command" class="sr-only">Enter command</label>
    <div class="flex items-center gap-3">
      <input
        id="chat-command"
        v-model="draft"
        type="text"
        class="h-12 flex-1 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
        placeholder="Enter command..."
        :disabled="isSending"
      />
      <button
        type="submit"
        class="h-12 rounded-md border px-4 text-sm font-semibold uppercase tracking-wide cursor-pointer"
        :disabled="isSending"
      >
        Send
      </button>
    </div>
  </form>
</template>
