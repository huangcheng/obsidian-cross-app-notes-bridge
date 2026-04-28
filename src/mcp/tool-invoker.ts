import { App, normalizePath, Notice } from "obsidian";
import { McpClient } from "./mcp-client";
import { McpToolCallResult, McpToolDefinition } from "./types";

export interface ImportFromToolParams {
	app: App;
	result: McpToolCallResult;
	toolName: string;
	destDir: string;
	title?: string;
}

export interface ExportToToolParams {
	client: McpClient;
	toolName: string;
	content: string;
	title: string;
	extraArgs?: Record<string, unknown>;
}

export function textContentFromResult(result: McpToolCallResult): string {
	const texts: string[] = [];
	for (const item of result.content) {
		if (item.type === "text") {
			texts.push(item.text);
		}
	}
	return texts.join("\n");
}

export function findToolByCapability(
	tools: McpToolDefinition[],
	keywords: string[],
): McpToolDefinition | null {
	const lowerKeywords = keywords.map((k) => k.toLowerCase());
	for (const tool of tools) {
		const nameMatch = lowerKeywords.some((k) => tool.name.toLowerCase().includes(k));
		if (nameMatch) return tool;
		const descMatch = tool.description
			? lowerKeywords.some((k) => tool.description!.toLowerCase().includes(k))
			: false;
		if (descMatch) return tool;
	}
	return null;
}

export async function importFromToolResult(
	params: ImportFromToolParams,
): Promise<string> {
	const { app, result, toolName, destDir, title } = params;

	if (result.isError) {
		const errorText = textContentFromResult(result);
		throw new Error(`Tool ${toolName} error: ${errorText || "Unknown error"}`);
	}

	const content = textContentFromResult(result);
	const adapter = app.vault.adapter;
	const dir = normalizePath(destDir);

	if (!await adapter.exists(dir)) {
		await app.vault.createFolder(dir);
	}

	const noteTitle = title || toolName;
	const safeTitle = noteTitle.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Imported";
	const fileName = `${safeTitle}.md`;
	let filePath = normalizePath(`${dir}/${fileName}`);

	let finalPath = filePath;
	let counter = 1;
	while (await adapter.exists(finalPath)) {
		finalPath = normalizePath(`${dir}/${safeTitle} (${counter}).md`);
		counter++;
	}

	await adapter.write(finalPath, content);
	new Notice(`Imported to ${finalPath}`);
	return finalPath;
}

export async function exportToTool(
	params: ExportToToolParams,
): Promise<McpToolCallResult> {
	const { client, toolName, content, title, extraArgs = {} } = params;
	const result = await client.invokeTool(toolName, {
		content,
		title,
		...extraArgs,
	});
	return result;
}
