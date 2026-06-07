import { env } from "cloudflare:workers";
import rss, { type RSSFeedItem } from "@astrojs/rss";
import type { APIRoute } from "astro";
import { siteConfig } from "../site.config";
import type { FileData } from "../types/file-data";

export const GET: APIRoute = async (ctx) => {
	const { results } = await env.library_data
		.prepare("SELECT * FROM files")
		.run<FileData>();

	return rss({
		title: siteConfig.name,
		description: siteConfig.description,
		site: siteConfig.url,
		items: results.map(
			(r) =>
				({
					title: r.display_name ?? undefined,
					author: "Ian Hornik",
					description: r.description ?? undefined,
					pubDate: r.updated_at ? new Date(r.updated_at) : undefined,
					link: `${siteConfig.url}/files/${r.file_name}`,
				}) satisfies RSSFeedItem,
		),
		customData: `<language>en-us</language>`,
	});
};
