import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ErrorPayload } from "../types";

export const DEFAULT_MCP_URL =
  (import.meta.env.VITE_MCP_URL as string | undefined) ?? "http://127.0.0.1:4179/mcp";

export class McpToolError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "McpToolError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function extractError(result: unknown): McpToolError {
  const candidate = result as { content?: unknown; structuredContent?: unknown };
  const structured = candidate.structuredContent as ErrorPayload | undefined;
  if (structured?.error) {
    return new McpToolError(
      structured.error.code,
      structured.error.message,
      structured.error.details
    );
  }
  const content = candidate.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (
        item &&
        typeof item === "object" &&
        "type" in item &&
        item.type === "text" &&
        "text" in item &&
        typeof item.text === "string"
      ) {
        try {
          const parsed = JSON.parse(item.text) as ErrorPayload;
          if (parsed.error) {
            return new McpToolError(
              parsed.error.code,
              parsed.error.message,
              parsed.error.details
            );
          }
        } catch {
          return new McpToolError("TOOL_ERROR", item.text);
        }
      }
    }
  }
  return new McpToolError("TOOL_ERROR", "The MCP tool returned an error.");
}

/**
 * The browser is a genuine MCP client. Initialization, tool discovery and
 * every operation below go through the official TypeScript SDK Streamable HTTP
 * transport. There is no REST simulation bypass.
 */
export class ForkcastMcpClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private discoveredTools: Tool[] = [];
  readonly endpoint: string;

  constructor(endpoint = DEFAULT_MCP_URL) {
    this.endpoint = endpoint;
  }

  async connect(): Promise<{ tools: Tool[]; protocolVersion: string | null; serverName: string }> {
    await this.close();
    const client = new Client(
      { name: "forkcast-workstation", version: "0.1.0" },
      { capabilities: {} }
    );
    const transport = new StreamableHTTPClientTransport(new URL(this.endpoint));
    await client.connect(transport as unknown as Transport);
    const toolsResult = await client.listTools();
    this.client = client;
    this.transport = transport;
    this.discoveredTools = toolsResult.tools;
    return {
      tools: toolsResult.tools,
      protocolVersion: transport.protocolVersion ?? null,
      serverName: client.getServerVersion()?.name ?? "forkcast"
    };
  }

  get tools(): Tool[] {
    return [...this.discoveredTools];
  }

  get connected(): boolean {
    return this.client !== null;
  }

  async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.client) {
      throw new McpToolError("NOT_CONNECTED", "The MCP client is not connected.");
    }
    const result = await this.client.callTool({ name, arguments: args });
    if (result.isError) {
      throw extractError(result);
    }
    if (result.structuredContent) {
      return result.structuredContent as T;
    }
    const content = result.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (
          item &&
          typeof item === "object" &&
          "type" in item &&
          item.type === "text" &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return JSON.parse(item.text) as T;
        }
      }
    }
    throw new McpToolError("EMPTY_RESULT", "The MCP tool returned no structured result.");
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.transport = null;
    this.discoveredTools = [];
    if (client) {
      await client.close().catch(() => undefined);
    }
  }
}