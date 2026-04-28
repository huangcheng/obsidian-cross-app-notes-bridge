import { rewriteOutsideCode } from "./code-aware";
import { TransformConfig } from "./config";
import { TransformReport } from "./report";

/**
 * Match the first line of an Obsidian callout: `> [!type]` optionally
 * followed by `+`/`-` (collapsed marker) and a title.
 */
const CALLOUT_FIRST_LINE = /^(\s*>+\s*)\[!([a-zA-Z0-9_-]+)\][+-]?(\s+.*)?$/;

/**
 * Flatten Obsidian callouts to plain Markdown blockquotes. The first
 * line `> [!note] Title` becomes `> **Title**` (or `> **Note**` when no
 * title is given). Subsequent blockquote lines are left untouched.
 */
export function flattenCallouts(
	source: string,
	cfg: TransformConfig,
	report: TransformReport,
): string {
	if (!cfg.flattenCallouts) return source;
	return rewriteOutsideCode(source, (chunk) => {
		const lines = chunk.split(/(\r?\n)/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;
			const m = line.match(CALLOUT_FIRST_LINE);
			if (!m) continue;
			const prefix = m[1] ?? "> ";
			const type = m[2] ?? "note";
			const titleRest = (m[3] ?? "").trim();
			const title = titleRest.length > 0 ? titleRest : capitalize(type);
			lines[i] = `${prefix}**${title}**`;
			report.calloutsFlattened++;
		}
		return lines.join("");
	});
}

function capitalize(s: string): string {
	if (!s) return s;
	return (s[0] ?? "").toUpperCase() + s.slice(1).toLowerCase();
}
