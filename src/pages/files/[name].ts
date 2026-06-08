import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import type { FileData } from "../../types/file-data";
import { verifyToken } from "../../lib/tokens";

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
