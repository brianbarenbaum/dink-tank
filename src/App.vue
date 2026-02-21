<script setup lang="ts">
import ChatShell from "./features/chat/components/ChatShell.vue";
import { useChatController } from "./features/chat/useChatController";

const controller = useChatController();
const { messages, isSending, submit, modelLabel, extendedThinking } =
	controller;
const onExtendedThinkingUpdate = (value: boolean) => {
	extendedThinking.value = value;
};
</script>

<template>
  <ChatShell
    :messages="messages"
    :is-sending="isSending"
    :model-label="modelLabel"
    :extended-thinking="extendedThinking"
    @update:extended-thinking="onExtendedThinkingUpdate"
    @submit="submit"
  />
</template>
