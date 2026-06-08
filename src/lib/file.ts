import type {
	FileUnlockResponse,
	FileUnlockSchema,
} from "../pages/unlock/[name]";
import type { FileData } from "../types/file-data";

export const navigateToFile = (data: FileData, download: boolean = false) =>
	(window.location.href = `/files/${data.file_name}${download ? "?download=1" : ""}`);

export async function unlockFile(
	data: FileData,
	password?: string,
	remember?: boolean,
): Promise<[FileUnlockResponse, number]> {
	const res = await fetch(`/unlock/${data.file_name}`, {
		method: "POST",
		body: JSON.stringify({
			password,
			remember,
		} satisfies FileUnlockSchema),
	});

	const fileUnlockResponse = (await res.text()) as FileUnlockResponse;
	return [fileUnlockResponse, res.status];
}
