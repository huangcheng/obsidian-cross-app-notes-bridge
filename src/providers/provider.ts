export interface NoteAttachment {
	/** Original reference as it appeared in the source system. */
	ref: string;
	/** Optional MIME type. */
	mimeType?: string;
	/** Inline bytes when the provider returned the asset directly. */
	bytes?: Uint8Array;
	/** Remote URL/path to fetch lazily, if `bytes` is not present. */
	url?: string;
}

/**
 * Common shape every provider produces for `fetch` and accepts for `push`.
 * Providers normalize their wire format into this; the orchestrator and
 * transforms only know about `NormalizedNote`.
 */
export interface NormalizedNote {
	/** Stable identifier in the remote system. May be empty for new pushes. */
	remoteId: string;
	title: string;
	body: string;
	tags: string[];
	attachments: NoteAttachment[];
	/** Provider-specific extras the orchestrator should round-trip but not interpret. */
	sourceMeta: Record<string, unknown>;
}

export interface ProviderCapabilities {
	canImport: boolean;
	canExport: boolean;
	supportsBulk: boolean;
	supportsAttachments: boolean;
}

export interface RemoteListItem {
	remoteId: string;
	title: string;
	updatedAt?: string;
}

export interface FetchOptions {
	signal?: AbortSignal;
}

export interface PushOptions {
	signal?: AbortSignal;
}

export interface ListOptions {
	query?: string;
	signal?: AbortSignal;
}

/**
 * Reports whether the provider can be used in the current environment.
 * Returning `{ ok: false, reason }` lets the UI render a disabled
 * state with an explanation rather than a hard crash on invocation.
 */
export interface ProviderAvailability {
	ok: boolean;
	reason?: string;
}

export interface Provider {
	readonly id: string;
	readonly displayName: string;
	readonly capabilities: ProviderCapabilities;
	/** Lucide icon name for menus / settings cards. */
	readonly icon?: string;

	/** Runtime check: are platform/installation prerequisites met? */
	available?(): ProviderAvailability;

	listRemote(opts?: ListOptions): Promise<RemoteListItem[]>;
	fetch(remoteId: string, opts?: FetchOptions): Promise<NormalizedNote>;
	push(note: NormalizedNote, opts?: PushOptions): Promise<{ remoteId: string }>;
	delete?(remoteId: string): Promise<void>;
	/** Optional self-test the settings UI calls when the user clicks "Test connection". */
	testConnection?(): Promise<{ ok: boolean; message?: string }>;
	/** Release any long-lived resources (sockets, subprocesses). Called on plugin unload. */
	dispose?(): Promise<void> | void;
}
