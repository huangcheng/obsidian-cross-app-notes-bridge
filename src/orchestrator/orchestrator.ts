import { App, TFile } from "obsidian";
import { NormalizedNote, Provider } from "../providers/provider";
import { NoteSelection } from "../selection/note-selection";
import { runWithConcurrency } from "../util/concurrency";
import { Direction, ImportExportSession } from "./session";

export interface OrchestratorOptions {
	app: App;
	concurrency?: number;
	/**
	 * Hook called for export to convert the file's vault contents into a
	 * `NormalizedNote` (transforms applied, frontmatter handled, etc).
	 */
	toNote?: (file: TFile) => Promise<NormalizedNote>;
	/**
	 * Hook called for import to write a fetched `NormalizedNote` into
	 * the vault. Returns the created TFile when a file was written, or
	 * null when the operation was skipped (e.g. user chose "skip" on
	 * conflict).
	 */
	fromNote?: (note: NormalizedNote) => Promise<TFile | null>;
}

export interface RunInput {
	direction: Direction;
	selection: NoteSelection;
	provider: Provider;
	/**
	 * Remote IDs to import (only used when direction === "import").
	 * Selection.notes is ignored in that case; it stays in the struct so
	 * the progress modal can still attribute results to vault files
	 * after import completes.
	 */
	remoteIds?: string[];
}

/**
 * Drives a single import or export run: fans out to N concurrent
 * provider calls, reports progress through the session, and respects
 * cancellation.
 */
export class Orchestrator {
	constructor(private readonly options: OrchestratorOptions) {}

	async run(input: RunInput, session: ImportExportSession): Promise<void> {
		const concurrency = Math.max(1, this.options.concurrency ?? 4);

		if (input.direction === "export") {
			await this.runExport(input, session, concurrency);
		} else {
			await this.runImport(input, session, concurrency);
		}
	}

	private async runExport(
		input: RunInput,
		session: ImportExportSession,
		concurrency: number,
	): Promise<void> {
		const files = input.selection.notes;
		session.emit({ type: "started", total: files.length });
		let succeeded = 0;
		let failed = 0;

		await runWithConcurrency(files, concurrency, session.signal, async (file, index, signal) => {
			try {
				if (!this.options.toNote) {
					throw new Error("Orchestrator missing toNote hook");
				}
				const note = await this.options.toNote(file);
				const result = await input.provider.push(note, { signal });
				succeeded++;
				session.emit({
					type: "note-succeeded",
					file,
					remoteId: result.remoteId,
					index,
				});
			} catch (err) {
				if (signal.aborted) return;
				failed++;
				session.emit({
					type: "note-failed",
					file,
					remoteId: null,
					index,
					error: errorMessage(err),
				});
			}
		});

		this.emitTerminal(session, succeeded, failed, files.length);
	}

	private async runImport(
		input: RunInput,
		session: ImportExportSession,
		concurrency: number,
	): Promise<void> {
		const ids = input.remoteIds ?? [];
		session.emit({ type: "started", total: ids.length });
		let succeeded = 0;
		let failed = 0;

		await runWithConcurrency(ids, concurrency, session.signal, async (remoteId, index, signal) => {
			try {
				const note = await input.provider.fetch(remoteId, { signal });
				if (!this.options.fromNote) {
					throw new Error("Orchestrator missing fromNote hook");
				}
				const file = await this.options.fromNote(note);
				succeeded++;
				session.emit({
					type: "note-succeeded",
					file,
					remoteId,
					index,
				});
			} catch (err) {
				if (signal.aborted) return;
				failed++;
				session.emit({
					type: "note-failed",
					file: null,
					remoteId,
					index,
					error: errorMessage(err),
				});
			}
		});

		this.emitTerminal(session, succeeded, failed, ids.length);
	}

	private emitTerminal(
		session: ImportExportSession,
		succeeded: number,
		failed: number,
		total: number,
	): void {
		if (session.isCancelled) {
			session.emit({
				type: "cancelled",
				completed: succeeded + failed,
				total,
			});
			return;
		}
		session.emit({ type: "done", succeeded, failed, total });
	}
}

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}
