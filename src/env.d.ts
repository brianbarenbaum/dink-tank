/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CHAT_BACKEND_MODE?: "real" | "mock";
	readonly VITE_AUTH_BYPASS?: "true" | "false";
	readonly VITE_AUTH_TURNSTILE_BYPASS?: "true" | "false";
	readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface TurnstileRenderOptions {
	sitekey: string;
	size?: "normal" | "compact" | "invisible" | "flexible";
	callback?: (token: string) => void;
	"expired-callback"?: () => void;
	"error-callback"?: () => void;
}

interface TurnstileApi {
	render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
	reset: (widgetId: string) => void;
	execute: (widgetId: string) => void;
	remove: (widgetId: string) => void;
}

interface Window {
	turnstile?: TurnstileApi;
}
