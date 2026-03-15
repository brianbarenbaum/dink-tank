const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_PREFIX = "DTNK";
const INVITE_CODE_SEGMENT_LENGTH = 4;
const INVITE_CODE_SEGMENT_COUNT = 3;

const toHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");

export const normalizeEmail = (value: string): string =>
	value.trim().toLowerCase();

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

export const normalizeInviteCode = (value: string): string =>
	value
		.trim()
		.toUpperCase()
		.replace(/[\s-]+/g, "");

export const hashInviteCode = async (
	secret: string,
	value: string,
): Promise<string> => hashWithSalt(secret, normalizeInviteCode(value));

export const generateInviteCode = (): string => {
	const length = INVITE_CODE_SEGMENT_LENGTH * INVITE_CODE_SEGMENT_COUNT;
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	const chars = Array.from(
		bytes,
		(byte) => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length],
	).join("");
	const segments = Array.from(
		{ length: INVITE_CODE_SEGMENT_COUNT },
		(_, index) =>
			chars.slice(
				index * INVITE_CODE_SEGMENT_LENGTH,
				(index + 1) * INVITE_CODE_SEGMENT_LENGTH,
			),
	);
	return [INVITE_CODE_PREFIX, ...segments].join("-");
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
