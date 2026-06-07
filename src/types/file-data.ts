export interface FileData {
	file_id: string;
	display_name: string | null;
	description: string | null;
	tags: string | null;
	file_name: string;
	updated_at: string;
	wip: number | null;
	password_hash: string | null;
}
