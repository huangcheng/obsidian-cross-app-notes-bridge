import { App, TFile } from "obsidian";
import { rewriteOutsideCode } from "./code-aware";
import { TransformConfig } from "./config";
import { TransformReport } from "./report";

const WIKILINK_RE = /!?\[\[([^\]\n]+?)\]\]/g;

export interface WikilinkResolverDeps {
	app: App;
	sourceFile: TFile | null;
}

/**
 * Rewrite Obsidian wikilinks. Embed-form (`![[...]]`) is left for the
 * embed handler — this pass only touches link-form `[[...]]`.
 *
 * Format: `[[Target]]`, `[[Target|Alias]]`, `[[Target#Heading]]`,
 * `[[Target#Heading|Alias]]`, `[[Target^block-id]]`.
 */
export function rewriteWikilinks(
	source: string,
	cfg: TransformConfig,
	deps: WikilinkResolverDeps,
	report: TransformReport,
): string {
	if (!cfg.resolveWikilinks) {
		// Count untouched wikilinks for the report.
		const matches = source.match(WIKILINK_RE);
		if (matches) {
			for (const m of matches) {
				if (!m.startsWith("!")) report.wikilinksKept++;
			}
		}
		return source;
	}

	return rewriteOutsideCode(source, (chunk) =>
		chunk.replace(WIKILINK_RE, (full, inner: string) => {
			if (full.startsWith("!")) {
				// Embed; leave for embed handler.
				return full;
			}
			const { target, alias } = parseWikilinkInner(inner);
			const resolved = resolveTarget(deps, target);
			report.wikilinksRewritten++;
			const display = alias ?? target;
			return `[${display}](${encodeMarkdownUrl(resolved)})`;
		}),
	);
}

function parseWikilinkInner(inner: string): { target: string; alias: string | null } {
	const pipe = inner.indexOf("|");
	if (pipe === -1) return { target: inner.trim(), alias: null };
	return {
		target: inner.slice(0, pipe).trim(),
		alias: inner.slice(pipe + 1).trim(),
	};
}

function resolveTarget(deps: WikilinkResolverDeps, target: string): string {
	// Strip heading/block fragments before resolving via metadataCache.
	const hashIdx = target.indexOf("#");
	const caretIdx = target.indexOf("^");
	const cut = [hashIdx, caretIdx].filter((n) => n >= 0);
	const fragmentStart = cut.length ? Math.min(...cut) : -1;
	const linkPath = fragmentStart === -1 ? target : target.slice(0, fragmentStart);
	const fragment = fragmentStart === -1 ? "" : target.slice(fragmentStart);

	const sourcePath = deps.sourceFile?.path ?? "";
	const resolved = deps.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
	if (resolved) {
		return resolved.path + fragment;
	}
	// Fallback: assume `.md` extension if none was given.
	const fallback = linkPath.endsWith(".md") ? linkPath : `${linkPath}.md`;
	return fallback + fragment;
}

function encodeMarkdownUrl(p: string): string {
	// Encode spaces and other characters but leave `/`, `#`, `.` readable.
	return p.replace(/[ ]/g, "%20");
}
