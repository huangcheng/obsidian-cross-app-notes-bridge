import { App, PluginSettingTab, Setting } from "obsidian";
import type AdvancedImportExportPlugin from "../main";

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

		containerEl.createEl("h2", { text: "External providers" });
		containerEl.createEl("p", {
			text: "Provider management UI lands with the CLI / MCP / HTTP adapters in the next milestone.",
		});
	}
}
