import { CheckIcon, LockIcon, SpinnerIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { navigateToFile, unlockFile } from "../lib/file";
import type { FileData } from "../types/file-data";
import type { FileAccessIntent } from "./FileAccessButton";

export interface PasswordModalProps {
	open: boolean;
	data: FileData;
	intent: FileAccessIntent;
	onClose?: () => void;
}

export function PasswordModal({
	open,
	data,
	intent,
	onClose,
}: PasswordModalProps) {
	const [passwordInput, setPasswordInput] = useState("");
	const [rememberInput, setRememberInput] = useState(false);
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
	const handleRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setRememberInput(Boolean(e.target.value));
	};
	const handleClosePrompt = () => {
		onClose?.();

		setPasswordSubmitting(false);
		setPasswordSuccess(false);
	};
	const handleSubmitPrompt = async () => {
		if (passwordSubmitting) return;

		setPasswordSubmitting(true);
		const [response, status] = await unlockFile(
			data,
			passwordInput,
			rememberInput,
		);

		if (status !== 200) {
			setPasswordError(response);
			setPasswordSuccess(false);
		} else {
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
			<div className="flex fixed z-50 inset-0 bg-black/50">
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
					<div className="mb-3">
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
					<div className="mb-4 flex flex-row items-center">
						<label className="text-sm text-muted mr-2">
							Remember Password?
						</label>
						<input
							id="remember"
							name="remember"
							type="checkbox"
							value={String(rememberInput)}
							onChange={handleRememberChange}
							className=""
						/>
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
