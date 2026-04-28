import { App, TFile } from "obsidian";
import { rewriteOutsideCode } from "./code-aware";
import { AttachmentMode, TransformConfig } from "./config";
import { TransformReport } from "./report";

const EMBED_RE = /!\[\[([^\]\n]+?)\]\]/g;

const IMAGE_EXT = new Set([
	"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
]);

export interface EmbedHandlerDeps {
	app: App;
	sourceFile: TFile | null;
}

export function rewriteEmbeds(
	source: string,
	cfg: TransformConfig,
	deps: EmbedHandlerDeps,
	report: TransformReport,
): string {
	return rewriteOutsideCode(source, (chunk) =>
		chunk.replace(EMBED_RE, (_, inner: string) => {
			const { target, alias } = parseEmbedInner(inner);
			const resolved = resolveAttachment(deps, target);
			const ext = extOf(resolved);
			const displayPath = applyAttachmentMode(resolved, cfg.rewriteAttachments, deps);

			if (cfg.embedHandling === "drop") {
				report.embedsDropped++;
				return "";
			}
			if (cfg.embedHandling === "inline-image-link" && ext && IMAGE_EXT.has(ext)) {
				report.embedsInlinedAsImage++;
				report.attachmentsRewritten++;
				return `![${alias ?? target}](${encodeMarkdownUrl(displayPath)})`;
			}
			// Default: replace-with-link
			report.embedsReplaced++;
			report.attachmentsRewritten++;
			return `[${alias ?? target}](${encodeMarkdownUrl(displayPath)})`;
		}),
	);
}

function parseEmbedInner(inner: string): { target: string; alias: string | null } {
	const pipe = inner.indexOf("|");
	if (pipe === -1) return { target: inner.trim(), alias: null };
	return {
		target: inner.slice(0, pipe).trim(),
		alias: inner.slice(pipe + 1).trim(),
	};
}

function resolveAttachment(deps: EmbedHandlerDeps, target: string): string {
	const sourcePath = deps.sourceFile?.path ?? "";
	const dest = deps.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	return dest ? dest.path : target;
}

function applyAttachmentMode(
	path: string,
	mode: AttachmentMode,
	deps: EmbedHandlerDeps,
): string {
	switch (mode) {
		case "vault-relative":
			return path;
		case "absolute": {
			const adapter = deps.app.vault.adapter as { getFullPath?: (p: string) => string };
			if (typeof adapter.getFullPath === "function") {
				return adapter.getFullPath(path);
			}
			return path;
		}
		case "upload-placeholder":
			return `attachment://${path}`;
	}
}

function extOf(p: string): string | null {
	const dot = p.lastIndexOf(".");
	if (dot === -1 || dot === p.length - 1) return null;
	return p.slice(dot + 1).toLowerCase();
}

function encodeMarkdownUrl(p: string): string {
	return p.replace(/[ ]/g, "%20");
}
