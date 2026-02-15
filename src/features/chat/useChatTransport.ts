// Kept separate from UI orchestration so streaming transport can be introduced later.
export function useChatTransport() {
	return {
		mode: "request-response" as const,
	};
}
