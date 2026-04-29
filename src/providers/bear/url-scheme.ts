import { Platform } from "obsidian";

export interface BearCreateParams {
	title: string;
	body: string;
	tags?: string[];
	/** Default false — we don't want Bear stealing focus during bulk export. */
	openNote?: boolean;
}

function enc(value: string): string {
	return encodeURIComponent(value);
}

export function buildBearCreateUrl(p: BearCreateParams): string {
	const parts: string[] = [];
	if (p.title) parts.push(`title=${enc(p.title)}`);
	if (p.body) parts.push(`text=${enc(p.body)}`);
	if (p.tags && p.tags.length > 0) parts.push(`tags=${enc(p.tags.join(","))}`);
	parts.push(`open_note=${p.openNote ? "yes" : "no"}`);
	parts.push("show_window=no");
	return `bear://x-callback-url/create?${parts.join("&")}`;
}

/**
 * Open a `bear://` URL via the platform handler. Returns false when the
 * URL appears to have failed to launch — but x-callback-url responses
 * are async, so for fire-and-forget flows callers should treat any
 * non-throwing return as best-effort success.
 */
export function openInBear(url: string): void {
	window.open(url, "_blank");
}

/**
 * Bear's URL handler is macOS/iOS only. On Obsidian desktop this maps
 * to the Electron renderer running on darwin.
 */
export function bearAvailable(): boolean {
	return Boolean(Platform.isMacOS || Platform.isIosApp);
}

export interface BearCallbackResult {
	success: boolean;
	identifier?: string;
	title?: string;
	note?: string;
	tags?: string[];
	isTrashed?: boolean;
	errorCode?: string;
	errorMessage?: string;
}

export function buildBearOpenUrl(noteId: string): string {
	return `bear://x-callback-url/open-note?id=${enc(noteId)}&x-success=${enc("obsidian://bear-callback")}&show_window=no`;
}

export function parseBearInput(input: string): string | null {
	const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const bearUrlPattern = /^bear:\/\/x-callback-url\/open-note\?id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

	const urlMatch = input.match(bearUrlPattern);
	if (urlMatch && urlMatch[1]) return urlMatch[1].toUpperCase();

	if (uuidPattern.test(input)) return input.toUpperCase();

	return null;
}

export function parseBearCallback(searchParams: string): BearCallbackResult {
	const params = new URLSearchParams(searchParams);

	if (params.has("x-error")) {
		const errorCode = params.get("x-error") ?? "";
		const errorMessage = params.get("error-description") ?? "Unknown Bear error";
		return { success: false, errorCode, errorMessage };
	}

	const tagsParam = params.get("tags");
	let tags: string[] | undefined;
	if (tagsParam) {
		try {
			const parsed: unknown = JSON.parse(tagsParam);
			tags = Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : undefined;
		} catch {
			tags = undefined;
		}
	}

	return {
		success: true,
		identifier: params.get("identifier") ?? undefined,
		title: params.get("title") ?? undefined,
		note: params.get("note") ?? undefined,
		tags,
		isTrashed: params.get("is_trashed") === "yes" ? true : params.get("is_trashed") === "no" ? false : undefined,
	};
}
