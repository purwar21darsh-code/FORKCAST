import { useState, useEffect, useCallback, useRef } from 'react';
import type { SimulationOutcome, FaultScenario, RepairedPlan, ActivityLogEntry, PlanTask } from './engine/types';
import type { MCPToolDefinition, MCPClient } from './mcp/server';
import { createMCPClient, resetServerState, getActivityLog } from './mcp/server';
import { runScenarioMatrix, formatReport } from './faultline';

// ============================================================
// TYPES FOR UI STATE
// ============================================================

type AppPhase = 'idle' | 'planning' | 'faults' | 'comparison' | 'repair' | 'approval' | 'committed';

interface ComparisonData {
  baseline: SimulationOutcome;
  scenarios: { scenario: FaultScenario; outcome: SimulationOutcome; repair?: RepairedPlan }[];
  summary: string;
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('idle');
  const [mcpConnected, setMcpConnected] = useState(false);
  const [mcpTools, setMcpTools] = useState<MCPToolDefinition[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [baselineOutcome, setBaselineOutcome] = useState<SimulationOutcome | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [repairData, setRepairData] = useState<RepairedPlan | null>(null);
  const [committed, setCommitted] = useState(false);
  const [worldInfo, setWorldInfo] = useState<any>(null);
  const [faultlineReport, setFaultlineReport] = useState<string | null>(null);
  const [showFaultline, setShowFaultline] = useState(false);
  const clientRef = useRef<MCPClient | null>(null);

  // Initialize MCP client
  useEffect(() => {
    const client = createMCPClient();
    clientRef.current = client;

    const init = async () => {
      try {
        setLoading('mcp-init');
        await client.initialize();
        const tools = await client.listTools();
        setMcpTools(tools);
        setMcpConnected(true);
        setLoading(null);
      } catch (err) {
        setError(`MCP initialization failed: ${err}`);
        setLoading(null);
      }
    };
    init();

    return () => client.disconnect();
  }, []);

  const callTool = useCallback(async (name: string, args?: Record<string, any>) => {
    if (!clientRef.current) throw new Error('MCP client not initialized');
    const result = await clientRef.current.callTool(name, args);
    setActivityLog(getActivityLog());
    if (!result.success) throw new Error(result.error);
    return result.data;
  }, []);

  // Actions
  const handleInspect = async () => {
    try {
      setLoading('inspect');
      const data = await callTool('forkcast.inspect_world');
      setWorldInfo(data);
      setLoading(null);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  const handleDraftPlan = async () => {
    try {
      setLoading('plan');
      setPhase('planning');
      const data = await callTool('forkcast.draft_plan');
      setBaselineOutcome(data.outcome);
      await handleInspect();
      setLoading(null);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  const handleCompareScenarios = async () => {
    try {
      setLoading('compare');
      setPhase('comparison');
      const data = await callTool('forkcast.compare_scenarios');
      setComparisonData(data);
      setLoading(null);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  const handleSelectScenario = async (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    setPhase('repair');
    try {
      setLoading('repair');
      const data = await callTool('forkcast.repair_plan', { scenarioId });
      setRepairData(data.repair);
      setLoading(null);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  const handleCommit = async (planId: string) => {
    try {
      setLoading('commit');
      setPhase('approval');
      const data = await callTool('forkcast.commit_approved_plan', { planId, approved: true });
      if (data.committed) {
        setCommitted(true);
        setPhase('committed');
      }
      setLoading(null);
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  const handleRunFaultline = () => {
    // Run FAULTLINE demo scenario matrix
    interface TaskState {
      tasks: { id: string; duration: number }[];
      totalDuration: number;
      deadline: number;
    }

    const report = runScenarioMatrix<TaskState, { totalDuration: number; feasible: boolean }>({
      initialState: {
        tasks: [
          { id: 'prep-marinate', duration: 20 },
          { id: 'cook-rice', duration: 25 },
          { id: 'prep-vegetables', duration: 15 },
          { id: 'cook-curry', duration: 45 },
          { id: 'warm-naan', duration: 10 },
          { id: 'prepare-raita', duration: 10 },
          { id: 'final-plating', duration: 15 },
        ],
        totalDuration: 140,
        deadline: 360,
      },
      cloneState: (s) => JSON.parse(JSON.stringify(s)),
      simulateInSandbox: (state) => {
        const total = state.tasks.reduce((sum, t) => sum + t.duration, 0);
        return { totalDuration: total, feasible: total <= state.deadline };
      },
      evaluateOutcome: (outcome, baseline) => {
        if (outcome.feasible === baseline.feasible) return 'pass';
        return 'fail';
      },
      scenarios: [
        {
          id: 'delivery-delay',
          name: 'Delivery Delay (+30min cream)',
          description: 'Ingredient delivery delayed',
          applyFault: (state) => {
            // In this simplified model, we add time to the total
            return { ...state, totalDuration: state.totalDuration + 30 };
          },
        },
        {
          id: 'task-overrun',
          name: 'Task Overrun (curry +50%)',
          description: 'Cooking takes longer than expected',
          applyFault: (state) => {
            const tasks = state.tasks.map(t =>
              t.id === 'cook-curry' ? { ...t, duration: Math.ceil(t.duration * 1.5) } : t
            );
            const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0);
            return { ...state, tasks, totalDuration };
          },
        },
        {
          id: 'double-overrun',
          name: 'Cascading Failure (overrun + delay)',
          description: 'Multiple faults compound',
          applyFault: (state) => {
            const tasks = state.tasks.map(t =>
              t.id === 'cook-curry' ? { ...t, duration: Math.ceil(t.duration * 1.5) } : t
            );
            const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0) + 30;
            return { ...state, tasks, totalDuration };
          },
        },
      ],
    });

    setFaultlineReport(formatReport(report));
    setShowFaultline(true);
  };

  const handleReset = async () => {
    resetServerState();
    setPhase('idle');
    setBaselineOutcome(null);
    setComparisonData(null);
    setSelectedScenario(null);
    setRepairData(null);
    setCommitted(false);
    setWorldInfo(null);
    setActivityLog([]);
    setError(null);
    setFaultlineReport(null);
    setShowFaultline(false);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#161b22] sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-black text-black shadow-lg shadow-amber-500/20">
              FC
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-amber-400 tracking-tight">FORKCAST</h1>
              <p className="text-[10px] sm:text-xs text-gray-500 -mt-0.5">Don't just make a plan. Break it before reality does.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MCPStatus connected={mcpConnected} tools={mcpTools} />
            <button
              onClick={handleRunFaultline}
              className="hidden sm:block px-3 py-1.5 text-xs bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded text-purple-300 transition-colors"
            >
              ◆ FAULTLINE Report
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
            >
              ↺ Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm flex items-center justify-between">
            <span><span className="font-bold">Error:</span> {error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-2">✕</button>
          </div>
        )}

        {loading && (
          <div className="mb-4 p-3 bg-cyan-900/20 border border-cyan-800/50 rounded-lg text-cyan-300 text-sm flex items-center gap-2">
            <span className="animate-pulse text-cyan-400">●</span> Processing: <span className="font-mono">{loading}</span>
          </div>
        )}

        {/* Request Composer */}
        <RequestComposer
          onDraftPlan={handleDraftPlan}
          disabled={loading !== null || !mcpConnected}
          phase={phase}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-6">
          {/* Left Column - Timeline & Graph */}
          <div className="xl:col-span-8 space-y-4">
            {baselineOutcome && worldInfo && (
              <>
                <TimelinePanel outcome={baselineOutcome} worldInfo={worldInfo} />
                <DependencyGraph tasks={worldInfo.tasks || []} />
              </>
            )}
            {comparisonData && (
              <ComparisonPanel
                data={comparisonData}
                baseline={baselineOutcome}
                onSelectScenario={handleSelectScenario}
                selectedScenario={selectedScenario}
              />
            )}
            {repairData && (
              <RepairPanel repair={repairData} scenarioId={selectedScenario} />
            )}
            {committed && <CommitConfirmation />}
          </div>

          {/* Right Column - Controls & Info */}
          <div className="xl:col-span-4 space-y-4">
            <ActionPanel
              phase={phase}
              onInspect={handleInspect}
              onDraftPlan={handleDraftPlan}
              onCompare={handleCompareScenarios}
              onCommit={handleCommit}
              loading={loading}
              baselineOutcome={baselineOutcome}
              comparisonData={comparisonData}
              selectedScenario={selectedScenario}
              repairData={repairData}
            />

            {worldInfo && <WorldInfoPanel worldInfo={worldInfo} />}

            <MCPToolsPanel tools={mcpTools} />

            <ActivityPanel logs={activityLog} />

            {/* FAULTLINE mini panel */}
            <button
              onClick={handleRunFaultline}
              className="sm:hidden w-full px-3 py-2 text-xs bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded text-purple-300 transition-colors"
            >
              ◆ Run FAULTLINE Test Report
            </button>
          </div>
        </div>

        {/* FAULTLINE Report Modal */}
        {showFaultline && faultlineReport && (
          <FaultlineModal report={faultlineReport} onClose={() => setShowFaultline(false)} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-4">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-600 gap-2">
          <span>FORKCAST v1.0 — Deterministic Counterfactual Planning Engine</span>
          <span>FAULTLINE v1.0 • MCP Protocol • Seed #{worldInfo?.seed || 42}</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function MCPStatus({ connected, tools }: { connected: boolean; tools: MCPToolDefinition[] }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-red-500'}`} />
      <span className="text-gray-400 hidden sm:inline">
        MCP {connected ? `• ${tools.length} tools` : 'Offline'}
      </span>
    </div>
  );
}

function RequestComposer({ onDraftPlan, disabled, phase }: { onDraftPlan: () => void; disabled: boolean; phase: AppPhase }) {
  const defaultRequest = "Prepare my home for six guests at 6 PM. Check inventory, build a schedule and test whether the plan survives unexpected problems.";
  const [text, setText] = useState(defaultRequest);

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-xl">
      <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block font-bold">Natural Language Request</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 resize-none h-16 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 transition-all"
        placeholder="Describe your scenario..."
      />
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <PhaseIndicator phase={phase} />
        </div>
        <button
          onClick={onDraftPlan}
          disabled={disabled}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-black font-bold text-sm rounded-lg transition-all shadow-lg shadow-amber-600/20 disabled:shadow-none"
        >
          ⚡ Generate & Stress-Test Plan
        </button>
      </div>
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: AppPhase }) {
  const phases = [
    { key: 'idle', label: 'READY', color: 'text-gray-500' },
    { key: 'planning', label: 'PLANNING', color: 'text-amber-400' },
    { key: 'comparison', label: 'TESTING', color: 'text-cyan-400' },
    { key: 'repair', label: 'REPAIRING', color: 'text-purple-400' },
    { key: 'approval', label: 'APPROVING', color: 'text-yellow-400' },
    { key: 'committed', label: 'COMMITTED', color: 'text-green-400' },
  ];

  const current = phases.find(p => p.key === phase) || phases[0];

  return (
    <span className={`text-[10px] font-bold tracking-wider ${current.color}`}>
      ● {current.label}
    </span>
  );
}

function TimelinePanel({ outcome, worldInfo }: { outcome: SimulationOutcome; worldInfo: any }) {
  const maxTime = Math.max(outcome.completionTime, 360);
  const timeScale = 100 / maxTime;

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Baseline Schedule
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            outcome.feasible ? 'bg-green-900/50 text-green-400 border border-green-800/50' : 'bg-red-900/50 text-red-400 border border-red-800/50'
          }`}>
            {outcome.feasible ? '✓ FEASIBLE' : '✗ INFEASIBLE'}
          </span>
          <span className="text-gray-400 font-mono text-[11px]">
            T+{outcome.completionTime}min
          </span>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {/* Time axis */}
        <div className="flex items-center justify-between text-[9px] text-gray-600 mb-1 px-36">
          <span>T+0</span>
          <span>T+{Math.round(maxTime / 4)}min</span>
          <span>T+{Math.round(maxTime / 2)}min</span>
          <span>T+{Math.round(maxTime * 3 / 4)}min</span>
          <span>T+{maxTime}min</span>
        </div>

        {/* Deadline marker */}
        <div
          className="absolute top-6 bottom-2 w-0.5 bg-red-500/60 z-10"
          style={{ left: `calc(144px + ${360 * timeScale}% * 0.72)` }}
        >
          <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-red-400 font-bold whitespace-nowrap">
            DEADLINE 18:00
          </span>
        </div>

        {/* Task bars */}
        <div className="space-y-1.5 mt-6">
          {outcome.taskResults.map((task) => {
            const taskInfo = worldInfo.tasks?.find((t: any) => t.id === task.taskId);
            const left = task.startTime * timeScale;
            const width = Math.max((task.finishTime - task.startTime) * timeScale, 2);
            const isCritical = taskInfo?.criticalPath;

            return (
              <div key={task.taskId} className="flex items-center gap-2">
                <div className="w-36 text-[11px] text-gray-400 truncate text-right pr-2" title={taskInfo?.name || task.taskId}>
                  {taskInfo?.name || task.taskId}
                </div>
                <div className="flex-1 relative h-7 bg-gray-800/30 rounded overflow-hidden">
                  <div
                    className={`absolute top-0.5 h-6 rounded shadow-sm ${
                      isCritical
                        ? 'bg-gradient-to-r from-amber-600 to-amber-500 shadow-amber-500/20'
                        : 'bg-gradient-to-r from-cyan-700 to-cyan-600 shadow-cyan-500/10'
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white/90 font-medium truncate">
                      {task.startTime}→{task.finishTime}min
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-4 text-[10px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2.5 bg-gradient-to-r from-amber-600 to-amber-500 rounded-sm" /> Critical path
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2.5 bg-gradient-to-r from-cyan-700 to-cyan-600 rounded-sm" /> Parallel task
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3 bg-red-500" /> Deadline (18:00)
          </span>
        </div>
      </div>

      {/* Violations */}
      {outcome.violations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-800">
          <h3 className="text-[10px] text-red-400 font-bold mb-2 uppercase tracking-wider">Constraint Violations ({outcome.violations.length})</h3>
          {outcome.violations.map((v, i) => (
            <div key={i} className={`text-[11px] p-2 rounded-lg mb-1.5 ${
              v.severity === 'fatal' ? 'bg-red-900/20 border border-red-900/30 text-red-300' :
              v.severity === 'critical' ? 'bg-orange-900/20 border border-orange-900/30 text-orange-300' :
              'bg-yellow-900/20 border border-yellow-900/30 text-yellow-300'
            }`}>
              <span className="font-bold">[{v.type}]</span> {v.description}
            </div>
          ))}
        </div>
      )}

      {/* Explanation */}
      <div className="mt-3 pt-3 border-t border-gray-800/50">
        <p className="text-[11px] text-gray-400 italic">{outcome.explanation}</p>
      </div>
    </div>
  );
}

function DependencyGraph({ tasks }: { tasks: any[] }) {
  if (!tasks || tasks.length === 0) return null;

  // Simple SVG dependency graph
  const nodeWidth = 120;
  const nodeHeight = 32;
  const padding = 20;
  const levels = computeLevels(tasks);
  const maxLevel = Math.max(...Object.values(levels));
  const svgWidth = (maxLevel + 1) * (nodeWidth + 40) + padding * 2;
  const nodesPerLevel: Record<number, string[]> = {};
  for (const [id, level] of Object.entries(levels)) {
    if (!nodesPerLevel[level]) nodesPerLevel[level] = [];
    nodesPerLevel[level].push(id);
  }
  const maxPerLevel = Math.max(...Object.values(nodesPerLevel).map(n => n.length));
  const svgHeight = maxPerLevel * (nodeHeight + 16) + padding * 2;

  const nodePositions: Record<string, { x: number; y: number }> = {};
  for (const [level, ids] of Object.entries(nodesPerLevel)) {
    const l = parseInt(level);
    ids.forEach((id, i) => {
      nodePositions[id] = {
        x: padding + l * (nodeWidth + 40),
        y: padding + i * (nodeHeight + 16) + (maxPerLevel - ids.length) * (nodeHeight + 16) / 2,
      };
    });
  }

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-xl">
      <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        Dependency Graph
      </h2>
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="min-w-full">
          {/* Edges */}
          {tasks.map((task: any) => {
            const to = nodePositions[task.id];
            if (!to) return null;
            return (task.dependencies || []).map((dep: any) => {
              const from = nodePositions[dep.taskId];
              if (!from) return null;
              return (
                <line
                  key={`${dep.taskId}-${task.id}`}
                  x1={from.x + nodeWidth}
                  y1={from.y + nodeHeight / 2}
                  x2={to.x}
                  y2={to.y + nodeHeight / 2}
                  stroke="#30363d"
                  strokeWidth="1.5"
                  markerEnd="url(#arrowhead)"
                />
              );
            });
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="#484f58" />
            </marker>
          </defs>

          {/* Nodes */}
          {tasks.map((task: any) => {
            const pos = nodePositions[task.id];
            if (!pos) return null;
            return (
              <g key={task.id}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx="4"
                  fill={task.criticalPath ? '#92400e' : '#164e63'}
                  stroke={task.criticalPath ? '#d97706' : '#0891b2'}
                  strokeWidth="1"
                  opacity="0.8"
                />
                <text
                  x={pos.x + nodeWidth / 2}
                  y={pos.y + nodeHeight / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {(task.name || task.id).slice(0, 16)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function computeLevels(tasks: any[]): Record<string, number> {
  const levels: Record<string, number> = {};
  const taskMap = new Map(tasks.map((t: any) => [t.id, t]));

  function getLevel(id: string, visited: Set<string> = new Set()): number {
    if (levels[id] !== undefined) return levels[id];
    if (visited.has(id)) return 0; // cycle protection
    visited.add(id);

    const task = taskMap.get(id);
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      levels[id] = 0;
      return 0;
    }

    const maxDepLevel = Math.max(...task.dependencies.map((d: any) => getLevel(d.taskId, visited)));
    levels[id] = maxDepLevel + 1;
    return levels[id];
  }

  for (const task of tasks) {
    getLevel(task.id);
  }

  return levels;
}

function ComparisonPanel({ data, baseline, onSelectScenario, selectedScenario }: {
  data: ComparisonData;
  baseline: SimulationOutcome | null;
  onSelectScenario: (id: string) => void;
  selectedScenario: string | null;
}) {
  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-xl">
      <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        Fault Scenario Comparison
      </h2>
      <p className="text-xs text-gray-500 mb-4">{data.summary}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.scenarios.map(({ scenario, outcome, repair }) => (
          <button
            key={scenario.id}
            onClick={() => onSelectScenario(scenario.id)}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedScenario === scenario.id
                ? 'border-cyan-500 bg-cyan-900/20 shadow-lg shadow-cyan-500/10'
                : 'border-gray-700 bg-gray-800/20 hover:border-gray-600 hover:bg-gray-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-200">{scenario.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                outcome.feasible
                  ? 'bg-green-900/50 text-green-400 border border-green-800/30'
                  : 'bg-red-900/50 text-red-400 border border-red-800/30'
              }`}>
                {outcome.feasible ? 'SURVIVED' : 'FAILED'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mb-2">{scenario.description}</p>

            {/* Visual comparison bar */}
            <div className="mb-2">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-gray-500 w-16">Baseline:</span>
                <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500/60 rounded"
                    style={{ width: `${Math.min((baseline?.completionTime || 0) / 400 * 100, 100)}%` }}
                  />
                </div>
                <span className="text-gray-400 w-12 text-right">T+{baseline?.completionTime || 0}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] mt-1">
                <span className="text-gray-500 w-16">Faulted:</span>
                <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${outcome.feasible ? 'bg-cyan-500/60' : 'bg-red-500/60'}`}
                    style={{ width: `${Math.min(outcome.completionTime / 400 * 100, 100)}%` }}
                  />
                </div>
                <span className="text-gray-400 w-12 text-right">T+{outcome.completionTime}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              {outcome.violations.length > 0 && (
                <span className="text-red-400">{outcome.violations.length} violation(s)</span>
              )}
              {repair && (
                <span className={`ml-auto font-bold ${repair.feasible ? 'text-green-400' : 'text-red-400'}`}>
                  {repair.feasible ? '⚡ Repairable' : '⚠ No repair'}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RepairPanel({ repair, scenarioId }: { repair: RepairedPlan | null; scenarioId: string | null }) {
  if (!repair) {
    return (
      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-xl">
        <h2 className="text-sm font-black text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          Repair Workspace
        </h2>
        <p className="text-xs text-gray-500">Select a failed scenario above to analyze repair options.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#161b22] border border-purple-800/30 rounded-xl p-5 shadow-xl shadow-purple-500/5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black text-purple-400 uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          Repair Analysis
        </h2>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
          repair.feasible ? 'bg-green-900/50 text-green-400 border border-green-800/50' : 'bg-red-900/50 text-red-400 border border-red-800/50'
        }`}>
          {repair.feasible ? '✓ FEASIBLE REPAIR' : '✗ NO FEASIBLE REPAIR'}
        </span>
      </div>

      <p className="text-xs text-gray-300 mb-4 leading-relaxed">{repair.explanation}</p>

      {/* Changes */}
      <div className="mb-4">
        <h3 className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-wider">Changes Applied</h3>
        {repair.changes.map((c, i) => (
          <div key={i} className="text-[11px] p-3 bg-gray-800/30 rounded-lg mb-2 border border-gray-700/30">
            <span className="text-cyan-400 font-bold">[{c.type}]</span>{' '}
            <span className="text-gray-200">{c.description}</span>
            <p className="text-gray-500 mt-1 text-[10px]">{c.details}</p>
          </div>
        ))}
      </div>

      {/* Trade-offs */}
      {repair.tradeOffs.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[10px] text-yellow-500 font-bold mb-2 uppercase tracking-wider">Trade-offs</h3>
          {repair.tradeOffs.map((t, i) => (
            <div key={i} className="text-[11px] text-yellow-300/80 flex items-center gap-2 mb-1">
              <span className="text-yellow-500">⚠</span> {t}
            </div>
          ))}
        </div>
      )}

      {/* Metrics */}
      <div className="pt-3 border-t border-gray-800 flex items-center gap-6 text-[11px]">
        <div>
          <span className="text-gray-500">Completion: </span>
          <span className="text-gray-300 font-mono">T+{repair.completionTime}min</span>
        </div>
        <div>
          <span className="text-gray-500">Buffer: </span>
          <span className={`font-mono ${repair.lateness <= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {repair.lateness <= 0 ? `${Math.abs(repair.lateness)}min early` : `${repair.lateness}min late`}
          </span>
        </div>
      </div>
    </div>
  );
}

function CommitConfirmation() {
  return (
    <div className="bg-green-900/10 border border-green-800/50 rounded-xl p-5 shadow-xl shadow-green-500/5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center">
          <span className="text-green-400 text-lg">✓</span>
        </div>
        <div>
          <h2 className="text-sm font-black text-green-400 uppercase tracking-wider">Plan Committed Successfully</h2>
          <p className="text-[10px] text-green-500/70">World state updated — version incremented</p>
        </div>
      </div>
      <p className="text-xs text-green-300/70 leading-relaxed">
        The approved plan has been committed to the demo world state. Local simulation data has been updated.
        <strong> No real-world actions were taken</strong> — this is a deterministic simulation only.
      </p>
    </div>
  );
}

function ActionPanel({ phase, onInspect, onDraftPlan, onCompare, onCommit, loading, baselineOutcome, comparisonData, selectedScenario, repairData }: {
  phase: AppPhase;
  onInspect: () => void;
  onDraftPlan: () => void;
  onCompare: () => void;
  onCommit: (planId: string) => void;
  loading: string | null;
  baselineOutcome: SimulationOutcome | null;
  comparisonData: ComparisonData | null;
  selectedScenario: string | null;
  repairData: RepairedPlan | null;
}) {
  const isLoading = loading !== null;

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 shadow-xl">
      <h2 className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold">Execution Controls</h2>
      <div className="space-y-2">
        <button
          onClick={onInspect}
          disabled={isLoading}
          className="w-full px-3 py-2.5 text-xs bg-gray-800/50 hover:bg-gray-800 disabled:opacity-50 border border-gray-700/50 rounded-lg text-gray-300 transition-all text-left flex items-center gap-2"
        >
          <span className="text-gray-500">🔍</span> Inspect World State
        </button>
        <button
          onClick={onDraftPlan}
          disabled={isLoading}
          className="w-full px-3 py-2.5 text-xs bg-amber-900/20 hover:bg-amber-900/40 disabled:opacity-50 border border-amber-800/30 rounded-lg text-amber-300 transition-all text-left flex items-center gap-2"
        >
          <span>📋</span> Draft Baseline Plan
        </button>
        <button
          onClick={onCompare}
          disabled={isLoading || !baselineOutcome}
          className="w-full px-3 py-2.5 text-xs bg-cyan-900/20 hover:bg-cyan-900/40 disabled:opacity-50 border border-cyan-800/30 rounded-lg text-cyan-300 transition-all text-left flex items-center gap-2"
        >
          <span>⚡</span> Run All Fault Scenarios
        </button>
        {repairData?.feasible && (
          <button
            onClick={() => onCommit(selectedScenario || 'baseline')}
            disabled={isLoading}
            className="w-full px-3 py-2.5 text-xs bg-green-900/20 hover:bg-green-900/40 disabled:opacity-50 border border-green-800/30 rounded-lg text-green-300 transition-all text-left flex items-center gap-2"
          >
            <span>✓</span> Approve & Commit Repaired Plan
          </button>
        )}
        {baselineOutcome?.feasible && !comparisonData && (
          <button
            onClick={() => onCommit('baseline')}
            disabled={isLoading}
            className="w-full px-3 py-2.5 text-xs bg-green-900/20 hover:bg-green-900/40 disabled:opacity-50 border border-green-800/30 rounded-lg text-green-300 transition-all text-left flex items-center gap-2"
          >
            <span>✓</span> Approve & Commit Baseline Plan
          </button>
        )}
      </div>

      {/* Workflow indicator */}
      <div className="mt-4 pt-3 border-t border-gray-800/50">
        <div className="text-[9px] text-gray-600 mb-1.5 font-bold tracking-widest">WORKFLOW PIPELINE</div>
        <div className="flex items-center gap-0.5 text-[8px] flex-wrap">
          {['WORLD', 'PLAN', 'FAULT', 'SIM', 'REPAIR', 'APPROVE', 'COMMIT'].map((step, i) => {
            const phaseMap: AppPhase[] = ['idle', 'planning', 'faults', 'comparison', 'repair', 'approval', 'committed'];
            const currentIdx = phaseMap.indexOf(phase);
            const isActive = i <= currentIdx;
            return (
              <span key={step} className={`px-1.5 py-0.5 rounded ${isActive ? 'bg-amber-600/30 text-amber-400 font-bold' : 'bg-gray-800/50 text-gray-600'}`}>
                {step}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorldInfoPanel({ worldInfo }: { worldInfo: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 shadow-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold"
      >
        <span>World State (v{worldInfo.version})</span>
        <span className="text-gray-600">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 text-[11px]">
          <div className="flex items-center gap-3">
            <span className="text-gray-500">Seed:</span>
            <span className="text-gray-300 font-mono">{worldInfo.seed}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500">Deadline:</span>
            <span className="text-gray-300 font-mono">T+{worldInfo.deadline}min (18:00)</span>
          </div>
          <div>
            <span className="text-gray-500">Selected Meal:</span>{' '}
            <span className="text-amber-400 font-bold">{worldInfo.mealOptions?.find((m: any) => m.id === worldInfo.selectedMeal)?.name || worldInfo.selectedMeal}</span>
          </div>
          <div className="pt-2 border-t border-gray-800/50">
            <div className="text-gray-500 mb-1.5 font-bold">Inventory ({(worldInfo.inventory || []).length} items):</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 max-h-40 overflow-y-auto">
              {(worldInfo.inventory || []).map((item: any) => (
                <div key={item.id} className="text-gray-400 truncate text-[10px]">
                  {item.name}: <span className="text-gray-300">{item.quantity}{item.unit}</span>
                  {item.availableAt > 0 && <span className="text-yellow-500 ml-1">⏱+{item.availableAt}m</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-gray-800/50">
            <div className="text-gray-500 mb-1.5 font-bold">Resources:</div>
            {(worldInfo.resources || []).map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${r.available ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-400">{r.name}</span>
                <span className={r.available ? 'text-green-600' : 'text-red-600'}>{r.available ? 'online' : 'offline'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MCPToolsPanel({ tools }: { tools: MCPToolDefinition[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 shadow-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold"
      >
        <span>MCP Tools ({tools.length})</span>
        <span className="text-gray-600">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {tools.map(tool => (
            <div key={tool.name} className="text-[10px] p-2 bg-gray-800/20 rounded-lg border border-gray-800/30">
              <div className="text-cyan-400 font-bold font-mono">{tool.name}</div>
              <div className="text-gray-500 mt-0.5">{tool.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityPanel({ logs }: { logs: ActivityLogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 shadow-xl">
      <h2 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Activity Log ({logs.length})</h2>
      <div ref={scrollRef} className="max-h-48 overflow-y-auto space-y-1">
        {logs.length === 0 ? (
          <p className="text-[11px] text-gray-600 italic">No activity yet. Start by drafting a plan.</p>
        ) : (
          logs.map(log => (
            <div key={log.id} className="text-[10px] flex items-start gap-1.5 py-0.5">
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                log.status === 'success' ? 'bg-green-500' :
                log.status === 'error' ? 'bg-red-500' :
                log.status === 'warning' ? 'bg-yellow-500' :
                'bg-gray-600'
              }`} />
              <div>
                <span className="text-gray-400 font-bold font-mono">{log.action}</span>
                <span className="text-gray-600 ml-1">{log.details}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FaultlineModal({ report, onClose }: { report: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-purple-800/50 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl shadow-purple-500/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-purple-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            FAULTLINE — Scenario Matrix Report
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
        </div>
        <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap bg-[#0d1117] p-4 rounded-lg border border-gray-800 overflow-x-auto">
          {report}
        </pre>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-gray-600">FAULTLINE v1.0 — Reusable Failure Simulation Library</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded-lg text-purple-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
