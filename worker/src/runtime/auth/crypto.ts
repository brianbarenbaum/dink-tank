const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const isValidEmail = (value: string): boolean =>
	EMAIL_PATTERN.test(normalizeEmail(value));

export const hashWithSalt = async (
	salt: string,
	value: string,
): Promise<string> => {
	const input = new TextEncoder().encode(`${salt}:${value}`);
	const digest = await crypto.subtle.digest("SHA-256", input);
	return toHex(new Uint8Array(digest));
};

export const getRequestIpAddress = (request: Request): string => {
	const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
	if (cfConnectingIp) {
		return cfConnectingIp;
	}

	const xForwardedFor = request.headers.get("x-forwarded-for")?.trim();
	if (xForwardedFor) {
		const first = xForwardedFor.split(",")[0]?.trim();
		if (first) {
			return first;
		}
	}

	return "unknown";
};
