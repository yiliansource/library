import type { APIRoute } from "astro";
import { siteConfig } from "../site.config";

export const GET: APIRoute = () => {
	return new Response(
		JSON.stringify({
			id: "/",
			name: siteConfig.name,
			short_name: "library",
			description: siteConfig.description,
			start_url: "/",
			scope: "/",
			display: "standalone",
			background_color: "#fafafa",
			theme_color: "#111827",
			icons: [
				{
					src: "/android-chrome-192x192.png",
					sizes: "192x192",
					type: "image/png",
				},
				{
					src: "/android-chrome-192x192.png",
					sizes: "512x512",
					type: "image/png",
					purpose: "any maskable",
				},
			],
		}),
		{
			headers: {
				"Content-Type": "application/manifest+json; charset=utf-8",
			},
		},
	);
};
