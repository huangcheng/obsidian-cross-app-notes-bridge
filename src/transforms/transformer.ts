import { App, TFile } from "obsidian";
import { flattenCallouts } from "./callouts";
import { TransformConfig } from "./config";
import { rewriteEmbeds } from "./embeds";
import { stripFrontmatter } from "./frontmatter";
import { emptyReport, TransformReport } from "./report";
import { rewriteWikilinks } from "./wikilinks";

export interface TransformInput {
	source: string;
	file: TFile | null;
}

export interface TransformResult {
	output: string;
	report: TransformReport;
}

/**
 * Apply the configured transform pipeline to a single note's source text.
 * Pipeline order matters: frontmatter is stripped first so later passes
 * see only the body; embeds run before wikilinks because both share the
 * `[[...]]` shape and the embed regex is the more specific match.
 */
export class MarkdownTransformer {
	constructor(private readonly app: App, private readonly config: TransformConfig) {}

	run(input: TransformInput): TransformResult {
		const report = emptyReport();
		const deps = { app: this.app, sourceFile: input.file };
		let text = input.source;
		text = stripFrontmatter(text, this.config, report);
		text = rewriteEmbeds(text, this.config, deps, report);
		text = rewriteWikilinks(text, this.config, deps, report);
		text = flattenCallouts(text, this.config, report);
		return { output: text, report };
	}
}
