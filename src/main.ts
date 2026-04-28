import { Menu, MenuItem, Notice, ObsidianProtocolData, Platform, Plugin, TAbstractFile, TFile } from "obsidian";
import { exportFilesToBear } from "./bear/export";
import { bearAvailable } from "./bear/url-scheme";
import { McpClient } from "./mcp/mcp-client";
import { McpServerConfig } from "./mcp/types";
import { McpToolBrowserModal } from "./mcp/tool-browser-modal";
import { Orchestrator } from "./orchestrator/orchestrator";
import { planExport, writeExports } from "./orchestrator/file-writer";
import { ProviderRegistry } from "./providers/registry";
import { selectionFromActiveEditor, selectionFromFileMenu, selectionFromFiles } from "./selection/builders";
import { NoteSelection } from "./selection/note-selection";
import { DEFAULT_SETTINGS, PluginSettings } from "./settings";
import { AdvancedImportExportSettingTab } from "./settings/settings-tab";
import { MarkdownTransformer } from "./transforms/transformer";
import { ExportConfirmModal } from "./ui/export-confirm-modal";
import { handleBearCallback, initiateBearImport, writeImportedNote } from "./bear/import";
import { parseBearInput } from "./bear/url-scheme";
import { BearImportModal } from "./ui/bear-import-modal";

export default class AdvancedImportExportPlugin extends Plugin {
	settings!: PluginSettings;
	registry!: ProviderRegistry;
	orchestrator!: Orchestrator;
	private bearImportModal: BearImportModal | null = null;
	private mcpClients: Map<string, McpClient> = new Map();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.registry = new ProviderRegistry();
		this.registry.loadConfigs(this.settings.providers);
		this.orchestrator = new Orchestrator({
			app: this.app,
			concurrency: this.settings.concurrency,
		});

		this.addCommand({
			id: "copy-as-pure-markdown",
			name: "Copy as pure Markdown",
			checkCallback: (checking) => {
				const sel = selectionFromActiveEditor(this.app);
				if (!sel || sel.notes.length === 0) return false;
				if (!checking) void this.copyAsPureMarkdown(sel);
				return true;
			},
		});

		this.addCommand({
			id: "export-as-pure-markdown-active",
			name: "Export current note as pure Markdown",
			checkCallback: (checking) => {
				const sel = selectionFromActiveEditor(this.app);
				if (!sel || sel.notes.length === 0) return false;
				if (!checking) void this.exportSelection(sel);
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				const sel = selectionFromFileMenu(file);
				if (sel.notes.length === 0) return;
				this.addPluginSubmenu(menu, sel);
			}),
		);

		this.registerEvent(
			this.app.workspace.on("files-menu", (menu: Menu, files: TAbstractFile[]) => {
				const tFiles = files.filter((f): f is TFile => f instanceof TFile);
				const sel = selectionFromFiles(tFiles);
				if (sel.notes.length === 0) return;
				this.addPluginSubmenu(menu, sel);
			}),
		);

		this.addSettingTab(new AdvancedImportExportSettingTab(this.app, this));

		this.addCommand({
			id: "export-active-to-bear",
			name: "Export current note to Bear",
			checkCallback: (checking) => {
				const sel = selectionFromActiveEditor(this.app);
				if (!sel || sel.notes.length === 0) return false;
				if (!checking) void this.exportToBear(sel.notes);
				return true;
			},
		});

		this.addCommand({
			id: "import-from-bear",
			name: "Import from Bear",
			callback: () => this.importFromBear(),
		});

		this.addCommand({
			id: "mcp-browse-tools",
			name: "Browse MCP Tools",
			callback: () => this.browseMcpTools(),
		});

		this.addCommand({
			id: "mcp-connect-server",
			name: "Connect to MCP Server",
			callback: () => this.connectMcpServer(),
		});

		this.addCommand({
			id: "mcp-disconnect-all",
			name: "Disconnect all MCP servers",
			callback: () => this.disconnectAllMcp(),
		});

