import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolIcon } from "./Icons";

export function ToolInspector({
  tools,
  endpoint,
  protocolVersion,
  serverName,
  connected
}: {
  tools: Tool[];
  endpoint: string;
  protocolVersion: string | null;
  serverName: string;
  connected: boolean;
}) {
  return (
    <details className="tool-inspector">
      <summary>
        <ToolIcon size={15} />
        <span>
          {tools.length} MCP tool{tools.length === 1 ? "" : "s"} discovered
        </span>
      </summary>
      <div className="tool-inspector__body">
        <dl className="connection-facts">
          <div>
            <dt>Server</dt>
            <dd>{serverName}</dd>
          </div>
          <div>
            <dt>Protocol</dt>
            <dd>{protocolVersion ?? "negotiating"}</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>Streamable HTTP</dd>
          </div>
          <div>
            <dt>Endpoint</dt>
            <dd className="mono">{endpoint}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{connected ? "Initialized" : "Offline"}</dd>
          </div>
        </dl>
        <ul className="tool-list">
          {tools.map((tool) => (
            <li key={tool.name}>
              <div className="tool-list__head">
                <code>{tool.name}</code>
                {tool.annotations?.readOnlyHint ? (
                  <span className="micro-tag">read-only</span>
                ) : tool.annotations?.destructiveHint ? (
                  <span className="micro-tag micro-tag--warn">demo write</span>
                ) : (
                  <span className="micro-tag">compute</span>
                )}
              </div>
              <p>{tool.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
