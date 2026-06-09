import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import * as z from "zod";
import {
	base64ToArrayBuffer,
	base64ToBytes,
	bytesToArrayBuffer,
	timingSafeEqualBytes,
} from "../../lib/bytes";
import {
	COOKIE_MAX_AGE,
	createToken,
	LONG_COOKIE_MAX_AGE,
	verifyToken,
} from "../../lib/tokens";
import type { FileData } from "../../types/file-data";

export const prerender = false;

export enum FileUnlockResponse {
	OK = "OK",
	OK_NOT_LOCKED = "OK_NOT_LOCKED",
	OK_ALREADY_UNLOCKED = "OK_ALREADY_UNLOCKED",
	PASSWORD_INVALID = "PASSWORD_INVALID",
	MISSING_NAME = "MISSING_NAME",
	NOT_FOUND = "NOT_FOUND",
	VERIFICATION_ERROR = "VERIFICATION_ERROR",
}

const FileUnlockSchema = z.object({
	password: z.string().optional(),
	remember: z.boolean().optional(),
});

export type FileUnlockSchema = z.infer<typeof FileUnlockSchema>;

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

async function verifyPassword(
	password: string,
	passwordHash: string,
): Promise<boolean> {
	const parts = passwordHash.split(":");
	if (parts.length !== 4) throw new Error("Malformed password hash.");

	const [hashFormat, iterationsText, saltBase64, expectedHashBase64] = parts;
	if (hashFormat !== "pbkdf2-sha256")
		throw new Error("Unsupported password hash format.");

	const iterations = Number(iterationsText);
	const salt = base64ToArrayBuffer(saltBase64);
	const expectedHash = base64ToBytes(expectedHashBase64);

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

function createUnlockResponse(response: FileUnlockResponse) {
	const statusCodeLookup: Record<FileUnlockResponse, number> = {
		OK: 200,
		OK_NOT_LOCKED: 200,
		OK_ALREADY_UNLOCKED: 200,
		PASSWORD_INVALID: 401,
		MISSING_NAME: 400,
		NOT_FOUND: 404,
		VERIFICATION_ERROR: 500,
	};
	return new Response(response, { status: statusCodeLookup[response] });
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
	const name = params.name;
	if (!name) return createUnlockResponse(FileUnlockResponse.MISSING_NAME);

	const row = await getFileRow(name);
	if (!row) return createUnlockResponse(FileUnlockResponse.NOT_FOUND);
	if (!row.password_hash)
		return createUnlockResponse(FileUnlockResponse.OK_NOT_LOCKED);

	const body = await request.json();
	const parsedBody = z.parse(FileUnlockSchema, body);

	const accessTokenCookie = `access_token-${row.file_id}`;

	let ok = false;
	if (!parsedBody.password) {
		const accessToken = cookies.get(accessTokenCookie);
		if (accessToken) {
			ok = await verifyToken(env.COOKIE_SECRET, accessToken.value);
		}
	} else {
		try {
			ok = await verifyPassword(parsedBody.password, row.password_hash);
		} catch (e) {
			console.error(e);
			return createUnlockResponse(FileUnlockResponse.VERIFICATION_ERROR);
		}
	}

	if (ok) {
		const token = await createToken(
			env.COOKIE_SECRET,
			!!parsedBody.remember,
		);
		cookies.set(accessTokenCookie, token, {
			path: "/",
			maxAge: parsedBody.remember ? LONG_COOKIE_MAX_AGE : COOKIE_MAX_AGE,
		});

		return createUnlockResponse(FileUnlockResponse.OK);
	} else {
		return createUnlockResponse(FileUnlockResponse.PASSWORD_INVALID);
	}
};
