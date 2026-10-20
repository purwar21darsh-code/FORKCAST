import { useEffect, useState } from "react";
import { formatTime, formatTimestamp } from "../format";
import type {
  CommitPayload,
  ExecutionRecord,
  PreviewCommitPayload,
  WorldState
} from "../types";
import { CheckIcon, DatabaseIcon, LockIcon, RefreshIcon, ShieldIcon, XIcon } from "./Icons";
import { StatusBadge } from "./StatusBadge";

export function ExecutionReview({
  preview,
  committed,
  appliedExecution,
  world,
  busy,
  disabled,
  onApprove,
  onCancel,
  onReset
}: {
  preview: PreviewCommitPayload | null;
  committed: CommitPayload | null;
  appliedExecution: ExecutionRecord | null;
  world: WorldState | null;
  busy: boolean;
  disabled: boolean;
  onApprove: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  useEffect(() => {
    setConfirmed(false);
  }, [preview?.approvalToken]);

  useEffect(() => {
    setResetArmed(false);
  }, [appliedExecution?.planId, world?.revision]);

  const execution = committed?.execution ?? appliedExecution;
  const changes = preview?.preview.inventoryChanges ?? committed?.inventoryChanges ?? [];

  return (
    <section className="execution-panel" id="execution-review" aria-labelledby="execution-heading">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Approval / local demonstration write</div>
          <h2 id="execution-heading">
            Execution review
            <span className="heading-note">nothing here touches the real world</span>
          </h2>
        </div>
        {committed ? (
          <StatusBadge tone="success">Applied to demo data</StatusBadge>
        ) : preview ? (
          <StatusBadge tone="warning">Awaiting explicit approval</StatusBadge>
        ) : execution ? (
          <StatusBadge tone="success">Demo already applied</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">No pending write</StatusBadge>
        )}
      </div>

      {committed ? (
        <div className="applied-card">
          <div className="applied-card__icon">
            <CheckIcon size={32} />
          </div>
          <div>
            <strong>{committed.execution.mealName} was applied to the local demo dataset.</strong>
            <p>
              Recorded at {formatTimestamp(committed.execution.appliedAtIso)} · demo revision{" "}
              {committed.worldRevision} · projected finish{" "}
              {formatTime(committed.execution.completionMinute)}.
            </p>
          </div>
        </div>
      ) : execution ? (
        <div className="applied-card">
          <div className="applied-card__icon">
            <DatabaseIcon size={30} />
          </div>
          <div>
            <strong>{execution.mealName} is already recorded in the local demo dataset.</strong>
            <p>
              Applied {formatTimestamp(execution.appliedAtIso)} · finish{" "}
              {formatTime(execution.completionMinute)}. Reset the demo before another approval flow.
            </p>
          </div>
        </div>
      ) : preview ? (
        <>
          <div className="approval-banner">
            <LockIcon size={20} />
            <div>
              <strong>Review every change before writing.</strong>
              <p>
                This token is single-use and expires at {formatTimestamp(preview.expiresAtIso)}.
                Cancel performs no write.
              </p>
            </div>
          </div>

          <div className="execution-grid">
            <div>
              <h3 className="subheading">Exact local changes</h3>
              <p className="preview-summary">{preview.preview.summary}</p>
              <div className="diff-table-wrap">
                <table className="diff-table inventory-table">
                  <thead>
                    <tr>
                      <th scope="col">Ingredient</th>
                      <th scope="col">Before</th>
                      <th scope="col">Use</th>
                      <th scope="col">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((change) => (
                      <tr key={change.ingredientId}>
                        <th scope="row">{change.name}</th>
                        <td>
                          {change.before} {change.unit}
                        </td>
                        <td>−{change.consumed} {change.unit}</td>
                        <td>
                          {change.after} {change.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="subheading subheading--space">What will be recorded</h3>
              <ul className="recorded-list">
                <li>
                  Applied execution for <strong>{preview.preview.mealName}</strong> (
                  {preview.preview.taskCount} scheduled tasks).
                </li>
                <li>
                  Projected completion {formatTime(preview.preview.completionMinute)}; guest
                  deadline {formatTime(preview.preview.deadlineMinute)}.
                </li>
                <li>
                  Demo revision {preview.preview.revisionBefore} →{" "}
                  {preview.preview.revisionAfter}.
                </li>
                <li>A real audit event in the persisted local activity history.</li>
              </ul>
            </div>

            <div className="approval-box">
              <h3 className="subheading">
                <ShieldIcon size={15} /> Explicit approval
              </h3>
              <p>
                This is a write to <code>data/demo-state.json</code> only. It will consume the
                listed simulated inventory. It will not purchase, book, message or control a
                device.
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  I reviewed the exact changes and approve writing them to the local demo dataset.
                </span>
              </label>
              <label className="phrase-row">
                <span>Approval phrase sent to MCP</span>
                <code>APPROVE LOCAL DEMO COMMIT</code>
              </label>
              <div className="approval-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={onApprove}
                  disabled={!confirmed || busy || disabled}
                >
                  {busy ? "Applying…" : "Approve and apply"}
                  <CheckIcon size={16} />
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={onCancel}
                  disabled={busy}
                >
                  Cancel — no write
                </button>
              </div>
              <p className="fine-print">
                The server will reject a stale revision, an expired token, a reused token or a
                repeat commit.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="execution-empty">
          <DatabaseIcon size={28} />
          <div>
            <strong>No commit is prepared.</strong>
            <p>
              A feasible repaired plan can be reviewed here. The server generates a fresh
              single-use approval token only after a read-only commit preview.
            </p>
          </div>
        </div>
      )}

      <div className="demo-controls">
        <div>
          <span className="data-label">Dedicated demo dataset</span>
          <p>
            Current revision {world?.revision ?? "—"} · applied execution{" "}
            {appliedExecution ? appliedExecution.planId : "none"}.
          </p>
        </div>
        <div className="demo-controls__actions">
          {resetArmed ? (
            <>
              <span className="reset-warning">Reset only the local demo seed?</span>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={onReset}
                disabled={busy}
              >
                Confirm reset
              </button>
              <button
                type="button"
                className="button button--small button--ghost"
                onClick={() => setResetArmed(false)}
                disabled={busy}
              >
                Keep data
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button--small button--ghost"
              onClick={() => setResetArmed(true)}
              disabled={busy}
            >
              <RefreshIcon size={14} /> Reset demo data
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
