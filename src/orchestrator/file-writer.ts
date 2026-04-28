import { App, normalizePath, Notice, TFile, Vault } from "obsidian";
import { TransformReport } from "../transforms/report";
import { MarkdownTransformer } from "../transforms/transformer";

export type CollisionPolicy = "prompt" | "overwrite" | "rename" | "skip";

export interface ExportPlan {
	file: TFile;
	report: TransformReport;
	output: string;
}

export interface ExportRequest {
	files: TFile[];
	destinationDir: string;
	/** Whether to copy referenced attachments alongside the exported files. */
	copyAttachments: boolean;
	collisionPolicy: CollisionPolicy;
	/** Resolver invoked when collisionPolicy === "prompt". */
	resolveCollision?: (
		path: string,
	) => Promise<{ choice: Exclude<CollisionPolicy, "prompt">; applyToAll: boolean }>;
}

export interface ExportSummary {
	written: string[];
	skipped: string[];
	failed: { file: TFile; error: string }[];
}

/**
 * Build per-file `ExportPlan`s without writing anything. Lets the UI
 * preview the transform reports and confirm before mutating disk.
 */
export async function planExport(
	app: App,
	transformer: MarkdownTransformer,
	files: TFile[],
): Promise<ExportPlan[]> {
	const plans: ExportPlan[] = [];
	for (const file of files) {
		const source = await app.vault.cachedRead(file);
		const { output, report } = transformer.run({ source, file });
		plans.push({ file, output, report });
	}
	return plans;
}

/**
 * Write `ExportPlan`s to disk relative to the vault. Files outside the
 * vault are not supported by this writer (Obsidian's adapter API only
 * sees vault paths). The orchestrator's HTTP/CLI providers handle
 * out-of-vault destinations.
 */
export async function writeExports(
	app: App,
	plans: ExportPlan[],
	request: ExportRequest,
): Promise<ExportSummary> {
	const summary: ExportSummary = { written: [], skipped: [], failed: [] };
	const adapter = app.vault.adapter;
	let runtimePolicy = request.collisionPolicy;

	await ensureFolder(app.vault, request.destinationDir);

	for (const plan of plans) {
		const targetName = `${plan.file.basename}.md`;
		const targetPath = normalizePath(`${request.destinationDir}/${targetName}`);
		try {
			let path = targetPath;
			if (await adapter.exists(path)) {
				const policy = await resolvePolicy(path, runtimePolicy, request);
				if (policy.choice === "skip") {
					summary.skipped.push(path);
					if (policy.applyToAll) runtimePolicy = "skip";
					continue;
				}
				if (policy.choice === "rename") {
					path = await uniquePath(adapter, path);
				}
				if (policy.applyToAll) runtimePolicy = policy.choice;
			}
			await adapter.write(path, plan.output);
			summary.written.push(path);
		} catch (err) {
			summary.failed.push({ file: plan.file, error: errorMessage(err) });
		}
	}

	if (summary.failed.length > 0) {
		new Notice(`Export finished with ${summary.failed.length} failure(s).`);
	}
	return summary;
}

async function ensureFolder(vault: Vault, dir: string): Promise<void> {
	const path = normalizePath(dir);
	if (!path || path === "/") return;
	const existing = vault.getAbstractFileByPath(path);
	if (existing) return;
	await vault.createFolder(path);
}

async function uniquePath(
	adapter: { exists: (p: string) => Promise<boolean> },
	path: string,
): Promise<string> {
	const dot = path.lastIndexOf(".");
	const base = dot === -1 ? path : path.slice(0, dot);
	const ext = dot === -1 ? "" : path.slice(dot);
	for (let n = 1; n < 1000; n++) {
		const candidate = `${base} (${n})${ext}`;
		if (!(await adapter.exists(candidate))) return candidate;
	}
	throw new Error(`Could not find a free filename for ${path}`);
}

async function resolvePolicy(
	path: string,
	runtimePolicy: CollisionPolicy,
	request: ExportRequest,
): Promise<{ choice: Exclude<CollisionPolicy, "prompt">; applyToAll: boolean }> {
	if (runtimePolicy !== "prompt") return { choice: runtimePolicy, applyToAll: false };
	if (!request.resolveCollision) return { choice: "skip", applyToAll: false };
	return request.resolveCollision(path);
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
