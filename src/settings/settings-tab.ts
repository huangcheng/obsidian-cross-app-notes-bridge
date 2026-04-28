import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AdvancedImportExportPlugin from "../main";
import { McpServerConfig, DEFAULT_MCP_SERVER_CONFIG } from "../mcp/types";
import { McpClient } from "../mcp/mcp-client";

/**
 * Settings tab. Sections grow as adapters land — for the foundation we
 * expose the transform toggles, default export destination, concurrency,
 * developer log, and a placeholder for providers (UI lives in
 * `providers/registry-ui.ts` once adapters are implemented).
 */
export class AdvancedImportExportSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: AdvancedImportExportPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Markdown export transforms" });
		const t = this.plugin.settings.transform;

		new Setting(containerEl)
			.setName("Resolve wikilinks")
			.setDesc("Rewrite [[Note]] to [Note](Note.md). Disable to keep wikilinks verbatim.")
			.addToggle((tog) =>
				tog.setValue(t.resolveWikilinks).onChange(async (v) => {
					t.resolveWikilinks = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Embed handling")
			.setDesc("How to render ![[...]] embeds in exported Markdown.")
			.addDropdown((dd) =>
				dd
					.addOptions({
						drop: "Drop",
						"replace-with-link": "Replace with link",
						"inline-image-link": "Inline as image link",
					})
					.setValue(t.embedHandling)
					.onChange(async (v) => {
						t.embedHandling = v as typeof t.embedHandling;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Flatten callouts")
			.setDesc("Convert `> [!note] Title` to a plain blockquote with bold title.")
			.addToggle((tog) =>
				tog.setValue(t.flattenCallouts).onChange(async (v) => {
					t.flattenCallouts = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Drop frontmatter")
			.setDesc("Remove the leading YAML frontmatter block from exported Markdown.")
			.addToggle((tog) =>
				tog.setValue(t.dropFrontmatter).onChange(async (v) => {
					t.dropFrontmatter = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Attachment links")
			.setDesc("How to rewrite paths to attachments referenced by embeds.")
			.addDropdown((dd) =>
				dd
					.addOptions({
						"vault-relative": "Vault-relative",
						absolute: "Absolute filesystem path",
						"upload-placeholder": "Upload placeholder (attachment://)",
					})
					.setValue(t.rewriteAttachments)
					.onChange(async (v) => {
						t.rewriteAttachments = v as typeof t.rewriteAttachments;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h2", { text: "File locations" });

		new Setting(containerEl)
			.setName("Default export folder")
			.setDesc("Vault-relative folder used by `Export as pure Markdown`.")
			.addText((text) =>
				text
					.setPlaceholder("Exports")
					.setValue(this.plugin.settings.defaultExportDir)
					.onChange(async (v) => {
						this.plugin.settings.defaultExportDir = v.trim() || "Exports";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default import folder")
			.setDesc("Vault-relative folder for incoming notes (e.g. from Bear).")
			.addText((text) =>
				text
					.setPlaceholder("Imports")
					.setValue(this.plugin.settings.defaultImportDir)
					.onChange(async (v) => {
						this.plugin.settings.defaultImportDir = v.trim() || "Imports";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Concurrency")
			.setDesc("Maximum number of provider operations to run in parallel (1-16).")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.concurrency))
					.onChange(async (v) => {
						const n = Number.parseInt(v, 10);
						if (Number.isFinite(n) && n >= 1 && n <= 16) {
							this.plugin.settings.concurrency = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Developer log")
			.setDesc("Print verbose diagnostics to the developer console (avoids secrets).")
			.addToggle((tog) =>
				tog.setValue(this.plugin.settings.developerLog).onChange(async (v) => {
					this.plugin.settings.developerLog = v;
					await this.plugin.saveSettings();
				}),
			);

		containerEl.createEl("h2", { text: "MCP Servers" });
		containerEl.createEl("p", {
			text: "Configure Model Context Protocol servers to extend the plugin with custom tools and integrations.",
		});

		for (const server of this.plugin.settings.mcpServers) {
			this.renderMcpServerSettings(containerEl, server);
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("Add MCP server")
				.setCta()
				.onClick(async () => {
					const id = crypto.randomUUID();
					const newServer: McpServerConfig = {
						id,
						...DEFAULT_MCP_SERVER_CONFIG,
						displayName: "New MCP Server",
					};
					this.plugin.settings.mcpServers.push(newServer);
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}

	private renderMcpServerSettings(containerEl: HTMLElement, server: McpServerConfig): void {
		const heading = containerEl.createEl("h3", { text: server.displayName || "Unnamed Server" });

		new Setting(containerEl)
			.setName("Display name")
			.addText((text) =>
				text
					.setValue(server.displayName)
					.onChange(async (v) => {
						server.displayName = v;
						heading.setText(v || "Unnamed Server");
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Transport type")
			.addDropdown((dd) =>
				dd
					.addOptions({ http: "HTTP", stdio: "Stdio" })
					.setValue(server.transportType ?? "http")
					.onChange(async (v) => {
						server.transportType = v as "http" | "stdio";
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		const transportType = server.transportType ?? "http";

		if (transportType === "http") {
			new Setting(containerEl)
				.setName("URL")
				.setDesc("The MCP server endpoint URL (e.g. https://example.com/mcp)")
				.addText((text) =>
					text
						.setValue(server.url ?? "")
						.onChange(async (v) => {
							server.url = v;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Headers")
				.setDesc("Optional HTTP headers as JSON (e.g. { \"Authorization\": \"Bearer ...\" })")
				.addTextArea((ta) =>
					ta
						.setValue(JSON.stringify(server.headers ?? {}, null, 2))
						.onChange(async (v) => {
							try {
								server.headers = JSON.parse(v || "{}") as Record<string, string>;
								await this.plugin.saveSettings();
							} catch {
								new Notice("Invalid JSON in headers field");
							}
						}),
				);
		} else {
			new Setting(containerEl)
				.setName("Command")
				.setDesc("Executable to run (e.g. npx, python, uvx)")
				.addText((text) =>
					text
						.setValue(server.command ?? "")
						.setPlaceholder("npx")
						.onChange(async (v) => {
							server.command = v;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Args")
				.setDesc("Command line arguments (space-separated, e.g. -y @modelcontextprotocol/server-memory)")
				.addText((text) =>
					text
						.setValue(server.args?.join(" ") ?? "")
						.setPlaceholder("-y @modelcontextprotocol/server-memory")
						.onChange(async (v) => {
							server.args = v.trim() ? v.trim().split(/\s+/) : [];
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Env")
				.setDesc("Environment variables as JSON (e.g. { \"KEY\": \"value\" })")
				.addTextArea((ta) =>
					ta
						.setValue(JSON.stringify(server.env ?? {}, null, 2))
						.onChange(async (v) => {
							try {
								server.env = JSON.parse(v || "{}") as Record<string, string>;
								await this.plugin.saveSettings();
							} catch {
								new Notice("Invalid JSON in env field");
							}
						}),
				);
		}

		new Setting(containerEl)
			.setName("Enabled")
			.addToggle((tog) =>
				tog.setValue(server.enabled).onChange(async (v) => {
					server.enabled = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Trusted")
			.setDesc("Allow this server to execute tools and access your vault data")
			.addToggle((tog) =>
				tog.setValue(server.trusted).onChange(async (v) => {
					server.trusted = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Test connection")
			.addButton((btn) =>
				btn
					.setButtonText("Test")
					.onClick(async () => {
						const tt = server.transportType ?? "http";
						if (tt === "stdio") {
							if (!server.command) {
								new Notice("Please enter a command first");
								return;
							}
						} else {
							if (!server.url) {
								new Notice("Please enter a URL first");
								return;
							}
						}
						const notice = new Notice("Testing connection...", 0);
						try {
							const client = new McpClient(server);
							await client.connect();
							const state = client.getState();
							await client.disconnect();
							notice.hide();
							if (state.status === "connected" && state.serverInfo) {
								new Notice(
									`Connected to ${state.serverInfo.name} v${state.serverInfo.version}`,
								);
							} else {
								new Notice(`Connection failed: ${state.error ?? "Unknown error"}`);
							}
						} catch (err) {
							notice.hide();
							new Notice(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
						}
					}),
			);

		new Setting(containerEl)
			.setName("Delete server")
			.addButton((btn) =>
				btn
					.setButtonText("Delete")
					.setWarning()
					.onClick(async () => {
						const idx = this.plugin.settings.mcpServers.findIndex((s) => s.id === server.id);
						if (idx >= 0) {
							this.plugin.settings.mcpServers.splice(idx, 1);
							await this.plugin.saveSettings();
							this.display();
						}
					}),
			);
	}
}
