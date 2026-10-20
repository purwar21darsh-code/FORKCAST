import { formatTime } from "../format";
import type { ScheduleResult, ScheduledTask, WorldState } from "../types";

const WIDTH = 1240;
const LEFT = 248;
const RIGHT = 34;
const TOP = 58;
const ROW = 35;

function tickMinutes(start: number, end: number): number[] {
  const first = Math.ceil(start / 60) * 60;
  const ticks: number[] = [];
  for (let minute = first; minute <= end; minute += 60) ticks.push(minute);
  return ticks;
}

export function Timeline({
  schedule,
  world,
  label = "Baseline plan"
}: {
  schedule: ScheduleResult;
  world: WorldState;
  label?: string;
}) {
  const tasks = schedule.tasks
    .filter((task) => task.status === "scheduled" && task.startMinute !== null && task.endMinute !== null)
    .sort(
      (a, b) =>
        (a.startMinute ?? 0) - (b.startMinute ?? 0) ||
        (a.endMinute ?? 0) - (b.endMinute ?? 0) ||
        a.taskId.localeCompare(b.taskId)
    );
  const start = world.dayStartMinute;
  const end = Math.max(
    world.arrivalDeadlineMinute,
    schedule.completionMinute ?? world.arrivalDeadlineMinute,
    ...tasks.map((task) => task.endMinute ?? world.arrivalDeadlineMinute)
  ) + 10;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const height = TOP + Math.max(tasks.length, 1) * ROW + 20;
  const x = (minute: number) => LEFT + ((minute - start) / (end - start)) * plotWidth;
  const ticks = tickMinutes(start, end);

  return (
    <section className="timeline-panel" aria-labelledby="timeline-heading">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Calculated schedule / {label}</div>
          <h2 id="timeline-heading">
            The baseline future
            <span className="heading-note">
              finish {formatTime(schedule.completionMinute)} ·{" "}
              {schedule.slackMinutes === null ? "no slack" : schedule.slackMinutes + " min slack"}
            </span>
          </h2>
        </div>
        <div className="timeline-legend" aria-label="Timeline legend">
          <span><i className="swatch swatch--amber" /> Scheduled task</span>
          <span><i className="swatch swatch--deadline" /> Guest deadline</span>
          <span><i className="swatch swatch--optional" /> Optional</span>
        </div>
      </div>

      <div className="timeline-scroll">
        <svg
          className="timeline-svg"
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-label={`Timeline from ${formatTime(start)} to ${formatTime(end)}. Baseline completes at ${formatTime(schedule.completionMinute)}.`}
        >
          <defs>
            <linearGradient id="task-fill" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#f3bd55" />
              <stop offset="1" stopColor="#d99a32" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={x(tick)}
                x2={x(tick)}
                y1={TOP - 16}
                y2={height - 20}
                className="timeline-grid"
              />
              <text x={x(tick)} y={TOP - 25} textAnchor="middle" className="timeline-axis">
                {formatTime(tick)}
              </text>
            </g>
          ))}

          <line
            x1={x(world.arrivalDeadlineMinute)}
            x2={x(world.arrivalDeadlineMinute)}
            y1={TOP - 18}
            y2={height - 20}
            className="timeline-deadline"
          />
          <rect
            x={x(world.arrivalDeadlineMinute) - 52}
            y={TOP - 44}
            width={104}
            height={18}
            rx={2}
            className="timeline-deadline-label-bg"
          />
          <text
            x={x(world.arrivalDeadlineMinute)}
            y={TOP - 31}
            textAnchor="middle"
            className="timeline-deadline-label"
          >
            GUESTS 6 PM
          </text>

          {tasks.map((task, index) => {
            const y = TOP + index * ROW;
            const barX = x(task.startMinute ?? start);
            const barWidth = Math.max(5, x(task.endMinute ?? start) - barX);
            const label = task.name.length > 32 ? task.name.slice(0, 31) + "…" : task.name;
            return (
              <g key={task.taskId} className="timeline-row">
                <line
                  x1={16}
                  x2={WIDTH - RIGHT}
                  y1={y + 24}
                  y2={y + 24}
                  className="timeline-rowline"
                />
                <text x={16} y={y + 10} className="timeline-task-name">
                  {label}
                </text>
                <text x={16} y={y + 23} className="timeline-task-meta">
                  {task.durationMinutes} min · {task.resourcesAssigned.join(" + ") || "no resource"}
                  {task.optional ? " · optional" : ""}
                </text>
                <rect
                  x={barX}
                  y={y + 2}
                  width={barWidth}
                  height={20}
                  rx={2}
                  className={
                    "timeline-bar" +
                    (task.optional ? " timeline-bar--optional" : "") +
                    (task.phase === "check" ? " timeline-bar--check" : "")
                  }
                  fill={task.optional ? undefined : "url(#task-fill)"}
                >
                  <title>
                    {task.name}: {formatTime(task.startMinute)}–{formatTime(task.endMinute)} (
                    {task.durationMinutes} min). Depends on{" "}
                    {task.dependsOn.length ? task.dependsOn.join(", ") : "nothing"}.
                  </title>
                </rect>
                {barWidth > 92 ? (
                  <text x={barX + 6} y={y + 16} className="timeline-bar-label">
                    {formatTime(task.startMinute)}–{formatTime(task.endMinute)}
                  </text>
                ) : null}
                <text x={WIDTH - RIGHT} y={y + 16} textAnchor="end" className="timeline-end">
                  {formatTime(task.endMinute)}
                </text>
              </g>
            );
          })}

          {tasks.length === 0 ? (
            <text x={LEFT} y={TOP + 20} className="timeline-empty">
              No tasks were scheduled.
            </text>
          ) : null}
        </svg>
      </div>

      <ul className="timeline-mobile" aria-label="Scheduled task list">
        {tasks.map((task) => (
          <li key={task.taskId}>
            <div className="timeline-mobile__main">
              <strong>{task.name}</strong>
              <span>
                {formatTime(task.startMinute)}–{formatTime(task.endMinute)} ·{" "}
                {task.durationMinutes} min
              </span>
            </div>
            <div className="timeline-mobile__meta">
              {task.resourcesAssigned.join(" + ") || "no resource"}
              {task.optional ? " · optional" : ""}
            </div>
          </li>
        ))}
      </ul>

      <div className="timeline-footer">
        <span>
          {tasks.length} of {schedule.tasks.length} tasks scheduled · projected completion{" "}
          <strong>{formatTime(schedule.completionMinute)}</strong>
        </span>
        <span>
          {schedule.violations.filter((entry) => entry.severity === "error").length} hard
          violations
        </span>
      </div>
    </section>
  );
}

