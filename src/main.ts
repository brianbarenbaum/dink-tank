import { createPinia } from "pinia";
import { createApp } from "vue";

import RootApp from "./RootApp.vue";
import { createAppRouter } from "./router";
import "./style.css";

const app = createApp(RootApp);
const pinia = createPinia();
const router = createAppRouter(pinia);

app.use(pinia);
app.use(router);
app.mount("#app");
