/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CHAT_BACKEND_MODE?: "real" | "mock";
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