export function MiniTimeline({
  schedule,
  world
}: {
  schedule: ScheduleResult;
  world: WorldState;
}) {
  const tasks = schedule.tasks.filter(
    (task) => task.status === "scheduled" && task.startMinute !== null && task.endMinute !== null
  );
  const start = world.dayStartMinute;
  const end = Math.max(world.arrivalDeadlineMinute, schedule.completionMinute ?? 0);
  return (
    <div
      className="mini-timeline"
      role="img"
      aria-label={`Compact task timeline ending at ${formatTime(schedule.completionMinute)}`}
    >
      {tasks.map((task) => {
        const left = ((task.startMinute! - start) / (end - start)) * 100;
        const width = Math.max(0.8, ((task.endMinute! - task.startMinute!) / (end - start)) * 100);
        return (
          <span
            key={task.taskId}
            className={"mini-timeline__bar" + (task.optional ? " is-optional" : "")}
            style={{ left: left + "%", width: width + "%" }}
            title={`${task.name}: ${formatTime(task.startMinute)}–${formatTime(task.endMinute)}`}
          />
        );
      })}
      <span
        className="mini-timeline__deadline"
        style={{ left: ((world.arrivalDeadlineMinute - start) / (end - start)) * 100 + "%" }}
      />
    </div>
  );
}