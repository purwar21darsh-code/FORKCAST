import type { ActionPlan, PlanTask, ScheduleResult } from "../types";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 52;
const COL_GAP = 48;
const ROW_GAP = 18;
const X0 = 18;
const Y0 = 34;

function wrapName(name: string): string[] {
  if (name.length <= 22) return [name];
  const words = name.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > 22 && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
    if (lines.length === 2) break;
  }
  if (line.length > 0 && lines.length < 2) lines.push(line);
  if (lines.length === 0) return [name];
  if (lines.join(" ").length < name.length && lines.length === 2) {
    lines[1] = lines[1]!.slice(0, 21) + "…";
  }
  return lines;
}

export function DependencyGraph({
  plan,
  schedule
}: {
  plan: ActionPlan;
  schedule: ScheduleResult;
}) {
  const taskMap = new Map(plan.tasks.map((task) => [task.id, task]));
  const levelCache = new Map<string, number>();
  const visiting = new Set<string>();

  const levelOf = (id: string): number => {
    const cached = levelCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const task = taskMap.get(id);
    const deps = task?.dependsOn.filter((dep) => taskMap.has(dep)) ?? [];
    const level = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(levelOf));
    visiting.delete(id);
    levelCache.set(id, level);
    return level;
  };

  const levels = new Map<number, PlanTask[]>();
  for (const task of plan.tasks) {
    const level = levelOf(task.id);
    const list = levels.get(level) ?? [];
    list.push(task);
    levels.set(level, list);
  }
  for (const list of levels.values()) {
    list.sort((a, b) => plan.tasks.indexOf(a) - plan.tasks.indexOf(b));
  }

  const maxLevel = Math.max(0, ...levels.keys());
  const maxRows = Math.max(1, ...[...levels.values()].map((list) => list.length));
  const width = X0 * 2 + (maxLevel + 1) * NODE_WIDTH + maxLevel * COL_GAP;
  const height = Y0 + 24 + maxRows * (NODE_HEIGHT + ROW_GAP) + 20;
  const positions = new Map<string, { x: number; y: number; task: PlanTask }>();
  for (const [level, tasks] of levels) {
    tasks.forEach((task, row) => {
      positions.set(task.id, {
        x: X0 + level * (NODE_WIDTH + COL_GAP),
        y: Y0 + row * (NODE_HEIGHT + ROW_GAP),
        task
      });
    });
  }
  const scheduleMap = new Map(schedule.tasks.map((task) => [task.taskId, task]));

  return (
    <section className="graph-panel" aria-labelledby="graph-heading">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Actual prerequisite graph</div>
          <h2 id="graph-heading">
            Why the order holds
            <span className="heading-note">{plan.tasks.length} nodes · {plan.tasks.reduce((count, task) => count + task.dependsOn.length, 0)} dependency edges</span>
          </h2>
        </div>
        <div className="graph-legend" aria-label="Graph legend">
          <span><i className="graph-dot graph-dot--ok" /> Scheduled</span>
          <span><i className="graph-dot graph-dot--bad" /> Blocked</span>
          <span><i className="graph-arrow" /> depends on</span>
        </div>
      </div>
      <p className="scroll-hint">Drag horizontally to inspect the full graph.</p>
      <div className="graph-scroll">
        <svg
          className="graph-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Dependency graph generated from the actual plan task prerequisites."
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="graph-arrowhead" />
            </marker>
          </defs>
          {plan.tasks.flatMap((task) =>
            task.dependsOn.map((dependency) => {
              const from = positions.get(dependency);
              const to = positions.get(task.id);
              if (!from || !to) return null;
              const x1 = from.x + NODE_WIDTH;
              const y1 = from.y + NODE_HEIGHT / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_HEIGHT / 2;
              const mid = (x1 + x2) / 2;
              return (
                <path
                  key={dependency + "->" + task.id}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  className="graph-edge"
                  markerEnd="url(#arrowhead)"
                />
              );
            })
          )}
          {[...positions.entries()].map(([id, position]) => {
            const scheduled = scheduleMap.get(id);
            const ok = scheduled?.status === "scheduled";
            const lines = wrapName(position.task.name);
            return (
              <g key={id} transform={`translate(${position.x}, ${position.y})`} className="graph-node">
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={2}
                  className={ok ? "graph-node__box" : "graph-node__box graph-node__box--blocked"}
                >
                  <title>
                    {position.task.name}
                    {scheduled?.startMinute !== null && scheduled?.startMinute !== undefined
                      ? `: scheduled ${scheduled.startMinute}–${scheduled.endMinute ?? "?"}`
                      : ": not scheduled"}
                  </title>
                </rect>
                <circle cx={12} cy={14} r={3} className={ok ? "graph-node__dot" : "graph-node__dot graph-node__dot--bad"} />
                {lines.map((line, index) => (
                  <text key={index} x={22} y={18 + index * 14} className="graph-node__label">
                    {line}
                  </text>
                ))}
                <text x={NODE_WIDTH - 10} y={NODE_HEIGHT - 9} textAnchor="end" className="graph-node__meta">
                  {position.task.optional ? "optional" : position.task.phase}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="graph-mobile-list">
        <h3>Prerequisite list</h3>
        <ol>
          {plan.tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.name}</strong>
              <span>
                {task.dependsOn.length
                  ? "after " +
                    task.dependsOn
                      .map((dependency) => taskMap.get(dependency)?.name ?? dependency)
                      .join(", ")
                  : "no prerequisite"}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <ul className="sr-only">
        {plan.tasks.map((task) => (
          <li key={task.id}>
            {task.name} depends on {task.dependsOn.length ? task.dependsOn.join(", ") : "nothing"}.
          </li>
        ))}
      </ul>
    </section>
  );
}