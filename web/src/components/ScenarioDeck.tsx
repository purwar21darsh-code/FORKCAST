import { formatDelta, formatTime, titleCase } from "../format";
import type { ScenarioAnalysisPayload, ScenarioSpec } from "../types";
import { BranchIcon } from "./Icons";
import { StatusBadge } from "./StatusBadge";

function tone(analysis: ScenarioAnalysisPayload | undefined): "success" | "danger" | "warning" | "neutral" {
  if (!analysis) return "neutral";
  if (analysis.comparison.verdict === "failed") return "danger";
  if (analysis.comparison.verdict === "passed-with-degradation") return "warning";
  return "success";
}

function resultLabel(analysis: ScenarioAnalysisPayload | undefined): string {
  if (!analysis) return "Not simulated";
  if (analysis.comparison.verdict === "failed") return "Broken";
  if (analysis.comparison.verdict === "passed-with-degradation") return "Degraded";
  return "Survives";
}

export function ScenarioDeck({
  scenarios,
  analyses,
  selectedId,
  busy,
  disabled,
  hasBaseline,
  onSimulate,
  onRunAll
}: {
  scenarios: ScenarioSpec[];
  analyses: Record<string, ScenarioAnalysisPayload>;
  selectedId: string | null;
  busy: boolean;
  disabled: boolean;
  hasBaseline: boolean;
  onSimulate: (scenarioId: string) => void;
  onRunAll: () => void;
}) {
  return (
    <section className="scenario-panel" aria-labelledby="scenario-heading">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Isolated future branches / FAULTLINE</div>
          <h2 id="scenario-heading">
            Break it before reality does
            <span className="heading-note">one fault per fresh world clone</span>
          </h2>
        </div>
        <button
          type="button"
          className="button button--small button--ghost"
          onClick={onRunAll}
          disabled={!hasBaseline || busy || disabled}
        >
          {busy ? "Running…" : "Run all four"}
        </button>
      </div>

      <div className="scenario-grid">
        {scenarios.map((scenario, index) => {
          const analysis = analyses[scenario.id];
          const cardTone = tone(analysis);
          const isSelected = analysis?.analysisId === selectedId;
          return (
            <article
              key={scenario.id}
              className={
                "scenario-card scenario-card--" +
                cardTone +
                (isSelected ? " is-selected" : "")
              }
            >
              <div className="scenario-card__top">
                <span className="scenario-index">{String(index + 1).padStart(2, "0")}</span>
                <StatusBadge tone={cardTone} icon={cardTone !== "neutral"}>
                  {resultLabel(analysis)}
                </StatusBadge>
              </div>
              <h3>{scenario.name}</h3>
              <p className="scenario-description">{scenario.description}</p>
              <dl className="scenario-params">
                {Object.entries(scenario.parameters)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{titleCase(key)}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
              </dl>
              <div className="scenario-result">
                {analysis ? (
                  <>
                    <div>
                      <span className="data-label">Faulted finish</span>
                      <strong>{formatTime(analysis.comparison.faultedCompletionMinute)}</strong>
                    </div>
                    <div>
                      <span className="data-label">Delta</span>
                      <strong>{formatDelta(analysis.comparison.completionDeltaMinutes)}</strong>
                    </div>
                    <div>
                      <span className="data-label">New hard breaks</span>
                      <strong>{analysis.comparison.newlyViolatedConstraints.length}</strong>
                    </div>
                  </>
                ) : (
                  <p className="scenario-waiting">
                    {hasBaseline
                      ? "The simulator has not calculated this branch yet."
                      : "Calculate a baseline plan first."}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="scenario-run"
                onClick={() => onSimulate(scenario.id)}
                disabled={!hasBaseline || busy || disabled}
                aria-label={`Simulate ${scenario.name} through MCP`}
              >
                <BranchIcon size={15} />
                {analysis ? "Re-run branch" : "Simulate branch"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
