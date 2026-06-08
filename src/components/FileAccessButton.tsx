import { DownloadIcon, FilePdfIcon, type Icon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import clsx from "clsx";
import Cookies from "js-cookie";
import { useState } from "react";
import { navigateToFile, unlockFile } from "../lib/file";
import type { FileData } from "../types/file-data";
import { PasswordModal } from "./PasswordModal";

const variants = cva(
	"relative flex flex-row items-center gap-1 py-1 px-1 cursor-pointer rounded-sm",
	{
		variants: {
			type: {
				view: "text-red-600 dark:text-red-400 hover:bg-red-300/20",
				download:
					"text-stone-600 dark:text-stone-400 hover:bg-stone-300/20",
			},
		},
	},
);

export type FileAccessIntent = "download" | "view";

export interface FileAccessButtonProps {
	data: FileData;
	intent: FileAccessIntent;
}

const iconLookup: Record<FileAccessIntent, Icon> = {
	download: DownloadIcon,
	view: FilePdfIcon,
};
const labelLookup: Record<FileAccessIntent, string> = {
	download: "Download",
	view: "View",
};

export function FileAccessButton({ data, intent }: FileAccessButtonProps) {
	const [isVerifying, setIsVerifying] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);

	const Icon = iconLookup[intent];

	const handleClick = async () => {
		if (!data.password_hash) {
			navigateToFile(data, intent === "download");
		} else {
			const tokenCookieName = `access_token-${data.file_id}`;
			const hasToken = !!Cookies.get(tokenCookieName);

			if (hasToken) {
				setIsVerifying(true);
				const [res, status] = await unlockFile(data);
				if (status === 200) {
					navigateToFile(data, intent === "download");
				} else {
					Cookies.remove(tokenCookieName);
					setModalOpen(true);
				}

				setTimeout(
					() => {
						setIsVerifying(false);
					},
					intent === "view" ? 1000 : 200,
				);
			} else {
				setModalOpen(true);
			}
		}
	};

	return (
		<>
			<button
				className={variants({
					type: intent,
					class: [isVerifying && "pointer-events-none"],
				})}
				type="button"
				onClick={handleClick}
			>
				<span
					className={clsx(
						"m-auto inline-flex flex-row items-center gap-1",
						isVerifying && "opacity-30",
					)}
				>
					<Icon className="inline-block size-5" />
					<span className="text-xs uppercase font-semibold">
						{labelLookup[intent]}
					</span>
				</span>
				{isVerifying && (
					<span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-5">
						<span className="inline-block box-border size-5 border-4 border-white border-b-transparent rounded-full animate-spin"></span>
					</span>
				)}
			</button>
			{modalOpen && (
				<PasswordModal
					open={modalOpen}
					data={data}
					intent={intent}
					onClose={() => setModalOpen(false)}
				/>
			)}
		</>
	);
}

{
	/* <button
						className="py-1 inline-flex flex-row items-center gap-1 text-stone-600 dark:text-stone-400 cursor-pointer"
						type="button"
						onClick={handleDownloadFile}
					>
						<DownloadIcon className="inline-block size-5" />
						<span className="text-xs uppercase font-semibold">
							Download
						</span>
					</button> */
}