		this.registerObsidianProtocolHandler("bear-callback", (data) => this.handleBearUri(data));
	}

	onunload(): void {
		for (const [id, client] of this.mcpClients) {
			void client.disconnect().catch(() => {});
		}
		this.mcpClients.clear();
	}

	async loadSettings(): Promise<void> {
		const raw = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...(raw ?? {}),
			transform: { ...DEFAULT_SETTINGS.transform, ...(raw?.transform ?? {}) },
			providers: raw?.providers ?? [],
			mcpServers: raw?.mcpServers ?? [],
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Some settings affect long-lived components.
		this.orchestrator = new Orchestrator({
			app: this.app,
			concurrency: this.settings.concurrency,
		});
		this.registry.loadConfigs(this.settings.providers);
	}

	private buildTransformer(): MarkdownTransformer {
		return new MarkdownTransformer(this.app, this.settings.transform);
	}

	private async copyAsPureMarkdown(selection: NoteSelection): Promise<void> {
		const file = selection.notes[0];
		if (!file) {
			new Notice("No active note to copy");
			return;
		}
		const transformer = this.buildTransformer();
		const source = await this.app.vault.cachedRead(file);
		const { output } = transformer.run({ source, file });
		try {
			await navigator.clipboard.writeText(output);
			new Notice("Copied as pure Markdown");
		} catch (err) {
			new Notice(`Clipboard write failed: ${errorMessage(err)}`);
		}
	}

	private async exportSelection(selection: NoteSelection): Promise<void> {
		if (selection.notes.length === 0) {
			new Notice("No Markdown notes selected");
			return;
		}
		const transformer = this.buildTransformer();
		const plans = await planExport(this.app, transformer, selection.notes);
		new ExportConfirmModal(this.app, plans, this.settings.defaultExportDir, async (result) => {
			if (!result.confirmed) return;
			const summary = await writeExports(this.app, plans, {
				files: selection.notes,
				destinationDir: result.destinationDir,
				copyAttachments: false,
				collisionPolicy: "rename",
			});
			new Notice(
				`Export complete: ${summary.written.length} written, ${summary.skipped.length} skipped, ${summary.failed.length} failed`,
			);
		}).open();
	}

	private async exportToBear(files: TFile[]): Promise<void> {
		if (files.length === 0) {
			new Notice("No notes to export");
			return;
		}
		const result = await exportFilesToBear({
			app: this.app,
			transformConfig: this.settings.transform,
			files,
		});
		const failed = result.failed.length;
		const dispatched = result.dispatched;
		if (failed === 0) {
			new Notice(
				`Sent ${dispatched} note${dispatched === 1 ? "" : "s"} to Bear. Check Bear to confirm.`,
			);
		} else {
			new Notice(`Bear export: ${dispatched} sent, ${failed} failed.`);
		}
	}

	private importFromBear(): void {
		if (!bearAvailable()) {
			new Notice("Bear import is only available on macOS.");
			return;
		}
		this.bearImportModal = new BearImportModal(this.app, (request) => {
			const noteId = parseBearInput(request.noteId);
			if (!noteId) {
				new Notice("Invalid Bear note identifier. Enter a UUID or Bear URL.");
				return;
			}
			this.bearImportModal?.setWaiting();
			initiateBearImport(noteId);
		});
		this.bearImportModal.open();
	}

	private handleBearUri(data: ObsidianProtocolData): void {
		// Build query string from ObsidianProtocolData (excludes 'action' key)
		const search = Object.entries(data)
			.filter(([key]) => key !== "action")
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join("&");

		handleBearCallback(search, async (result) => {
			if (!result.success || !result.note) {
				this.bearImportModal?.setDone(false, result.error ?? "Unknown error");
				new Notice(`Bear import failed: ${result.error ?? "unknown error"}`);
				return;
			}
			try {
				const destDir = this.settings.defaultImportDir;
				const path = await writeImportedNote(this.app, result.note, destDir);
				this.bearImportModal?.setDone(true, `Note imported to ${path}`);
				new Notice(`Imported "${result.note.title}" to ${path}`);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.bearImportModal?.setDone(false, msg);
				new Notice(`Import write failed: ${msg}`);
			}
		});
	}

	private async browseMcpTools(): Promise<void> {
		const configs = this.settings.mcpServers;
		if (configs.length === 0) {
			new Notice("No MCP servers configured. Add one in Settings.");
			return;
		}
		if (configs.length === 1) {
			const client = await this.getOrCreateMcpClient(configs[0]!);
			if (!client) return;
			new McpToolBrowserModal(this.app, client).open();
			return;
		}
		const { FuzzySuggestModal } = await import("obsidian");
		const picker = new (class extends (FuzzySuggestModal as new (...a: unknown[]) => InstanceType<typeof FuzzySuggestModal>) {
			constructor(
				app: import("obsidian").App,
				private readonly items: McpServerConfig[],
				private readonly onChoose: (c: McpServerConfig) => void,
			) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				super(app as any);
			}
			getItems() { return this.items; }
			getItemText(item: McpServerConfig) { return item.displayName; }
			onChooseItem(item: McpServerConfig) { this.onChoose(item); }
		})(this.app, configs, async (config) => {
			const client = await this.getOrCreateMcpClient(config);
			if (!client) return;
			new McpToolBrowserModal(this.app, client).open();
		});
		picker.setPlaceholder("Select MCP server…");
		picker.open();
	}

	private async connectMcpServer(): Promise<void> {
		const configs = this.settings.mcpServers;
		if (configs.length === 0) {
			new Notice("No MCP servers configured. Add one in Settings.");
			return;
		}
		const { FuzzySuggestModal } = await import("obsidian");
		const picker = new (class extends (FuzzySuggestModal as new (...a: unknown[]) => InstanceType<typeof FuzzySuggestModal>) {
			constructor(
				app: import("obsidian").App,
				private readonly items: McpServerConfig[],
				private readonly onChoose: (c: McpServerConfig) => void,
			) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				super(app as any);
			}
			getItems() { return this.items; }
			getItemText(item: McpServerConfig) { return item.displayName; }
			onChooseItem(item: McpServerConfig) { this.onChoose(item); }
		})(this.app, configs, async (config) => {
			const client = await this.getOrCreateMcpClient(config);
			if (!client) return;
			new Notice(`Connected to ${config.displayName} (${client.getTools().length} tools)`);
		});
		picker.setPlaceholder("Select MCP server to connect…");
		picker.open();
	}

	private async disconnectAllMcp(): Promise<void> {
		const count = this.mcpClients.size;
		for (const [id, client] of this.mcpClients) {
			await client.disconnect().catch(() => {});
		}
		this.mcpClients.clear();
		new Notice(count > 0 ? `Disconnected ${count} MCP server${count !== 1 ? "s" : ""}` : "No active MCP connections");
	}

	private async getOrCreateMcpClient(config: McpServerConfig): Promise<McpClient | null> {
		if (config.transportType === "stdio" && !Platform.isDesktop) {
			new Notice("Stdio MCP servers require the desktop version of Obsidian");
			return null;
		}
		const existing = this.mcpClients.get(config.id);
		if (existing) {
			const state = existing.getState();
			if (state.status === "connected") return existing;
			await existing.disconnect().catch(() => {});
			this.mcpClients.delete(config.id);
		}
		const client = new McpClient(config);
		try {
			await client.connect();
			this.mcpClients.set(config.id, client);
			return client;
		} catch (err) {
			new Notice(`Failed to connect to ${config.displayName}: ${errorMessage(err)}`);
			return null;
		}
	}

	private addPluginSubmenu(menu: Menu, selection: NoteSelection): void {
		const { notes } = selection;
		if (notes.length === 0) return;

		menu.addItem((item) => {
			item.setTitle("Advanced Import/Export").setIcon("lucide-arrow-left-right");
			const sub = (item as MenuItem & { setSubmenu(): Menu }).setSubmenu();

			if (notes.length === 1) {
				sub.addItem((s) =>
					s
						.setTitle("Copy as pure Markdown")
						.setIcon("clipboard-copy")
						.onClick(() => void this.copyAsPureMarkdown(selection)),
				);
			}

			this.addBearSubmenu(sub, notes);
		});
	}

	private addBearSubmenu(menu: Menu, files: TFile[]): void {
		if (files.length === 0) return;
		const macOnly = !bearAvailable();
		menu.addItem((item) => {
			item.setTitle("Bear").setIcon("book-open");
			const submenu = (item as MenuItem & { setSubmenu(): Menu }).setSubmenu();
			submenu.addItem((sub: MenuItem) =>
				sub
					.setTitle(
						files.length === 1
							? "Export note to Bear"
							: `Export ${files.length} notes to Bear`,
					)
					.setIcon("upload")
					.setDisabled(macOnly)
					.onClick(() => void this.exportToBear(files)),
			);
			submenu.addItem((sub: MenuItem) =>
				sub
					.setTitle("Import from Bear…")
					.setIcon("download")
					.setDisabled(macOnly)
					.onClick(() => this.importFromBear()),
			);
			if (macOnly) {
				submenu.addItem((sub: MenuItem) =>
					sub.setTitle("(Bear is macOS / iOS only)").setDisabled(true),
				);
			}
		});
	}
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
