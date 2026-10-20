import { useEffect, useRef, useState } from "react";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ForkcastMcpClient, McpToolError, DEFAULT_MCP_URL } from "./mcp/client";
import { formatTime, shortId } from "./format";
import type {
  ActivityEvent,
  BaselinePayload,
  CommitPayload,
  InspectWorldResult,
  PreviewCommitPayload,
  RepairPayload,
  ScenarioAnalysisPayload,
  ScenarioListPayload,
  ScenarioSpec
} from "./types";
import { RequestPanel } from "./components/RequestPanel";
import { Timeline } from "./components/Timeline";
import { DependencyGraph } from "./components/DependencyGraph";
import { ScenarioDeck } from "./components/ScenarioDeck";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { RepairWorkspace } from "./components/RepairWorkspace";
import { ExecutionReview } from "./components/ExecutionReview";
import { AuditLog } from "./components/AuditLog";
import { ToolInspector } from "./components/ToolInspector";
import {
  AlertIcon,
  ArrowIcon,
  BranchIcon,
  CheckIcon,
  ClockIcon,
  DatabaseIcon,
  ForkMark,
  RefreshIcon,
  ShieldIcon,
  ToolIcon
} from "./components/Icons";
import { StatusBadge } from "./components/StatusBadge";

const SAMPLE_REQUEST =
  "Prepare my home for six guests at 6 PM. Check inventory, build a schedule and test potential disruptions.";

type ConnectionState = "connecting" | "ready" | "error";
type BusyOperation =
  | "drafting"
  | "compare"
  | "simulate"
  | "repair"
  | "preview"
  | "commit"
  | "reset"
  | "refresh"
  | null;

function mergeEvents(previous: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] {
  const byId = new Map(previous.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => b.atIso.localeCompare(a.atIso));
}

