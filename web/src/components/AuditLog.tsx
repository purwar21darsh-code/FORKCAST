import { formatTimestamp } from "../format";
import type { ActivityEvent } from "../types";

export function AuditLog({ events }: { events: ActivityEvent[] }) {
  const visible = events.slice(0, 14);
  return (
    <section className="audit-panel" aria-labelledby="audit-heading">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Local audit trail</div>
          <h2 id="audit-heading">What actually happened</h2>
        </div>
        <span className="section-count">{events.length} persisted events</span>
      </div>
      {visible.length === 0 ? (
        <p className="empty-note">
          No server events yet. The audit trail is written by the MCP server when real actions occur.
        </p>
      ) : (
        <ol className="audit-list">
          {visible.map((event) => (
            <li key={event.id} className={"audit-entry audit-entry--" + event.severity}>
              <div className="audit-entry__rail" aria-hidden="true" />
              <div className="audit-entry__body">
                <div className="audit-entry__meta">
                  <time dateTime={event.atIso}>{formatTimestamp(event.atIso)}</time>
                  <span>{event.type.replaceAll("_", " ")}</span>
                </div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
