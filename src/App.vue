<script setup lang="ts">
import ChatShell from "./features/chat/components/ChatShell.vue";
import { useChatController } from "./features/chat/useChatController";

const controller = useChatController();
</script>

<template>
  <ChatShell
    :messages="controller.messages"
    :is-sending="controller.isSending"
    @submit="controller.submit"
  />
</template>
