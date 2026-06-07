import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
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

async function streamR2File(
	row: FileData,
	download: boolean = false,
): Promise<Response> {
	const object = await env.library_files.get(row.file_name);

	if (!object) {
		return new Response("File object not found.", { status: 404 });
	}

	const disposition = download ? "attachment" : "inline";

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set(
		"Content-Type",
		object.httpMetadata?.contentType || "application/pdf",
	);
	headers.set(
		"Content-Disposition",
		`${disposition}; filename="${encodeURIComponent(row.file_name)}"`,
	);
	headers.set("Cache-Control", "private, no-store");

	return new Response(object.body, { headers });
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

async function verifyToken(
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

export const GET: APIRoute = async ({ params, request, cookies }) => {
	const name = params.name;

	if (!name) {
		return new Response("Missing name.", { status: 400 });
	}

	const row = await getFileRow(name);
	if (!row) {
		return new Response("Not found.", { status: 404 });
	}

	if (row.password_hash) {
		const cookie = cookies.get(`access_token-${row.file_id}`);
		if (!cookie) {
			return new Response("Access token missing.", { status: 401 });
		}

		const valid = await verifyToken(env.COOKIE_SECRET, cookie.value);
		if (!valid) {
			return new Response("Invalid access token.", { status: 401 });
		}
	}

	const requestUrl = new URL(request.url);

	return streamR2File(row, requestUrl.searchParams.get("download") === "1");
};
