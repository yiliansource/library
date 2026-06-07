import {
	CheckIcon,
	DownloadIcon,
	FilePdfIcon,
	LockIcon,
	SpinnerIcon,
	XIcon,
} from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";
import type { FileData } from "../types/file-data";

export interface FileItemProps {
	data: FileData;
}

type PasswordModalIntent = "none" | "view" | "download";

const navigateToFile = (data: FileData, download: boolean = false) =>
	(window.location.href = `/files/${data.file_name}${download ? "?download=1" : ""}`);

export function FileItem({ data }: FileItemProps) {
	const [passwordModalIntent, setPasswordModalIntent] =
		useState<PasswordModalIntent>("none");

	const handleViewFile = () => {
		if (data.password_hash) {
			setPasswordModalIntent("view");
		} else {
			navigateToFile(data);
		}
	};
	const handleDownloadFile = () => {
		if (data.password_hash) {
			setPasswordModalIntent("download");
		} else {
			navigateToFile(data, true);
		}
	};

	return (
		<>
			<div className="group px-3 py-6 flex flex-col hover:bg-black/5 dark:hover:bg-white/5">
				<div>
					<div className="float-right ml-2 pt-1">
						<p className="text-sm text-muted">
							{new Date(data.updated_at).toLocaleDateString(
								"en-US",
								{
									year: "numeric",
									month: "long",
									day: "numeric",
								},
							)}
						</p>
					</div>
					<div>
						<p className="text-xl font-semibold">
							{data.display_name}
						</p>
						<p className="mb-2 text-sm inline-flex flex-row flex-wrap text-muted">
							{[
								...(data.tags
									?.split(",")
									.map((s) => s.trim()) ?? []),
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
				<div className="flex flex-row flex-wrap items-center">
					<button
						className="py-1 mr-3 inline-flex flex-row items-center gap-1 text-red-600 dark:text-red-400 cursor-pointer"
						type="button"
						onClick={handleViewFile}
					>
						<FilePdfIcon className="inline-block size-5" />
						<span className="text-xs uppercase font-semibold">
							View
						</span>
					</button>
					<button
						className="py-1 inline-flex flex-row items-center gap-1 text-stone-600 dark:text-stone-400 cursor-pointer"
						type="button"
						onClick={handleDownloadFile}
					>
						<DownloadIcon className="inline-block size-5" />
						<span className="text-xs uppercase font-semibold">
							Download
						</span>
					</button>
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
			<PasswordModal
				open={passwordModalIntent !== "none"}
				intent={passwordModalIntent}
				data={data}
				onClose={() => setPasswordModalIntent("none")}
			/>
		</>
	);
}

function PasswordModal({
	open,
	data,
	intent,
	onClose,
}: {
	open: boolean;
	data: FileData;
	intent: PasswordModalIntent;
	onClose?: () => void;
}) {
	const [passwordInput, setPasswordInput] = useState("");
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [passwordSubmitting, setPasswordSubmitting] = useState(false);
	const [passwordSuccess, setPasswordSuccess] = useState(false);

	const passwordInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => {
				passwordInputRef.current?.focus();
			});
		} else {
			setPasswordInput("");
			setPasswordError(null);
			setPasswordSubmitting(false);
			setPasswordSuccess(false);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose?.();
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [open, onClose]);

	const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setPasswordInput(e.target.value);
	};
	const handleClosePrompt = () => {
		onClose?.();

		setPasswordSubmitting(false);
		setPasswordSuccess(false);
	};
	const handleSubmitPrompt = async () => {
		if (passwordSubmitting) return;

		setPasswordSubmitting(true);
		const res = await fetch(`/unlock/${data.file_name}`, {
			method: "POST",
			body: JSON.stringify({
				password: passwordInput,
			}),
		});

		if (res.status === 401) {
			setPasswordError("Invalid password.");
			setPasswordSuccess(false);
		} else if (res.status === 200) {
			setPasswordSuccess(true);
			navigateToFile(data, intent === "download");

			setTimeout(() => {
				onClose?.();
			}, 500);
		}
		setPasswordSubmitting(false);
	};

	return (
		open && (
			<div className="flex fixed inset-0 bg-black/50">
				<form
					className="relative m-auto w-full max-w-sm bg-background px-6 py-8 rounded-sm"
					onClick={(e) => void e.stopPropagation()}
					onSubmit={(e) => {
						e.preventDefault();
						void handleSubmitPrompt();
					}}
				>
					<p className="mb-4">
						A password is required to {intent}{" "}
						<span className="font-semibold">
							{data.display_name}
						</span>
						.
					</p>
					<div className="mb-4">
						<label
							className="text-sm text-muted"
							htmlFor="password"
						>
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							autoComplete="off"
							value={passwordInput}
							ref={passwordInputRef}
							onChange={handlePasswordChange}
							className="border border-neutral-300 rounded-sm w-full px-2 py-1"
						/>
						{passwordError && (
							<p className="mt-1 text-red-500 text-sm">
								{passwordError}
							</p>
						)}
					</div>
					<button
						type="button"
						className="inline-flex items-center justify-center gap-2 w-full bg-neutral-600 text-white rounded-sm px-2 py-1 cursor-pointer disabled:opacity-50"
						onClick={handleSubmitPrompt}
						disabled={passwordSubmitting || passwordSuccess}
					>
						<span>Access</span>
						{passwordSubmitting ? (
							<SpinnerIcon className="animate-spin" />
						) : passwordSuccess ? (
							<CheckIcon className="text-green-400" />
						) : (
							<LockIcon />
						)}
					</button>
					<button
						className="absolute top-0 right-0 m-2 p-2 cursor-pointer"
						type="button"
						onClick={handleClosePrompt}
					>
						<XIcon />
					</button>
				</form>
			</div>
		)
	);
}
