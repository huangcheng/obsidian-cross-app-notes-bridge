import { TFile } from "obsidian";

export type Direction = "import" | "export";

export interface SessionStarted {
	type: "started";
	total: number;
}

export interface NoteSucceeded {
	type: "note-succeeded";
	file: TFile | null;
	remoteId: string;
	index: number;
}

export interface NoteFailed {
	type: "note-failed";
	file: TFile | null;
	remoteId: string | null;
	index: number;
	error: string;
}

export interface SessionCancelled {
	type: "cancelled";
	completed: number;
	total: number;
}

export interface SessionDone {
	type: "done";
	succeeded: number;
	failed: number;
	total: number;
}

export type SessionEvent =
	| SessionStarted
	| NoteSucceeded
	| NoteFailed
	| SessionCancelled
	| SessionDone;

export type SessionListener = (event: SessionEvent) => void;

/**
 * Tiny event emitter scoped to a single import/export run. The
 * orchestrator pushes events; the progress modal subscribes.
 */
export class ImportExportSession {
	private readonly listeners: SessionListener[] = [];
	private readonly abort = new AbortController();
	private cancelled = false;

	get signal(): AbortSignal {
		return this.abort.signal;
	}

	get isCancelled(): boolean {
		return this.cancelled;
	}

	subscribe(listener: SessionListener): () => void {
		this.listeners.push(listener);
		return () => {
			const idx = this.listeners.indexOf(listener);
			if (idx >= 0) this.listeners.splice(idx, 1);
		};
	}

	emit(event: SessionEvent): void {
		for (const l of this.listeners) {
			try {
				l(event);
			} catch {
				// Listeners must not throw; swallow to keep the run alive.
			}
		}
	}

	cancel(): void {
		if (this.cancelled) return;
		this.cancelled = true;
		this.abort.abort();
	}
}
