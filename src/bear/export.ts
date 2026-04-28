import { App, Notice, TFile } from "obsidian";
import { TransformConfig } from "../transforms/config";
import { MarkdownTransformer } from "../transforms/transformer";
import { bearAvailable, buildBearCreateUrl, openInBear } from "./url-scheme";

/**
 * Drain Bear's URL handler at a steady pace. macOS coalesces rapid-fire
 * `open` calls and may drop them; spacing them out keeps every note.
 */
const BEAR_OPEN_DELAY_MS = 250;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function tagsFromFrontmatter(app: App, file: TFile): string[] {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	const raw = fm?.tags;
	if (!raw) return [];
	if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
	if (typeof raw === "string") {
		return raw
			.split(/[,\s]+/)
			.map((t) => t.trim())
			.filter((t) => t.length > 0);
	}
	return [];
}

export interface BearExportOptions {
	app: App;
	transformConfig: TransformConfig;
	files: TFile[];
}

export interface BearExportResult {
	dispatched: number;
	failed: { file: TFile; error: string }[];
}

/**
 * Fire-and-forget export: opens one `bear://create` URL per note. Bear
 * doesn't acknowledge unless we register an `x-success` callback, which
 * needs the localhost listener — that ships in the next milestone, so
 * this flow reports "dispatched" rather than "succeeded".
 */
export async function exportFilesToBear(opts: BearExportOptions): Promise<BearExportResult> {
	if (!bearAvailable()) {
		new Notice("Bear export is only available on macOS / iOS.");
		return { dispatched: 0, failed: opts.files.map((f) => ({ file: f, error: "platform" })) };
	}
	const transformer = new MarkdownTransformer(opts.app, opts.transformConfig);
	const result: BearExportResult = { dispatched: 0, failed: [] };

	for (let i = 0; i < opts.files.length; i++) {
		const file = opts.files[i];
		if (!file) continue;
		try {
			const source = await opts.app.vault.cachedRead(file);
			const { output } = transformer.run({ source, file });
			const url = buildBearCreateUrl({
				title: file.basename,
				body: output,
				tags: tagsFromFrontmatter(opts.app, file),
				openNote: false,
			});
			openInBear(url);
			result.dispatched++;
			if (i < opts.files.length - 1) await delay(BEAR_OPEN_DELAY_MS);
		} catch (err) {
			result.failed.push({
				file,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
	return result;
}
