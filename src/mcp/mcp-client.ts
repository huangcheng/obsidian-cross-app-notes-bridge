import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
	McpServerConfig,
	McpToolDefinition,
	McpToolCallResult,
	McpConnectionState,
} from "./types.js";

const _devLog = (..._args: unknown[]): void => {};

export class McpClient {
	private readonly client: Client;
	private readonly transport: StreamableHTTPClientTransport | StdioClientTransport;
	private state: McpConnectionState = {
		status: "disconnected",
		tools: [],
	};

	constructor(config: McpServerConfig) {
		this.client = new Client({
			name: config.displayName,
			version: "1.0.0",
		});
		const transportType = config.transportType ?? "http";
		if (transportType === "stdio") {
			if (!config.command) throw new Error("stdio transport requires command");
			this.transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: config.env,
			});
		} else {
			if (!config.url) throw new Error("http transport requires url");
			this.transport = new StreamableHTTPClientTransport(new URL(config.url), {
				requestInit: config.headers ? { headers: config.headers } : undefined,
			});
		}
	}

	async connect(): Promise<void> {
		try {
			this.state = { ...this.state, status: "connecting" };
			await this.client.connect(this.transport);
			const toolsResult = await this.client.listTools();
			this.state = {
				status: "connected",
				tools: (toolsResult.tools as McpToolDefinition[]) ?? [],
			};
		} catch (err) {
			this.state = { ...this.state, status: "error", error: String(err) };
			throw err;
		}
	}

	async disconnect(): Promise<void> {
		try {
			await this.client.close();
			this.state = { status: "disconnected", tools: [] };
		} catch (err) {
			this.state = { ...this.state, status: "error", error: String(err) };
			throw err;
		}
	}

	async invokeTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<McpToolCallResult> {
		try {
			const result = await this.client.callTool({ name, arguments: args });
			return {
				content: result.content as McpToolCallResult["content"],
				isError: result.isError as boolean | undefined,
			};
		} catch (err) {
			_devLog("McpClient.invokeTool error", name, args, err);
			throw err;
		}
	}

	getState(): McpConnectionState {
		return this.state;
	}

	getTools(): McpToolDefinition[] {
		return this.state.tools;
	}
}
