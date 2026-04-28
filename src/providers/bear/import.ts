import { App, normalizePath, Notice } from "obsidian";
import { NormalizedNote } from "../provider";
import { bearAvailable, buildBearOpenUrl, openInBear, parseBearCallback, BearCallbackResult } from "./url-scheme";

export interface BearImportResult {
	success: boolean;
	note?: NormalizedNote;
	error?: string;
}

export function bearCallbackToNote(result: BearCallbackResult): NormalizedNote | null {
	if (!result.success || !result.note) return null;
	return {
		remoteId: result.identifier ?? "",
		title: result.title ?? "Untitled Bear Note",
		body: result.note,
		tags: result.tags ?? [],
		attachments: [],
		sourceMeta: {
			source: "bear",
			isTrashed: result.isTrashed,
		},
	};
}

export function initiateBearImport(noteId: string): void {
	if (!bearAvailable()) {
		new Notice("Bear import is only available on macOS.");
		return;
	}
	const url = buildBearOpenUrl(noteId);
	openInBear(url);
}

export async function writeImportedNote(
	app: App,
	note: NormalizedNote,
	destinationDir: string,
): Promise<string> {
	const adapter = app.vault.adapter;
	const dir = normalizePath(destinationDir);

	if (!await adapter.exists(dir)) {
		await app.vault.createFolder(dir);
	}

	const safeName = note.title.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled";
	const fileName = `${safeName}.md`;
	let filePath = normalizePath(`${dir}/${fileName}`);

	let finalPath = filePath;
	let counter = 1;
	while (await adapter.exists(finalPath)) {
		finalPath = normalizePath(`${dir}/${safeName} (${counter}).md`);
		counter++;
	}

	await adapter.write(finalPath, note.body);
	return finalPath;
}

export function handleBearCallback(
	searchParams: string,
	onResult: (result: BearImportResult) => void,
): void {
	const parsed = parseBearCallback(searchParams);
	const note = bearCallbackToNote(parsed);

	if (!parsed.success) {
		onResult({
			success: false,
			error: parsed.errorMessage ?? `Bear error ${parsed.errorCode ?? "unknown"}`,
		});
		return;
	}

	if (!note) {
		onResult({
			success: false,
			error: "Bear returned an empty note. The note may be encrypted.",
		});
		return;
	}

	onResult({ success: true, note });
}