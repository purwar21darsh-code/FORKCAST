import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DemoStore } from "../src/server/store.js";

const tempDirs: string[] = [];

async function tempDir(label: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "forkcast-store-" + label + "-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("local demo store", () => {
  it("seeds on first run and writes real JSON files atomically", async () => {
    const dir = await tempDir("seed");
    const store = await DemoStore.open(dir);
    expect(store.worldRevision).toBe(1);
    const files = await readdir(dir);
    expect(files).toContain("demo-state.json");
    expect(files).toContain("activity.json");
    const parsed = JSON.parse(await readFile(path.join(dir, "demo-state.json"), "utf8")) as {
      seedId: string;
    };
    expect(parsed.seedId).toBe("forkcast-six-guests-v1");
  });

  it("preserves malformed demo state before restoring the seed", async () => {
    const dir = await tempDir("corrupt");
    await writeFile(path.join(dir, "demo-state.json"), "{ this is not json", "utf8");
    const store = await DemoStore.open(dir);
    expect(store.worldRevision).toBe(1);
    const files = await readdir(dir);
    expect(files.some((file) => file.startsWith("demo-state.corrupt-"))).toBe(true);
    const events = store.getActivitySnapshot();
    expect(events.some((event) => event.type === "DATA_RECOVERED")).toBe(true);
  });

  it("preserves malformed activity history and starts cleanly", async () => {
    const dir = await tempDir("bad-activity");
    await writeFile(path.join(dir, "activity.json"), "not-json", "utf8");
    const store = await DemoStore.open(dir);
    const files = await readdir(dir);
    expect(files.some((file) => file.startsWith("activity.corrupt-"))).toBe(true);
    expect(store.getActivitySnapshot().some((event) => event.type === "DATA_RECOVERED")).toBe(true);
  });

  it("persists activity and the world across reopen", async () => {
    const dir = await tempDir("persist");
    const store = await DemoStore.open(dir);
    const event = await store.recordActivity({
      type: "PLAN_DRAFTED",
      title: "Test event",
      detail: "A real persisted event.",
      severity: "info"
    });
    const world = store.getWorldSnapshot();
    world.revision = 2;
    await store.replaceWorld(world, 1);

    const reopened = await DemoStore.open(dir);
    expect(reopened.worldRevision).toBe(2);
    expect(reopened.getActivitySnapshot().some((entry) => entry.id === event.id)).toBe(true);
  });

  it("refuses a write when the expected revision is stale", async () => {
    const dir = await tempDir("revision");
    const store = await DemoStore.open(dir);
    const world = store.getWorldSnapshot();
    world.revision = 2;
    await store.replaceWorld(world, 1);
    await expect(store.replaceWorld(world, 1)).rejects.toMatchObject({ code: "STALE_PLAN" });
    expect(store.worldRevision).toBe(2);
  });
});
