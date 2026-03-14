<script setup lang="ts">
import DataBrowserTree from "../../chat/components/DataBrowserTree.vue";
import type { DataBrowserController } from "../../chat/data-browser/useDataBrowserController";

interface PropsDataBrowserSidebarContent {
	controller: DataBrowserController;
}

const props = defineProps<PropsDataBrowserSidebarContent>();
</script>

<template>
  <div
    data-testid="data-browser-sidebar-content"
    class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
  >
    <nav
      data-testid="data-browser-sidebar-scroll-region"
      class="chat-scrollbar min-h-0 flex-1 overflow-y-auto pr-1"
      aria-label="Data browser tree"
    >
      <DataBrowserTree :controller="props.controller" />
    </nav>
  </div>
</template>
