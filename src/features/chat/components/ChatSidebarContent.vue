<script setup lang="ts">
import { Pencil } from "lucide-vue-next";
</script>

<template>
  <div
    data-testid="chat-sidebar-content"
    class="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden"
  >
    <section class="shrink-0 space-y-3">
      <button
        type="button"
        data-testid="desktop-new-chat"
        class="inline-flex h-12 items-center gap-2 rounded-md px-1 text-left text-sm font-semibold tracking-wide cursor-pointer"
        title="New chat"
      >
        <Pencil class="h-4 w-4" />
        New Chat
      </button>
    </section>
  </div>
</template>
