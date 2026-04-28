import { TFile } from "obsidian";

/**
 * The set of notes a user picked for an import or export operation,
 * along with where the selection came from. Every command and menu
 * entry produces this struct, then hands it to the orchestrator.
 */
export interface NoteSelection {
	source:
		| "active-editor"
		| "file-menu"
		| "files-menu"
		| "folder-menu"
		| "search-modal"
		| "command";
	notes: TFile[];
}

export function emptySelection(source: NoteSelection["source"]): NoteSelection {
	return { source, notes: [] };
}
