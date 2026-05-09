import { McpClient } from "../../mcp/mcp-client";
import { McpServerConfig } from "../../mcp/types";
import {
	FetchOptions,
	ListOptions,
	NormalizedNote,
	Provider,
	ProviderAvailability,
	ProviderCapabilities,
	RemoteListItem,
} from "../provider";
import { ProviderFactory } from "../registry";
import { formatFlomoContent, pickFlomoWriteTool } from "./format";
import { FLOMO_MCP_URL, FlomoProviderConfig } from "./types";

/**
 * Push-only provider for Flomo's official streamable-HTTP MCP at
 * `https://flomoapp.com/mcp`. Authenticates with a Bearer token issued
 * via Flomo's MCP settings page. Read paths (fetch / listRemote) are
 * unsupported because Flomo's MCP is a write surface today; if that
 * changes we add them later.
 */
export class FlomoProvider implements Provider {
	readonly id: string;
	readonly displayName: string;
	readonly icon = "notebook-pen";
	readonly capabilities: ProviderCapabilities = {
		canImport: false,
		canExport: true,
		supportsBulk: true,
		supportsAttachments: false,
	};

	private mcpClient: McpClient | null = null;

	constructor(private readonly config: FlomoProviderConfig) {
		this.id = config.id;
		this.displayName = config.displayName || "Flomo";
	}

	available(): ProviderAvailability {
		const token = this.config.apiToken?.trim();
		if (!token) {
			return { ok: false, reason: "Add a Flomo API token in settings" };
		}
		return { ok: true };
	}

	async push(_note: NormalizedNote): Promise<{ remoteId: string }> {
		throw new Error("FlomoProvider.push: not implemented yet");
	}

	async fetch(_remoteId: string, _opts?: FetchOptions): Promise<NormalizedNote> {
		throw new Error("Flomo MCP does not support reading memos");
	}

	async listRemote(_opts?: ListOptions): Promise<RemoteListItem[]> {
		throw new Error("Flomo MCP does not support listing memos");
	}

	async testConnection(): Promise<{ ok: boolean; message?: string }> {
		return { ok: false, message: "Not implemented yet" };
	}

	async dispose(): Promise<void> {
		if (this.mcpClient) {
			await this.mcpClient.disconnect().catch(() => {});
			this.mcpClient = null;
		}
	}

	private async connectMcp(): Promise<McpClient> {
		if (this.mcpClient) {
			const state = this.mcpClient.getState();
			if (state.status === "connected") return this.mcpClient;
			await this.mcpClient.disconnect().catch(() => {});
			this.mcpClient = null;
		}
		const token = this.config.apiToken?.trim();
		if (!token) throw new Error("Flomo API token is missing");
		const cfg: McpServerConfig = {
			id: `${this.config.id}-mcp`,
			kind: "mcp",
			displayName: this.displayName,
			enabled: true,
			trusted: true,
			transportType: "http",
			url: FLOMO_MCP_URL,
			headers: { Authorization: `Bearer ${token}` },
		};
		const client = new McpClient(cfg);
		await client.connect();
		this.mcpClient = client;
		return client;
	}
}

export const flomoFactory: ProviderFactory<FlomoProviderConfig> = {
	kind: "flomo",
	create(config) {
		return new FlomoProvider(config);
	},
};
