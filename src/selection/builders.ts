import { App, MarkdownView, Menu, TAbstractFile, TFile, TFolder } from "obsidian";
import { NoteSelection } from "./note-selection";

function isMarkdown(file: TAbstractFile): file is TFile {
	return file instanceof TFile && file.extension === "md";
}

function collectMarkdownInFolder(folder: TFolder): TFile[] {
	const out: TFile[] = [];
	for (const child of folder.children) {
		if (child instanceof TFolder) {
			out.push(...collectMarkdownInFolder(child));
		} else if (isMarkdown(child)) {
			out.push(child);
		}
	}
	return out;
}

export function selectionFromActiveEditor(app: App): NoteSelection | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!file) return null;
	return { source: "active-editor", notes: [file] };
}

export function selectionFromFileMenu(file: TAbstractFile): NoteSelection {
	if (file instanceof TFolder) {
		return { source: "folder-menu", notes: collectMarkdownInFolder(file) };
	}
	return {
		source: "file-menu",
		notes: isMarkdown(file) ? [file] : [],
	};
}

export function selectionFromFilesMenu(files: TAbstractFile[]): NoteSelection {
	const notes: TFile[] = [];
	for (const f of files) {
		if (f instanceof TFolder) notes.push(...collectMarkdownInFolder(f));
		else if (isMarkdown(f)) notes.push(f);
	}
	return { source: "files-menu", notes };
}

/**
 * Helper for building selections from search modals or other custom UIs.
 */
export function selectionFromFiles(files: TFile[]): NoteSelection {
	return { source: "search-modal", notes: files.filter(isMarkdown) };
}

/**
 * True when the menu was opened on multiple selected files. Obsidian
 * passes a `Menu` argument, but the actual selected files come via a
 * separate event — this helper is exposed so callers don't need to
 * know about the internals.
 */
export function menuHasMultipleFiles(_menu: Menu, files: TAbstractFile[]): boolean {
	return files.length > 1;
}
