/**
 * Per-note record of what the Markdown transform pipeline did. Surfaced
 * to the user before destructive exports (file write, HTTP push, etc.).
 */
export interface TransformReport {
	wikilinksRewritten: number;
	wikilinksKept: number;
	embedsDropped: number;
	embedsReplaced: number;
	embedsInlinedAsImage: number;
	calloutsFlattened: number;
	frontmatterDropped: boolean;
	attachmentsRewritten: number;
	warnings: string[];
}

export function emptyReport(): TransformReport {
	return {
		wikilinksRewritten: 0,
		wikilinksKept: 0,
		embedsDropped: 0,
		embedsReplaced: 0,
		embedsInlinedAsImage: 0,
		calloutsFlattened: 0,
		frontmatterDropped: false,
		attachmentsRewritten: 0,
		warnings: [],
	};
}

export function summarize(report: TransformReport): string {
	const parts: string[] = [];
	if (report.wikilinksRewritten) parts.push(`${report.wikilinksRewritten} wikilinks rewritten`);
	if (report.wikilinksKept) parts.push(`${report.wikilinksKept} wikilinks kept`);
	const embeds = report.embedsDropped + report.embedsReplaced + report.embedsInlinedAsImage;
	if (embeds) parts.push(`${embeds} embeds processed`);
	if (report.calloutsFlattened) parts.push(`${report.calloutsFlattened} callouts flattened`);
	if (report.frontmatterDropped) parts.push("frontmatter removed");
	if (report.attachmentsRewritten) parts.push(`${report.attachmentsRewritten} attachment links rewritten`);
	if (report.warnings.length) parts.push(`${report.warnings.length} warnings`);
	return parts.length ? parts.join(", ") : "no transforms applied";
}
