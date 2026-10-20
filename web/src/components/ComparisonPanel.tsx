import { formatDelta, formatTime, shortId } from "../format";
import type { RepairPayload, ScenarioAnalysisPayload } from "../types";
import { AlertIcon, ArrowIcon, BranchIcon, CheckIcon } from "./Icons";
import { StatusBadge } from "./StatusBadge";

function verdictTone(analysis: ScenarioAnalysisPayload): "success" | "danger" | "warning" {
  if (analysis.comparison.verdict === "failed") return "danger";
  if (analysis.comparison.verdict === "passed-with-degradation") return "warning";
  return "success";
}

export function ComparisonPanel({
  analysis,
  repair,
  busy,
  disabled,
  onRepair
}: {
  analysis: ScenarioAnalysisPayload | null;
  repair: RepairPayload | null;
  busy: boolean;
  disabled: boolean;
  onRepair: (analysisId: string) => void;
}) {
  if (!analysis) {
    return (
      <section className="comparison-panel comparison-panel--empty" aria-labelledby="comparison-heading">
        <div className="section-kicker">Counterfactual comparison</div>
        <h2 id="comparison-heading">A branch is waiting</h2>
        <p>
          Choose one of the four faults. FORKCAST will call the MCP simulation tool, clone the
          world, apply only that fault and calculate which constraints break.
        </p>
        <div className="empty-diagram" aria-hidden="true">
          <span className="empty-node">BASELINE</span>
          <span className="empty-line" />
          <span className="empty-node empty-node--fault">FAULT</span>
          <span className="empty-line" />
          <span className="empty-node empty-node--fail">CALCULATED</span>
        </div>
      </section>
    );
  }

  const { comparison } = analysis;
  const tone = verdictTone(analysis);
  const hasRepair = Boolean(repair?.proposalReady || repair?.result.status === "not-needed");

  return (
    <section className="comparison-panel" aria-labelledby="comparison-heading">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Counterfactual comparison / calculated evidence</div>
          <h2 id="comparison-heading">
            {analysis.scenario.name}
            <span className="heading-note">analysis {shortId(analysis.analysisId)}</span>
          </h2>
        </div>
        <StatusBadge tone={tone}>
          {comparison.verdict === "failed"
            ? "Hard constraints broken"
            : comparison.verdict === "passed-with-degradation"
              ? "Survives with degradation"
              : "Plan survives"}
        </StatusBadge>
      </div>

      <div className="comparison-stats">
        <div className="stat-block">
          <span className="data-label">Baseline finish</span>
          <strong>{formatTime(comparison.baselineCompletionMinute)}</strong>
          <span className="stat-foot">
            {comparison.baselineDeadlineMet ? "deadline met" : "deadline missed"}
          </span>
        </div>
        <div className="stat-arrow" aria-hidden="true">
          <ArrowIcon size={24} />
        </div>
        <div className={"stat-block stat-block--" + tone}>
          <span className="data-label">Faulted finish</span>
          <strong>{formatTime(comparison.faultedCompletionMinute)}</strong>
          <span className="stat-foot">
            {formatDelta(comparison.completionDeltaMinutes)} ·{" "}
            {comparison.faultedDeadlineMet ? "deadline met" : "deadline missed"}
          </span>
        </div>
        <div className="stat-block">
          <span className="data-label">Faulted slack</span>
          <strong>{comparison.faultedSlackMinutes ?? "—"} min</strong>
          <span className="stat-foot">baseline {comparison.baselineSlackMinutes ?? "—"} min</span>
        </div>
        <div className="stat-block">
          <span className="data-label">Affected tasks</span>
          <strong>{comparison.affectedTasks.length}</strong>
          <span className="stat-foot">calculated start/end changes</span>
        </div>
      </div>

      <p className="comparison-explanation">{comparison.explanation}</p>

      <div className="comparison-columns">
        <div>
          <h3 className="subheading">
            <AlertIcon size={15} /> New hard constraints
          </h3>
          {comparison.newlyViolatedConstraints.length > 0 ? (
            <ul className="violation-list">
              {comparison.newlyViolatedConstraints.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          ) : (
            <p className="ok-note">
              <CheckIcon size={15} /> No hard constraint was newly violated.
            </p>
          )}

          {comparison.newWarnings.length > 0 ? (
            <>
              <h3 className="subheading subheading--space">New warnings</h3>
              <ul className="warning-list">
                {comparison.newWarnings.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="fault-details">
            {comparison.missingIngredientIds.length > 0 ? (
              <p>
                <span className="data-label">Missing ingredients</span>{" "}
                {comparison.missingIngredientIds.join(", ")}
              </p>
            ) : null}
            {comparison.unavailableResourceIds.length > 0 ? (
              <p>
                <span className="data-label">Unavailable resources</span>{" "}
                {comparison.unavailableResourceIds.join(", ")}
              </p>
            ) : null}
            {comparison.skippedOptionalTaskIds.length > 0 ? (
              <p>
                <span className="data-label">Optional tasks omitted</span>{" "}
                {comparison.skippedOptionalTaskIds.join(", ")}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="subheading">
            <BranchIcon size={15} /> Affected tasks
          </h3>
          {comparison.affectedTasks.length > 0 ? (
            <div className="diff-table-wrap">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Baseline</th>
                    <th scope="col">Faulted</th>
                    <th scope="col">Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.affectedTasks.map((task) => (
                    <tr key={task.taskId}>
                      <th scope="row">{task.name}</th>
                      <td>{formatTime(task.baselineStart)}</td>
                      <td>
                        {task.faultedStatus === "scheduled"
                          ? formatTime(task.faultedStart)
                          : task.faultedStatus}
                      </td>
                      <td>{formatDelta(task.startDeltaMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ok-note">No task start time changed.</p>
          )}
        </div>
      </div>

      <div className="comparison-actions">
        {comparison.verdict === "failed" ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => onRepair(analysis.analysisId)}
            disabled={busy || disabled}
          >
            {busy
              ? "Searching defined alternatives…"
              : repair
                ? "Re-run repair search"
                : "Find and verify a repair"}
            <ArrowIcon size={16} />
          </button>
        ) : (
          <p className="not-needed">
            {repair?.result.status === "not-needed"
              ? "FORKCAST searched for a repair only after failure and correctly found none was needed."
              : "This branch does not require a repair. No success badge has been invented."}
          </p>
        )}
        {repair ? (
          <a className="text-link" href="#repair-workspace">
            {hasRepair ? "Inspect repair evidence" : "Inspect search result"}
          </a>
        ) : null}
      </div>
    </section>
  );
}