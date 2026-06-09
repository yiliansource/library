const encoder = new TextEncoder();

export const COOKIE_MAX_AGE = 60;
export const LONG_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function createToken(
	secret: string,
	long = false,
): Promise<string> {
	const payload = {
		exp:
			Math.floor(Date.now() / 1000) +
			(long ? LONG_COOKIE_MAX_AGE : COOKIE_MAX_AGE),
	};

	const payloadBase64 = base64url(encoder.encode(JSON.stringify(payload)));
	const signature = await hmac(secret, payloadBase64);

	return `${payloadBase64}.${signature}`;
}

export async function verifyToken(
	secret: string,
	token: string | null,
): Promise<boolean> {
	if (!token) return false;

	const [payloadBase64, signature] = token.split(".");
	if (!payloadBase64 || !signature) return false;

	const expectedSignature = await hmac(secret, payloadBase64);

	if (!timingSafeEqual(signature, expectedSignature)) {
		return false;
	}

	try {
		const payloadJson = new TextDecoder().decode(
			fromBase64url(payloadBase64),
		);
		const payload = JSON.parse(payloadJson) as { exp?: number };
		if (!payload.exp) return false;

		return payload.exp > Math.floor(Date.now() / 1000);
	} catch {
		return false;
	}
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of arr) binary += String.fromCharCode(byte);

	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function fromBase64url(input: string): Uint8Array {
	const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
	const padded = base64.padEnd(
		base64.length + ((4 - (base64.length % 4)) % 4),
		"=",
	);
	const binary = atob(padded);

	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(message),
	);
	return base64url(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return diff === 0;
}
