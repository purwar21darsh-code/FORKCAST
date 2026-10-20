import { existsSync } from "node:fs";
import path from "node:path";
import { startForkcastServer } from "./http.js";

const envPath = path.resolve(".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}


const port = Number(process.env.PORT ?? 4179);
const host = process.env.MCP_HOST ?? "127.0.0.1";
const dataDir = path.resolve(process.env.FORKCAST_DATA_DIR ?? path.join(process.cwd(), "data"));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535.");
}

const running = await startForkcastServer({ port, host, dataDir });

console.log("FORKCAST MCP server");
console.log("  endpoint: " + running.endpoint);
console.log("  health:   http://" + host + ":" + running.port + "/health");
console.log("  protocol: MCP 2025-11-25, Streamable HTTP");
console.log("  data:     " + dataDir + " (local demonstration only)");
console.log("  revise:   demo revision " + running.store.worldRevision);

let stopping = false;
const shutdown = async (signal: string): Promise<void> => {
  if (stopping) return;
  stopping = true;
  console.log(`\n[${signal}] closing FORKCAST MCP server...`);
  await running.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));