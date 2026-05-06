import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
	base64ToArrayBuffer,
	base64ToBytes,
	bytesToArrayBuffer,
	timingSafeEqualBytes,
} from "../../lib/bytes";
import type { FileData } from "../../types/file-data";

export const prerender = false;

async function getFileRow(fileName: string): Promise<FileData | null> {
	return await env.library_data
		.prepare(`
      SELECT file_id, file_name, password_hash, updated_at
      FROM files
      WHERE file_name = ?
      LIMIT 1
    `)
		.bind(fileName)
		.first<FileData>();
}

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let binary = "";
	for (const byte of arr) binary += String.fromCharCode(byte);

	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
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

async function createToken(secret: string): Promise<string> {
	const payload = {
		exp: Math.floor(Date.now() / 1000) + 15 * 60,
	};

	const payloadBase64 = base64url(encoder.encode(JSON.stringify(payload)));
	const signature = await hmac(secret, payloadBase64);

	return `${payloadBase64}.${signature}`;
}

async function verifyPassword(
	password: string,
	passwordHash: string,
): Promise<boolean> {
	const parts = passwordHash.split(":");
	if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") {
		throw new Error("Unsupported password hash format.");
	}

	const iterations = Number(parts[1]);
	const salt = base64ToArrayBuffer(parts[2]);
	const expectedHash = base64ToBytes(parts[3]);

	if (!Number.isSafeInteger(iterations) || iterations < 100_000) {
		throw new Error("Invalid PBKDF2 iteration count");
	}

	const passwordBytes = new TextEncoder().encode(password);
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		bytesToArrayBuffer(passwordBytes),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt,
			iterations,
		},
		keyMaterial,
		expectedHash.length * 8,
	);

	const actualHash = new Uint8Array(derivedBits);

	return timingSafeEqualBytes(actualHash, expectedHash);
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
	const name = params.name;
	if (!name) {
		return new Response("Missing name.", { status: 400 });
	}

	const row = await getFileRow(name);
	if (!row) {
		return new Response("Not found.", { status: 404 });
	}

	if (!row.password_hash) {
		return new Response("File already unlocked.", { status: 200 });
	}

	const body = (await request.json()) as { password?: string };
	const password = String(body.password ?? "");

	let ok = false;
	try {
		ok = await verifyPassword(password, row.password_hash);
	} catch (e) {
		console.error(e);
		return new Response("An error occurred while verifying the password.", {
			status: 500,
		});
	}

	if (ok) {
		const token = await createToken(env.COOKIE_SECRET);
		cookies.set(`access_token-${row.file_id}`, token, {
			path: "/",
			maxAge: 60 * 15,
			httpOnly: true,
		});
		return new Response("OK!", { status: 200 });
	} else {
		return new Response("PASSWORD_INVALID", { status: 401 });
	}
};
