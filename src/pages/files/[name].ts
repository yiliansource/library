import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

type FileRow = {
	file_id: string;
	file_name: string;
	password_hash: string | null;
	updated_at: string;
};

function html(body: string, status = 200) {
	return new Response(body, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}

function passwordForm(id: string, error?: string) {
	return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Protected file</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <main style="max-width: 32rem; margin: 4rem auto; font-family: system-ui, sans-serif;">
      <h1>Protected file</h1>
      ${error ? `<p style="color: crimson;">${error}</p>` : ""}
      <form method="post" action="/files/${encodeURIComponent(id)}" autocomplete="off">
        <label>
          Password
          <input type="password" name="password" required autofocus autocomplete="off" />
        </label>
        <button type="submit">Open file</button>
      </form>
    </main>
  </body>
</html>`);
}

async function getFileRow(fileName: string): Promise<FileRow | null> {
	return await env.library_data
		.prepare(`
      SELECT file_id, file_name, password_hash, updated_at
      FROM files
      WHERE file_name = ?
      LIMIT 1
    `)
		.bind(fileName)
		.first<FileRow>();
}

async function streamR2File(row: FileRow): Promise<Response> {
	const object = await env.library_files.get(row.file_name);

	if (!object) {
		return new Response("File object not found", { status: 404 });
	}

	const headers = new Headers();

	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);

	headers.set(
		"Content-Type",
		object.httpMetadata?.contentType || "application/pdf",
	);

	headers.set(
		"Content-Disposition",
		`inline; filename="${encodeURIComponent(row.file_name)}"`,
	);

	headers.set(
		"Cache-Control",
		row.password_hash ? "no-store" : "private, max-age=300",
	);

	return new Response(object.body, { headers });
}

async function verifyPassword(
	password: string,
	passwordHash: string,
): Promise<boolean> {
	const parts = passwordHash.split(":");

	if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") {
		throw new Error("Unsupported password hash format");
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

function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	return bytesToArrayBuffer(base64ToBytes(base64));
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;

	let result = 0;

	for (let i = 0; i < a.length; i++) {
		result |= a[i] ^ b[i];
	}

	return result === 0;
}

export const GET: APIRoute = async ({ params }) => {
	const name = params.name;

	if (!name) {
		return new Response("Missing name", { status: 400 });
	}

	const row = await getFileRow(name);

	if (!row) {
		return new Response("Not found", { status: 404 });
	}

	if (row.password_hash) {
		return passwordForm(name);
	}

	return streamR2File(row);
};

export const POST: APIRoute = async ({ params, request }) => {
	const name = params.name;

	if (!name) {
		return new Response("Missing name", { status: 400 });
	}

	const row = await getFileRow(name);

	if (!row) {
		return new Response("Not found", { status: 404 });
	}

	if (!row.password_hash) {
		return streamR2File(row);
	}

	const formData = await request.formData();
	const password = String(formData.get("password") || "");

	if (!password) {
		return passwordForm(name, "Please enter a password.");
	}

	let ok = false;

	try {
		ok = await verifyPassword(password, row.password_hash);
	} catch (e) {
		console.error(e);
		return new Response(
			"Password verification is not configured correctly" +
				"\n" +
				(e as Error).message,
			{
				status: 500,
			},
		);
	}

	if (!ok) {
		return passwordForm(name, "Incorrect password.");
	}

	return streamR2File(row);
};
