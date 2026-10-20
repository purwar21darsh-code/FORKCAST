import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import path from "node:path";
import { DemoStore } from "./store.js";
import { ForkcastService } from "./service.js";
import { createForkcastMcpServer } from "./mcp.js";

const MAX_BODY_BYTES = 1_000_000;
const MAX_SESSIONS = 64;
const DEFAULT_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"];

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

export interface StartedForkcastServer {
  httpServer: Server;
  store: DemoStore;
  service: ForkcastService;
  port: number;
  host: string;
  endpoint: string;
  allowedOrigins: string[];
  close: () => Promise<void>;
}

export interface StartForkcastServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  allowedOrigins?: string[];
}

function allowedOriginSet(extra?: string[]): Set<string> {
  const envOrigins = (process.env.FORKCAST_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...envOrigins, ...(extra ?? [])]);
}

function corsHeaders(req: IncomingMessage, res: ServerResponse, origins: Set<string>): boolean {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!origin) return true;
  if (!origins.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
  return true;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function rpcError(res: ServerResponse, status: number, code: number, message: string): void {
  sendJson(res, status, {
    jsonrpc: "2.0",
    error: { code, message },
    id: null
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const declared = Number(req.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new Error("Request body exceeds 1 MB.");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error("Request body exceeds 1 MB.");
    chunks.push(buffer);
  }
  if (total === 0) throw new Error("Request body is empty.");
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Request body is not valid JSON.");
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function startForkcastServer(
  options: StartForkcastServerOptions = {}
): Promise<StartedForkcastServer> {
  const host = options.host ?? process.env.MCP_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.PORT ?? 4179);
  const dataDir = path.resolve(
    options.dataDir ?? process.env.FORKCAST_DATA_DIR ?? path.join(process.cwd(), "data")
  );
  const origins = allowedOriginSet(options.allowedOrigins);
  const store = await DemoStore.open(dataDir);
  const service = new ForkcastService(store);
  const sessions = new Map<string, Session>();
  let closing = false;

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    const pathname = url.pathname;

    const originAllowed = corsHeaders(req, res, origins);
    if (!originAllowed) {
      sendJson(res, 403, { error: "Origin is not allowed for the local MCP endpoint." });
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        service: "forkcast",
        transport: "streamable-http",
        endpoint: "/mcp",
        demoRevision: store.worldRevision,
        dataMode: "local-demo"
      });
      return;
    }

    if (pathname === "/" && req.method === "GET") {
      sendJson(res, 200, {
        name: "FORKCAST MCP server",
        version: "0.1.0",
        mcpEndpoint: "/mcp",
        protocol: "MCP 2025-11-25 over Streamable HTTP",
        note: "Local deterministic demonstration. No real purchases, messages, bookings or device control."
      });
      return;
    }

    if (pathname !== "/mcp") {
      sendJson(res, 404, { error: "Not found. The MCP endpoint is /mcp." });
      return;
    }

    if (req.method !== "POST" && req.method !== "GET" && req.method !== "DELETE") {
      res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const sessionId = headerValue(req.headers["mcp-session-id"]);

    try {
      if (req.method === "POST") {
        const contentType = headerValue(req.headers["content-type"]) ?? "";
        if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
          rpcError(res, 415, -32600, "Content-Type must be application/json.");
          return;
        }
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch (error) {
          rpcError(res, 400, -32700, error instanceof Error ? error.message : "Invalid JSON body.");
          return;
        }

        if (!sessionId) {
          if (sessions.size >= MAX_SESSIONS) {
            res.setHeader("Retry-After", "30");
            rpcError(res, 503, -32000, "Too many active MCP sessions. Retry after closing one.");
            return;
          }
          let transport: StreamableHTTPServerTransport | undefined;
          const mcp = createForkcastMcpServer(service);
          const activeTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: false,
            onsessioninitialized: (id) => {
              if (transport) sessions.set(id, { transport, server: mcp });
            },
            onsessionclosed: (id) => {
              sessions.delete(id);
            }
          });
          transport = activeTransport;
          await mcp.connect(activeTransport as unknown as Transport);
          await activeTransport.handleRequest(req, res, body);
          return;
        }

        const session = sessions.get(sessionId);
        if (!session) {
          rpcError(res, 404, -32001, "Unknown or expired MCP session. Re-initialize.");
          return;
        }
        await session.transport.handleRequest(req, res, body);
        return;
      }

      if (!sessionId) {
        rpcError(res, 400, -32002, "Mcp-Session-Id is required for GET and DELETE.");
        return;
      }
      const session = sessions.get(sessionId);
      if (!session) {
        rpcError(res, 404, -32001, "Unknown or expired MCP session. Re-initialize.");
        return;
      }
      await session.transport.handleRequest(req, res);
    } catch (error) {
      if (!res.headersSent) {
        rpcError(res, 500, -32603, error instanceof Error ? error.message : "Internal server error.");
      } else {
        res.end();
      }
    }
  });

  httpServer.on("clientError", (_error, socket) => {
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => resolve());
  });

  const address = httpServer.address() as AddressInfo;
  const actualPort = address.port;
  const endpoint = `http://${host}:${actualPort}/mcp`;
  service.setEndpoint(endpoint);

  const close = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    for (const session of sessions.values()) {
      await session.server.close().catch(() => undefined);
    }
    sessions.clear();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
      httpServer.closeAllConnections();
    });
  };

  return {
    httpServer,
    store,
    service,
    port: actualPort,
    host,
    endpoint,
    allowedOrigins: [...origins],
    close
  };
}