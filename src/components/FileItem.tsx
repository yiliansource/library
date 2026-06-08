import React from "react";
import type { FileData } from "../types/file-data";
import { FileAccessButton } from "./FileAccessButton";

export interface FileItemProps {
	data: FileData;
}

export function FileItem({ data }: FileItemProps) {
	return (
		<div className="group px-3 py-6 flex flex-col">
			<div>
				<div className="float-right ml-2 pt-1">
					<p className="text-sm text-muted">
						{new Date(data.updated_at).toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</p>
				</div>
				<div>
					<p className="text-xl font-semibold">{data.display_name}</p>
					<p className="mb-2 text-sm inline-flex flex-row flex-wrap text-muted">
						{[
							...(data.tags?.split(",").map((s) => s.trim()) ??
								[]),
							new Date(data.updated_at).getFullYear(),
						].map((l, i, a) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: keys wont change
							<React.Fragment key={i}>
								<span>{l}</span>
								{i + 1 !== a.length && (
									<span className="mx-1">·</span>
								)}
							</React.Fragment>
						))}
					</p>
				</div>
			</div>
			<p className="mb-4">{data.description}</p>
			<div className="flex flex-row flex-wrap items-center select-none">
				<div className="-ml-1 flex flex-row items-center gap-2">
					<FileAccessButton data={data} intent="view" />
					<FileAccessButton data={data} intent="download" />
				</div>

				{data.wip && (
					<span className="text-sm text-muted">
						<span className="mx-2">·</span>
						<span>Work in progress</span>
					</span>
				)}
				{data.password_hash && (
					<span className="text-sm text-muted">
						<span className="mx-2">·</span>
						<span>Password required</span>
					</span>
				)}
			</div>
		</div>
	);
}