function describeError(error: unknown): string {
  if (error instanceof McpToolError) return error.code + ": " + error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function App() {
  const clientRef = useRef<ForkcastMcpClient | null>(null);
  if (!clientRef.current) clientRef.current = new ForkcastMcpClient();

  const busyRef = useRef(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [tools, setTools] = useState<Tool[]>([]);
  const [protocolVersion, setProtocolVersion] = useState<string | null>(null);
  const [serverName, setServerName] = useState("forkcast");
  const [world, setWorld] = useState<InspectWorldResult | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioSpec[]>([]);
  const [request, setRequest] = useState(SAMPLE_REQUEST);
  const [baseline, setBaseline] = useState<BaselinePayload | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, ScenarioAnalysisPayload>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [repairs, setRepairs] = useState<Record<string, RepairPayload>>({});
  const [preview, setPreview] = useState<PreviewCommitPayload | null>(null);
  const [committed, setCommitted] = useState<CommitPayload | null>(null);
  const [audit, setAudit] = useState<ActivityEvent[]>([]);
  const [busy, setBusy] = useState<BusyOperation>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshInspect(silent = false): Promise<void> {
    const client = clientRef.current;
    if (!client) return;
    try {
      const inspected = await client.callTool<InspectWorldResult>("forkcast.inspect_world", {});
      setWorld(inspected);
      setAudit(inspected.activity);
      if (!inspected.server) setError("The MCP server returned no server metadata.");
    } catch (refreshError) {
      if (!silent) setError(describeError(refreshError));
    }
  }

  async function connectToServer(): Promise<void> {
    const client = clientRef.current;
    if (!client) return;
    setConnection("connecting");
    setError(null);
    try {
      const info = await client.connect();
      setTools(info.tools);
      setProtocolVersion(info.protocolVersion);
      setServerName(info.serverName);
      const inspected = await client.callTool<InspectWorldResult>("forkcast.inspect_world", {});
      setWorld(inspected);
      setAudit(inspected.activity);
      const scenarioList = await client.callTool<ScenarioListPayload>("forkcast.list_scenarios", {});
      setScenarios(scenarioList.scenarios);
      setConnection("ready");
    } catch (connectionError) {
      setConnection("error");
      setError(
        "Could not initialize the MCP session at " +
          client.endpoint +
          ". " +
          describeError(connectionError)
      );
    }
  }

  useEffect(() => {
    void connectToServer();
    return () => {
      void clientRef.current?.close();
    };
    // The client instance is intentionally stable for the application lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function withBusy<T>(
    operation: Exclude<BusyOperation, null>,
    work: () => Promise<T>
  ): Promise<T | null> {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(operation);
    setError(null);
    try {
      return await work();
    } catch (operationError) {
      setError(describeError(operationError));
      return null;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  const isApplied = Boolean(committed || world?.appliedExecution);
  const worldState = world?.world ?? baseline?.world ?? null;
  const analysisList = Object.values(analyses);
  const selectedAnalysis =
    analysisList.find((analysis) => analysis.analysisId === selectedId) ?? null;
  const selectedRepair = selectedAnalysis ? repairs[selectedAnalysis.analysisId] ?? null : null;

  async function draftPlan(text: string): Promise<void> {
    if (!clientRef.current || isApplied) return;
    const payload = await withBusy("drafting", () =>
      clientRef.current!.callTool<BaselinePayload>("forkcast.draft_plan", {
        request: text
      })
    );
    if (!payload) return;
    setBaseline(payload);
    setAnalyses({});
    setRepairs({});
    setSelectedId(null);
    setPreview(null);
    setCommitted(null);
    setRequest(payload.plan.request);
    setAudit((previous) => mergeEvents(previous, [payload.activityEvent]));
  }

  async function runScenario(scenarioId: string): Promise<void> {
    if (!clientRef.current || !baseline) return;
    const payload = await withBusy("simulate", () =>
      clientRef.current!.callTool<ScenarioAnalysisPayload>("forkcast.simulate_scenario", {
        scenarioId,
        planId: baseline.plan.id
      })
    );
    if (!payload) return;
    setAnalyses((previous) => ({ ...previous, [scenarioId]: payload }));
    setSelectedId(payload.analysisId);
    setPreview(null);
    setAudit((previous) => mergeEvents(previous, [payload.activityEvent]));
  }

  async function runAllScenarios(): Promise<void> {
    if (!clientRef.current || !baseline) return;
    const payload = await withBusy("compare", () =>
      clientRef.current!.callTool<{
        analyses: ScenarioAnalysisPayload[];
        summary: { total: number; feasible: number; failed: number; passesWithDegradation: number };
      }>("forkcast.compare_scenarios", {
        planId: baseline.plan.id
      })
    );
    if (!payload) return;
    const next: Record<string, ScenarioAnalysisPayload> = {};
    for (const analysis of payload.analyses) next[analysis.scenario.id] = analysis;
    setAnalyses(next);
    const chosen =
      payload.analyses.find((analysis) => analysis.comparison.verdict === "failed") ??
      payload.analyses.find(
        (analysis) => analysis.comparison.verdict === "passed-with-degradation"
      ) ??
      payload.analyses[0];
    setSelectedId(chosen?.analysisId ?? null);
    setPreview(null);
    await refreshInspect(true);
  }

  async function repairSelected(analysisId: string): Promise<void> {
    if (!clientRef.current) return;
    const payload = await withBusy("repair", () =>
      clientRef.current!.callTool<RepairPayload>("forkcast.repair_plan", { analysisId })
    );
    if (!payload) return;
    setRepairs((previous) => ({ ...previous, [analysisId]: payload }));
    setPreview(null);
    setAudit((previous) => mergeEvents(previous, payload.activityEvents));
  }

  async function requestCommitPreview(planId: string): Promise<void> {
    if (!clientRef.current) return;
    const payload = await withBusy("preview", () =>
      clientRef.current!.callTool<PreviewCommitPayload>("forkcast.preview_commit", { planId })
    );
    if (!payload) return;
    setPreview(payload);
    setCommitted(null);
    await refreshInspect(true);
  }

  async function approveAndCommit(): Promise<void> {
    if (!clientRef.current || !preview) return;
    const payload = await withBusy("commit", () =>
      clientRef.current!.callTool<CommitPayload>("forkcast.commit_approved_plan", {
        planId: preview.preview.planId,
        approvalToken: preview.approvalToken,
        approvalText: "APPROVE LOCAL DEMO COMMIT"
      })
    );
    if (!payload) return;
    setCommitted(payload);
    setPreview(null);
    setBaseline((previous) => (previous ? { ...previous, world: payload.world } : previous));
    setAudit((previous) => mergeEvents(previous, [payload.auditEvent]));
    await refreshInspect(true);
  }

  async function resetDemo(): Promise<void> {
    if (!clientRef.current) return;
    const payload = await withBusy("reset", () =>
      clientRef.current!.callTool<{ world: typeof worldState; worldRevision: number; auditEvent: ActivityEvent }>(
        "forkcast.reset_demo",
        { confirmation: "RESET DEMO DATA" }
      )
    );
    if (!payload) return;
    setBaseline(null);
    setAnalyses({});
    setRepairs({});
    setSelectedId(null);
    setPreview(null);
    setCommitted(null);
    setAudit((previous) => mergeEvents(previous, [payload.auditEvent]));
    await refreshInspect(true);
  }

  async function manualRefresh(): Promise<void> {
    await withBusy("refresh", async () => {
      await refreshInspect();
    });
  }

  const requestBusy = busy === "drafting";
  const globalDisabled = connection !== "ready" || isApplied;

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="FORKCAST home">
          <span className="brand-mark">
            <ForkMark size={31} />
          </span>
          <span className="brand-text">
            <strong>FORKCAST</strong>
            <span>The AI that stress-tests tomorrow.</span>
          </span>
        </a>

        <nav className="topnav" aria-label="Sections">
          <a href="#baseline">Baseline</a>
          <a href="#branches">Branches</a>
          <a href="#repair-workspace">Repair</a>
          <a href="#execution-review">Approval</a>
          <a href="#audit">Audit</a>
        </nav>

        <div className="connection-cluster">
          <ToolInspector
            tools={tools}
            endpoint={clientRef.current.endpoint}
            protocolVersion={protocolVersion}
            serverName={serverName}
            connected={connection === "ready"}
          />
          <span className="connection-state" aria-live="polite">
            <span
              className={
                "live-dot" +
                (connection === "ready"
                  ? " is-live"
                  : connection === "connecting"
                    ? " is-connecting"
                    : " is-down")
              }
              aria-hidden="true"
            />
            {connection === "ready"
              ? "MCP live"
              : connection === "connecting"
                ? "Connecting"
                : "MCP offline"}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => void manualRefresh()}
            disabled={busy !== null || connection !== "ready"}
            aria-label="Refresh world and audit history"
            title="Refresh world and audit history"
          >
            <RefreshIcon size={16} />
          </button>
        </div>
      </header>

      <main id="top">
        {error ? (
          <div className="error-banner" role="alert">
            <AlertIcon size={18} />
            <div>
              <strong>Operation failed</strong>
              <p>{error}</p>
            </div>
            <button type="button" className="icon-button" onClick={() => setError(null)} aria-label="Dismiss error">
              ×
            </button>
          </div>
        ) : null}

        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span>Counterfactual scheduling lab</span>
              <span className="hero-kicker__line" />
              <span>Seed 001</span>
            </div>
            <h1>
              Don’t just make a plan.
              <br />
              <em>Break it before reality does.</em>
            </h1>
            <p className="hero-lede">
              A deterministic household world. A calculated schedule. Four isolated failures.
              A repair that is accepted only after the scheduler proves it.
            </p>
            <div className="hero-principles">
              <span><CheckIcon size={14} /> Plain arithmetic, not storytelling</span>
              <span><BranchIcon size={14} /> One fault per world clone</span>
              <span><ShieldIcon size={14} /> Approval before any local write</span>
            </div>
          </div>
          <RequestPanel
            value={request}
            onChange={setRequest}
            onSubmit={() => void draftPlan(request)}
            onSample={() => {
              setRequest(SAMPLE_REQUEST);
              void draftPlan(SAMPLE_REQUEST);
            }}
            busy={requestBusy}
            disabled={connection !== "ready" || globalDisabled}
            hasBaseline={Boolean(baseline)}
            committed={isApplied}
          />
        </section>

        {connection === "error" ? (
          <section className="connection-failure" role="alert">
            <div>
              <div className="section-kicker">MCP connection failed</div>
              <h2>The workstation needs the local MCP server.</h2>
              <p>
                Start <code>npm run dev:server</code> and verify{" "}
                <code>{DEFAULT_MCP_URL}</code>. The browser is not falling back to REST or
                fabricated data.
              </p>
            </div>
            <button type="button" className="button button--primary" onClick={() => void connectToServer()}>
              Retry MCP connection
            </button>
          </section>
        ) : null}

        <section className="mission-strip" aria-label="Demo facts">
          <div>
            <span className="data-label">Household</span>
            <strong>{worldState?.householdName ?? "Connecting to demo world"}</strong>
            <span>{worldState?.demoDateLabel ?? "Fixed seed, no live calendar"}</span>
          </div>
          <div>
            <span className="data-label">Guests</span>
            <strong>{worldState?.guestCount ?? "—"}</strong>
            <span>arrival deadline {worldState ? formatTime(worldState.arrivalDeadlineMinute) : "—"}</span>
          </div>
          <div>
            <span className="data-label">World revision</span>
            <strong>{world?.worldRevision ?? "—"}</strong>
            <span>{isApplied ? "local demo applied" : "unmodified demonstration data"}</span>
          </div>
          <div>
            <span className="data-label">Branch matrix</span>
            <strong>{scenarios.length || "—"}</strong>
            <span>isolated, repeatable fault scenarios</span>
          </div>
          <div>
            <span className="data-label">Planning mode</span>
            <strong>Deterministic</strong>
            <span>LLM used: no</span>
          </div>
        </section>

        <section className="baseline-grid" id="baseline">
          {baseline && worldState ? (
            <>
              <Timeline schedule={baseline.schedule} world={worldState} />
              <aside className="constraint-panel">
                <div className="section-kicker">Constraint ledger</div>
                <h2>What the plan promises</h2>
                <dl className="ledger">
                  <div>
                    <dt>Projected finish</dt>
                    <dd>{formatTime(baseline.schedule.completionMinute)}</dd>
                  </div>
                  <div>
                    <dt>Guest deadline</dt>
                    <dd>{formatTime(baseline.schedule.deadlineMinute)}</dd>
                  </div>
                  <div>
                    <dt>Remaining slack</dt>
                    <dd>{baseline.schedule.slackMinutes ?? "—"} min</dd>
                  </div>
                  <div>
                    <dt>Meal</dt>
                    <dd>{baseline.plan.mealName}</dd>
                  </div>
                  <div>
                    <dt>Scheduled tasks</dt>
                    <dd>
                      {baseline.schedule.tasks.filter((task) => task.status === "scheduled").length}{" "}
                      / {baseline.schedule.tasks.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Hard violations</dt>
                    <dd>
                      {baseline.schedule.violations.filter((entry) => entry.severity === "error").length}
                    </dd>
                  </div>
                </dl>
                <div className="delivery-card">
                  <span className="data-label">Critical delivery</span>
                  {worldState.deliveries.map((delivery) => (
                    <div key={delivery.id}>
                      <strong>{delivery.name}</strong>
                      <span>{formatTime(delivery.availableAtMinute)}</span>
                    </div>
                  ))}
                </div>
                <details className="evidence-details">
                  <summary>Calculation evidence</summary>
                  <p><strong>Algorithm:</strong> {baseline.schedule.evidence.algorithm}</p>
                  <p><strong>Ordering:</strong> {baseline.schedule.evidence.taskOrderRule}</p>
                  <p><strong>Resources:</strong> {baseline.schedule.evidence.resourceRule}</p>
                  <p><strong>Resource waits:</strong> {baseline.schedule.evidence.resourceWaitCount}</p>
                  <p><strong>Candidate evaluations:</strong> {baseline.schedule.evidence.candidateEvaluations}</p>
                </details>
                <div className="ledger-foot">
                  <ClockIcon size={14} />
                  Every time on this page is a scheduler calculation, not a prediction from prose.
                </div>
              </aside>
            </>
          ) : (
            <div className="baseline-empty">
              <div>
                <div className="section-kicker">Baseline uncalculated</div>
                <h2>Build the future first.</h2>
                <p>
                  Submit the sample request. FORKCAST will create the task graph, allocate
                  resources, respect ingredient availability and calculate the finish time.
                </p>
              </div>
              <div className="baseline-empty__diagram" aria-hidden="true">
                <span>INVENTORY</span>
                <ArrowIcon size={18} />
                <span>DEPENDENCIES</span>
                <ArrowIcon size={18} />
                <span>SCHEDULE</span>
                <ArrowIcon size={18} />
                <span>EVIDENCE</span>
              </div>
            </div>
          )}
        </section>

        {baseline && worldState ? (
          <>
            <DependencyGraph plan={baseline.plan} schedule={baseline.schedule} />
            <div id="branches">
              <ScenarioDeck
                scenarios={scenarios}
                analyses={analyses}
                selectedId={selectedId}
                busy={busy !== null}
                disabled={isApplied}
                hasBaseline={Boolean(baseline)}
                onSimulate={(id) => void runScenario(id)}
                onRunAll={() => void runAllScenarios()}
              />
            </div>
            <ComparisonPanel
              analysis={selectedAnalysis}
              repair={selectedRepair}
              busy={busy === "repair"}
              disabled={isApplied}
              onRepair={(analysisId) => void repairSelected(analysisId)}
            />
          </>
        ) : (
          <section className="unavailable-panel">
            <DatabaseIcon size={28} />
            <div>
              <div className="section-kicker">Branching is locked</div>
              <h2>No calculated baseline yet</h2>
              <p>
                Scenario controls become active only after the MCP draft tool returns a real task
                schedule. No placeholder outcomes are shown.
              </p>
            </div>
          </section>
        )}

        <RepairWorkspace
          analysis={selectedAnalysis}
          repair={selectedRepair}
          busy={busy === "preview"}
          disabled={isApplied}
          hasPreview={Boolean(preview)}
          onPreview={(planId) => void requestCommitPreview(planId)}
        />

        <ExecutionReview
          preview={preview}
          committed={committed}
          appliedExecution={world?.appliedExecution ?? null}
          world={worldState}
          busy={busy === "commit" || busy === "reset"}
          disabled={connection !== "ready"}
          onApprove={() => void approveAndCommit()}
          onCancel={() => setPreview(null)}
          onReset={() => void resetDemo()}
        />

        <AuditLog events={audit} />

        <footer className="footer">
          <div>
            <ForkMark size={22} />
            <span>FORKCAST / deterministic counterfactual household planner</span>
          </div>
          <div>
            <span>MCP 2025-11-25</span>
            <span>Streamable HTTP</span>
            <span>local demonstration data only</span>
          </div>
        </footer>
      </main>

      <div className="busy-toast" aria-live="polite" aria-hidden={busy === null}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>
              {busy === "drafting"
                ? "Calculating baseline schedule…"
                : busy === "simulate"
                  ? "Simulating isolated branch through MCP…"
                  : busy === "compare"
                    ? "Running the four-branch matrix…"
                    : busy === "repair"
                      ? "Searching and verifying repair candidates…"
                      : busy === "preview"
                        ? "Re-scheduling and building commit preview…"
                        : busy === "commit"
                          ? "Writing approved plan to demo data…"
                          : busy === "reset"
                            ? "Restoring deterministic seed…"
                            : "Refreshing world and audit history…"}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}