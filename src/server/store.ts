import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSeedWorld } from "../domain/seed.js";
import { ForkcastDomainError } from "../domain/errors.js";
import type { WorldState } from "../domain/types.js";
import type { ActivityEvent } from "../shared/contracts.js";

const SEED_ID = "forkcast-six-guests-v1";
const MAX_ACTIVITY = 250;

interface ActivityFile {
  schemaVersion: 1;
  events: ActivityEvent[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertWorldShape(value: unknown): asserts value is WorldState {
  if (!isRecord(value)) throw new Error("world is not an object");
  if (value.schemaVersion !== 1) throw new Error("unsupported world schemaVersion");
  if (value.seedId !== SEED_ID) throw new Error("unexpected seedId");
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1) {
    throw new Error("world revision must be a positive integer");
  }
  if (!isRecord(value.inventory)) throw new Error("inventory is missing");
  if (!isRecord(value.resources)) throw new Error("resources is missing");
  if (!Array.isArray(value.baseTasks) || value.baseTasks.length === 0) {
    throw new Error("baseTasks is missing");
  }
  if (!Array.isArray(value.meals) || value.meals.length === 0) throw new Error("meals is missing");
  if (typeof value.arrivalDeadlineMinute !== "number") throw new Error("deadline is missing");
}

function parseActivity(value: unknown): ActivityEvent[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.events)) {
    throw new Error("invalid activity file");
  }
  const events: ActivityEvent[] = [];
  for (const entry of value.events) {
    if (
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.atIso === "string" &&
      typeof entry.type === "string" &&
      typeof entry.title === "string" &&
      typeof entry.detail === "string" &&
      (entry.severity === "info" ||
        entry.severity === "success" ||
        entry.severity === "warning" ||
        entry.severity === "error")
    ) {
      events.push(entry as unknown as ActivityEvent);
    }
  }
  return events.slice(-MAX_ACTIVITY);
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = filePath + "." + randomUUID() + ".tmp";
  try {
    await writeFile(tempPath, JSON.stringify(value, null, 2) + "\n", "utf8");
    await rename(tempPath, filePath);
  } catch (cause) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw new ForkcastDomainError(
      "PERSISTENCE_ERROR",
      "Could not write the local demo data atomically: " +
        (cause instanceof Error ? cause.message : String(cause))
    );
  }
}

/**
 * Local, file-backed demonstration state. The store is deliberately limited to
 * a dedicated data directory and never deletes unrelated files.
 */
export class DemoStore {
  private world: WorldState;
  private activity: ActivityEvent[];
  private worldQueue: Promise<unknown> = Promise.resolve();
  private activityQueue: Promise<unknown> = Promise.resolve();
  readonly dataDir: string;
  readonly worldPath: string;
  readonly activityPath: string;

  private constructor(
    dataDir: string,
    world: WorldState,
    activity: ActivityEvent[]
  ) {
    this.dataDir = dataDir;
    this.worldPath = path.join(dataDir, "demo-state.json");
    this.activityPath = path.join(dataDir, "activity.json");
    this.world = world;
    this.activity = activity;
  }

  static async open(dataDir: string): Promise<DemoStore> {
    const resolved = path.resolve(dataDir);
    await mkdir(resolved, { recursive: true });
    const store = new DemoStore(resolved, createSeedWorld(), []);
    await store.load();
    return store;
  }

  private async load(): Promise<void> {
    const recovered: string[] = [];
    let world: WorldState | null = null;
    try {
      const raw = await readFile(this.worldPath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      assertWorldShape(parsed);
      world = parsed;
    } catch (error) {
      // Only ENOENT means "first run". Anything else is preserved before seed.
      const isMissing =
        error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
      if (!isMissing) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backup = path.join(this.dataDir, `demo-state.corrupt-${stamp}.json`);
        try {
          await rename(this.worldPath, backup);
          recovered.push(`Malformed demo state was preserved at ${path.basename(backup)} and the seed was restored.`);
        } catch (moveError) {
          throw new ForkcastDomainError(
            "PERSISTENCE_ERROR",
            "Malformed demo state could not be preserved, so FORKCAST refused to overwrite it.",
            { cause: moveError instanceof Error ? moveError.message : String(moveError) }
          );
        }
      }
      world = createSeedWorld();
      await writeJsonAtomic(this.worldPath, world);
    }
    this.world = world;

    try {
      const raw = await readFile(this.activityPath, "utf8");
      this.activity = parseActivity(JSON.parse(raw));
    } catch (error) {
      const isMissing =
        error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
      this.activity = [];
      if (!isMissing) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backup = path.join(this.dataDir, `activity.corrupt-${stamp}.json`);
        try {
          await rename(this.activityPath, backup);
          recovered.push("Malformed activity history was preserved and a new history was started.");
        } catch (moveError) {
          throw new ForkcastDomainError(
            "PERSISTENCE_ERROR",
            "Malformed activity history could not be preserved, so FORKCAST refused to overwrite it.",
            { cause: moveError instanceof Error ? moveError.message : String(moveError) }
          );
        }
      }
      await writeJsonAtomic(this.activityPath, {
        schemaVersion: 1,
        events: this.activity
      } satisfies ActivityFile);
    }

    for (const note of recovered) {
      await this.recordActivity({
        type: "DATA_RECOVERED",
        title: "Demo data recovered",
        detail: note,
        severity: "warning"
      });
    }
  }

  getWorldSnapshot(): WorldState {
    return structuredClone(this.world);
  }

  getActivitySnapshot(): ActivityEvent[] {
    return structuredClone(this.activity);
  }

  get worldRevision(): number {
    return this.world.revision;
  }

  private enqueueWorld<T>(task: () => Promise<T>): Promise<T> {
    const run = this.worldQueue.then(task, task);
    this.worldQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private enqueueActivity<T>(task: () => Promise<T>): Promise<T> {
    const run = this.activityQueue.then(task, task);
    this.activityQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async replaceWorld(next: WorldState, expectedRevision?: number): Promise<void> {
    await this.enqueueWorld(async () => {
      assertWorldShape(next);
      if (expectedRevision !== undefined && this.world.revision !== expectedRevision) {
        throw new ForkcastDomainError(
          "STALE_PLAN",
          `The demo revision changed from ${expectedRevision} to ${this.world.revision}. The write was rejected.`
        );
      }
      await writeJsonAtomic(this.worldPath, next);
      this.world = structuredClone(next);
    });
  }

  async resetWorld(nextRevision?: number): Promise<WorldState> {
    return this.enqueueWorld(async () => {
      const seed = createSeedWorld();
      if (nextRevision !== undefined) {
        if (!Number.isInteger(nextRevision) || nextRevision < 1) {
          throw new ForkcastDomainError("INVALID_ARGUMENT", "Reset revision must be positive.");
        }
        seed.revision = nextRevision;
      }
      await writeJsonAtomic(this.worldPath, seed);
      this.world = seed;
      return structuredClone(seed);
    });
  }

  async recordActivity(
    input: Omit<ActivityEvent, "id" | "atIso">,
    atIso = new Date().toISOString()
  ): Promise<ActivityEvent> {
    return this.enqueueActivity(async () => {
      const event: ActivityEvent = {
        ...input,
        id: "act_" + randomUUID(),
        atIso
      };
      const next = [...this.activity, event].slice(-MAX_ACTIVITY);
      await writeJsonAtomic(this.activityPath, {
        schemaVersion: 1,
        events: next
      } satisfies ActivityFile);
      this.activity = next;
      return structuredClone(event);
    });
  }
}