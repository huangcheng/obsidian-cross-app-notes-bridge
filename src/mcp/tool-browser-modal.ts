import { App, Modal, Setting } from "obsidian";
import { McpToolDefinition, McpToolCallResult } from "./types";
import { McpClient } from "./mcp-client";

export class McpToolBrowserModal extends Modal {
	private toolCards: Map<string, HTMLElement> = new Map();
	private resultEls: Map<string, HTMLElement> = new Map();
	private inputValues: Map<string, Map<string, string>> = new Map();
	private runningTools: Set<string> = new Set();

	constructor(
		app: App,
		private readonly client: McpClient,
		private readonly onComplete?: (result: McpToolCallResult, toolName: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		const state = this.client.getState();
		const serverName = state.serverInfo?.name ?? "Unknown Server";

		contentEl.createEl("h2", { text: `MCP Tools — ${serverName}` });

		const statusText =
			state.status === "connected"
				? `Connected · ${state.tools.length} tool${state.tools.length !== 1 ? "s" : ""} available`
				: `Status: ${state.status}`;
		const statusClass =
			state.status === "connected" ? "aie-mcp-status-connected" : "aie-mcp-status-other";
		contentEl.createEl("p", { text: statusText, cls: statusClass });

		if (state.status === "error") {
			contentEl.createEl("p", { text: `Error: ${state.error ?? "Unknown error"}`, cls: "aie-mcp-error" });
		}

		const tools = this.client.getTools();
		if (tools.length === 0) {
			contentEl.createEl("p", { text: "No tools available", cls: "aie-mcp-empty" });
		} else {
			for (const tool of tools) {
				this.renderToolCard(contentEl, tool);
			}
		}

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Close").onClick(() => this.close()),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderToolCard(container: HTMLElement, tool: McpToolDefinition): void {
		const card = container.createDiv({ cls: "aie-mcp-tool-card" });
		this.toolCards.set(tool.name, card);

		card.createEl("h3", { text: tool.name, cls: "aie-mcp-tool-name" });

		if (tool.description) {
			card.createEl("p", { text: tool.description, cls: "aie-mcp-tool-desc" });
		}

		const schema = tool.inputSchema;
		if (schema.properties && Object.keys(schema.properties).length > 0) {
			const propsContainer = card.createDiv({ cls: "aie-mcp-tool-props" });
			propsContainer.createEl("p", { text: "Parameters:", cls: "aie-mcp-tool-params-label" });

			const requiredFields = schema.required ?? [];
			const propInputs = new Map<string, string>();

			for (const [propName, propDef] of Object.entries(schema.properties)) {
				const isRequired = requiredFields.includes(propName);
				const propValue = propDef as { description?: string; type?: string };

				new Setting(propsContainer)
					.setName(`${propName}${isRequired ? " *" : ""}`)
					.setDesc(propValue.description ?? `Type: ${propValue.type ?? "any"}`)
					.addText((text) =>
						text.setPlaceholder(`${propName}`).onChange((v) => {
							propInputs.set(propName, v);
							this.inputValues.set(tool.name, propInputs);
						}),
					);
			}

			this.inputValues.set(tool.name, propInputs);
		}

		const resultContainer = card.createDiv({ cls: "aie-mcp-tool-result" });
		this.resultEls.set(tool.name, resultContainer);

		new Setting(card).addButton((btn) =>
			btn
				.setButtonText("Run tool")
				.setCta()
				.onClick(() => this.runTool(tool, resultContainer)),
		);
	}

	private async runTool(tool: McpToolDefinition, resultContainer: HTMLElement): Promise<void> {
		if (this.runningTools.has(tool.name)) {
			return;
		}

		this.runningTools.add(tool.name);
		resultContainer.empty();
		resultContainer.createEl("p", { text: "Running...", cls: "aie-mcp-running" });

		const args = this.inputValues.get(tool.name) ?? new Map<string, string>();
		const argsRecord: Record<string, unknown> = Object.fromEntries(args);

		try {
			const result = await this.client.invokeTool(tool.name, argsRecord);
			this.displayResult(tool.name, result, resultContainer);
			this.onComplete?.(result, tool.name);
		} catch (err) {
			resultContainer.empty();
			resultContainer.createEl("p", {
				text: `Error: ${err instanceof Error ? err.message : String(err)}`,
				cls: "aie-mcp-error",
			});
		} finally {
			this.runningTools.delete(tool.name);
		}
	}

	private displayResult(toolName: string, result: McpToolCallResult, container: HTMLElement): void {
		container.empty();

		if (result.isError) {
			container.createEl("p", { text: "Error", cls: "aie-mcp-error" });
		}

		for (const content of result.content) {
			if (content.type === "text") {
				container.createEl("p", { text: content.text, cls: "aie-mcp-result-text" });
			} else if (content.type === "image") {
				const imgNote = container.createEl("p", {
					text: `[Image: ${content.mimeType} (base64 data, ${content.data.length} bytes)]`,
					cls: "aie-mcp-result-image",
				});
				container.appendChild(imgNote);
			} else if (content.type === "resource") {
				if (content.resource.uri) {
					container.createEl("p", {
						text: `[Resource: ${content.resource.uri}]`,
						cls: "aie-mcp-result-resource",
					});
				} else if (content.resource.text) {
					container.createEl("p", {
						text: content.resource.text,
						cls: "aie-mcp-result-resource",
					});
				} else {
					container.createEl("p", {
						text: "[resource]",
						cls: "aie-mcp-result-resource",
					});
				}
			}
		}
	}
}