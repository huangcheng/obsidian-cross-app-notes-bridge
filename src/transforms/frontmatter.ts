import { TransformConfig } from "./config";
import { TransformReport } from "./report";

/**
 * Strip a leading YAML frontmatter block (`---\n...\n---`) when the
 * config asks for it. Returns the source unchanged otherwise.
 */
export function stripFrontmatter(
	source: string,
	cfg: TransformConfig,
	report: TransformReport,
): string {
	if (!cfg.dropFrontmatter) return source;
	if (!source.startsWith("---")) return source;
	// First line must be exactly `---` (allow trailing whitespace).
	const firstNl = source.indexOf("\n");
	if (firstNl === -1) return source;
	const firstLine = source.slice(0, firstNl).trimEnd();
	if (firstLine !== "---") return source;
	// Find the closing `---` on its own line.
	const closeRe = /\n---\s*(\r?\n|$)/;
	const m = closeRe.exec(source);
	if (!m) return source;
	report.frontmatterDropped = true;
	const cut = m.index + m[0].length;
	return source.slice(cut);
}
