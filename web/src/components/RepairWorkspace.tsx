import { formatDelta, formatTime } from "../format";
import type { RepairPayload, ScenarioAnalysisPayload } from "../types";
import { AlertIcon, ArrowIcon, CheckIcon, ShieldIcon, XIcon } from "./Icons";
import { StatusBadge } from "./StatusBadge";

function repairTone(status: RepairPayload["result"]["status"]): "success" | "danger" | "warning" | "info" {
  if (status === "feasible") return "success";
  if (status === "not-needed") return "info";
  if (status === "search-limit" || status === "simulation-error") return "warning";
  return "danger";
}

export function RepairWorkspace({
  analysis,
  repair,
  busy,
  disabled,
  hasPreview,
  onPreview
}: {
  analysis: ScenarioAnalysisPayload | null;
  repair: RepairPayload | null;
  busy: boolean;
  disabled: boolean;
  hasPreview: boolean;
  onPreview: (planId: string) => void;
}) {
  if (!analysis) {
    return (
      <section className="repair-panel repair-panel--empty" id="repair-workspace">
        <div className="section-kicker">Repair workspace</div>
        <h2>No failure selected yet</h2>
        <p>Repair search begins only after a calculated scenario failure.</p>
      </section>
    );
  }

  if (!repair) {
    return (
      <section className="repair-panel repair-panel--empty" id="repair-workspace">
        <div className="section-kicker">Repair workspace</div>
        <h2>
          {analysis.comparison.verdict === "failed"
            ? "Failure calculated. Repair not requested."
            : "No repair required for this branch."}
        </h2>
        <p>
          {analysis.comparison.verdict === "failed"
            ? "Run the repair search from the comparison panel. It evaluates only defined meals and deterministic task orders, then independently re-schedules the candidate."
            : "FORKCAST does not invent a repair when the faulted plan already satisfies every hard constraint."}
        </p>
      </section>
    );
  }

  const result = repair.result;
  const tone = repairTone(result.status);
  const verified = result.status === "feasible" && repair.verification?.verified === true;
  const repairedSchedule = repair.repairedSchedule;
  const originalFaultedCompletion = analysis.faulted.schedule.completionMinute;

  return (
    <section className="repair-panel" id="repair-workspace" aria-labelledby="repair-heading">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Repair workspace / verified counterfactual</div>
          <h2 id="repair-heading">
            {verified ? "A repaired future" : "Repair search result"}
            <span className="heading-note">
              {result.search.evaluated} of {result.search.limit} candidates calculated
            </span>
          </h2>
        </div>
        <StatusBadge tone={tone}>
          {result.status === "feasible"
            ? "Repair feasible"
            : result.status === "not-needed"
              ? "No repair needed"
              : result.status === "no-feasible-repair"
                ? "No feasible repair"
                : result.status === "search-limit"
                  ? "Search limit reached"
                  : "Simulation error"}
        </StatusBadge>
      </div>

      <div className="repair-verdict">
        <div className="repair-verdict__icon">
          {verified ? (
            <ShieldIcon size={34} />
          ) : result.status === "not-needed" ? (
            <CheckIcon size={34} />
          ) : (
            <AlertIcon size={34} />
          )}
        </div>
        <div>
          <strong>{result.explanation}</strong>
          <p>
            {verified
              ? "The badge is based on a fresh independent re-schedule, not on the search loop's own claim."
              : "FORKCAST reports only the scheduler result. It does not label an unverified candidate as successful."}
          </p>
        </div>
      </div>

      {result.status === "feasible" && repairedSchedule ? (
        <>
          <div className="repair-stats">
            <div className="stat-block">
              <span className="data-label">Original faulted finish</span>
              <strong>{formatTime(originalFaultedCompletion)}</strong>
              <span className="stat-foot">{analysis.scenario.name}</span>
            </div>
            <div className="stat-arrow" aria-hidden="true">
              <ArrowIcon size={22} />
            </div>
            <div className="stat-block stat-block--success">
              <span className="data-label">Repaired finish</span>
              <strong>{formatTime(repairedSchedule.completionMinute)}</strong>
              <span className="stat-foot">
                {formatDelta(
                  originalFaultedCompletion !== null && repairedSchedule.completionMinute !== null
                    ? repairedSchedule.completionMinute - originalFaultedCompletion
                    : null
                )}{" "}
                · {repairedSchedule.slackMinutes} min slack
              </span>
            </div>
            <div className="stat-block">
              <span className="data-label">Verification</span>
              <strong>{repair.verification?.verified ? "Re-scheduled" : "Not verified"}</strong>
              <span className="stat-foot">deadline {formatTime(repairedSchedule.deadlineMinute)}</span>
            </div>
            <div className="stat-block">
              <span className="data-label">Hard constraints relaxed</span>
              <strong>{result.constraintsRelaxed ? "Yes" : "None"}</strong>
              <span className="stat-foot">meal and order search only</span>
            </div>
          </div>

          <div className="repair-grid">
            <div>
              <h3 className="subheading">What changed</h3>
              <ul className="change-list">
                {repair.diff?.mealChanged ? (
                  <li>
                    <span className="change-marker">MEAL</span>
                    {repair.diff.originalMealName} → <strong>{repair.diff.repairedMealName}</strong>
                  </li>
                ) : (
                  <li>
                    <span className="change-marker">MEAL</span>
                    Kept {repair.diff?.repairedMealName ?? analysis.plan.mealName}
                  </li>
                )}
                {repair.diff?.addedTasks.map((task) => (
                  <li key={"add-" + task.id}>
                    <span className="change-marker">ADD</span>
                    {task.name}
                  </li>
                ))}
                {repair.diff?.removedTasks.map((task) => (
                  <li key={"remove-" + task.id}>
                    <span className="change-marker">REMOVE</span>
                    {task.name}
                  </li>
                ))}
                {repair.diff?.reorderedTaskIds.length ? (
                  <li>
                    <span className="change-marker">ORDER</span>
                    Reordered {repair.diff.reorderedTaskIds.join(", ")}
                  </li>
                ) : null}
                {repair.diff?.resourceAssignmentsChanged.map((change) => (
                  <li key={"resource-" + change.taskId}>
                    <span className="change-marker">RESOURCE</span>
                    {change.taskId}: {change.from.join(", ") || "none"} →{" "}
                    {change.to.join(", ") || "none"}
                  </li>
                ))}
                {repair.diff?.ingredientIdsAdded.length ? (
                  <li>
                    <span className="change-marker">INGREDIENT</span>
                    Added {repair.diff.ingredientIdsAdded.join(", ")}
                  </li>
                ) : null}
                {repair.diff?.ingredientIdsRemoved.length ? (
                  <li>
                    <span className="change-marker">INGREDIENT</span>
                    Removed {repair.diff.ingredientIdsRemoved.join(", ")}
                  </li>
                ) : null}
              </ul>
              <h3 className="subheading subheading--space">Trade-offs</h3>
              <ul className="tradeoff-list">
                {result.tradeoffs.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="subheading">
                <ShieldIcon size={15} /> Actual verification
              </h3>
              <dl className="verification-facts">
                <div>
                  <dt>Verified</dt>
                  <dd>{repair.verification?.verified ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Method</dt>
                  <dd>{repair.verification?.method}</dd>
                </div>
                <div>
                  <dt>Repair plan</dt>
                  <dd className="mono">{repairedSchedule.planId}</dd>
                </div>
                <div>
                  <dt>Projected completion</dt>
                  <dd>{formatTime(repairedSchedule.completionMinute)}</dd>
                </div>
                <div>
                  <dt>Unresolved hard constraints</dt>
                  <dd>{repair.verification?.violations.length ?? 0}</dd>
                </div>
              </dl>
              {repair.verification?.violations.length ? (
                <ul className="violation-list">
                  {repair.verification.violations.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              ) : (
                <p className="ok-note">
                  <CheckIcon size={15} /> All hard constraints are satisfied by the repaired schedule.
                </p>
              )}
            </div>
          </div>

          <div className="repair-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => onPreview(repairedSchedule.planId)}
              disabled={busy || disabled || hasPreview}
            >
              {hasPreview ? "Commit preview generated" : "Review exact local changes"}
              <ArrowIcon size={16} />
            </button>
            <span className="muted-note">
              Preview is read-only. A separate explicit approval is required to write demo data.
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="search-summary">
            <h3 className="subheading">Search evidence</h3>
            <p>
              {result.search.attempts.length === 0
                ? "No candidates were evaluated."
                : result.search.attempts
                    .slice(0, 8)
                    .map((attempt) => (
                      <span key={attempt.planId} className="attempt-line">
                        <strong>{attempt.mealId}</strong> / {attempt.profile}:{" "}
                        {attempt.feasible ? "feasible" : attempt.blockingViolation ?? "infeasible"}
                      </span>
                    ))}
            </p>
          </div>
          <div className="repair-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => onPreview(analysis.plan.id)}
              disabled={busy || disabled}
            >
              Preview baseline plan instead
            </button>
            <span className="muted-note">
              No repaired plan is available to approve. The original baseline remains available
              only if the scheduler still verifies it.
            </span>
          </div>
        </>
      )}
    </section>
  );
}
