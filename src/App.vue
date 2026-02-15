<script setup lang="ts">
import ChatShell from "./features/chat/components/ChatShell.vue";
import { useChatController } from "./features/chat/useChatController";

const controller = useChatController();
const { messages, isSending, submit } = controller;
</script>

<template>
  <ChatShell
    :messages="messages"
    :is-sending="isSending"
    @submit="submit"
  />
</template>
