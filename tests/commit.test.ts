import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DemoStore } from "../src/server/store.js";
import { ForkcastService } from "../src/server/service.js";

const tempDirs: string[] = [];

async function setup() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "forkcast-commit-"));
  tempDirs.push(dir);
  const store = await DemoStore.open(dir);
  const service = new ForkcastService(store);
  return { dir, store, service };
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("approval and commit flow", () => {
  it("previews exact changes, commits once, persists and rejects a repeat", async () => {
    const { dir, store, service } = await setup();
    const draft = await service.draftPlan("Prepare dinner for six and test disruptions.");
    expect(draft.schedule.feasible).toBe(true);
    const beforePaneer = store.getWorldSnapshot().inventory.paneer?.quantity;

    const analysis = await service.simulateScenario("delivery-delay", draft.plan.id);
    expect(analysis.comparison.verdict).toBe("failed");
    const repair = await service.repairPlan(analysis.analysisId);
    expect(repair.result.status).toBe("feasible");
    expect(repair.proposalReady).toBe(true);
    if (!repair.repairedPlan) throw new Error("expected repaired plan");

    const preview = await service.previewCommit(repair.repairedPlan.id);
    expect(preview.approvalToken.startsWith("approval_")).toBe(true);
    expect(preview.preview.inventoryChanges.length).toBeGreaterThan(0);
    expect(store.getWorldSnapshot().revision).toBe(1);
    expect(store.getWorldSnapshot().appliedExecution).toBeNull();

    const commit = await service.commitApprovedPlan({
      planId: repair.repairedPlan.id,
      approvalToken: preview.approvalToken,
      approvalText: "APPROVE LOCAL DEMO COMMIT"
    });
    expect(commit.worldRevision).toBe(2);
    expect(commit.execution.planId).toBe(repair.repairedPlan.id);
    expect(commit.execution.mealId).toBe("paneer-curry");
    expect(commit.world.appliedExecution?.planId).toBe(repair.repairedPlan.id);
    expect(commit.world.inventory.paneer?.quantity).toBeLessThan(beforePaneer ?? 0);
    expect(store.getWorldSnapshot().revision).toBe(2);

    const activity = store.getActivitySnapshot();
    expect(activity.some((entry) => entry.type === "DEMO_COMMITTED")).toBe(true);
    expect(activity.some((entry) => entry.type === "REPAIR_VERIFIED")).toBe(true);
    expect(activity.some((entry) => entry.type === "COMMIT_PREVIEWED")).toBe(true);

    await expect(
      service.commitApprovedPlan({
        planId: repair.repairedPlan.id,
        approvalToken: preview.approvalToken,
        approvalText: "APPROVE LOCAL DEMO COMMIT"
      })
    ).rejects.toMatchObject({ code: "ALREADY_COMMITTED" });
    expect(store.getActivitySnapshot().some((entry) => entry.type === "COMMIT_REJECTED")).toBe(true);
    expect(store.getWorldSnapshot().revision).toBe(2);

    // Persistence: a brand-new store instance sees the committed revision.
    const reopened = await DemoStore.open(dir);
    expect(reopened.getWorldSnapshot().revision).toBe(2);
    expect(reopened.getWorldSnapshot().appliedExecution?.planId).toBe(repair.repairedPlan.id);

    const committedPaneer = store.getWorldSnapshot().inventory.paneer?.quantity ?? 0;
    const reset = await service.resetDemo("RESET DEMO DATA");
    expect(reset.worldRevision).toBe(3);
    expect(reset.world.appliedExecution).toBeNull();
    expect(reset.world.inventory.paneer?.quantity).toBeGreaterThan(committedPaneer);
    const afterReset = store.getWorldSnapshot();
    expect(afterReset.appliedExecution).toBeNull();
    expect(afterReset.revision).toBe(3);
    expect(store.getActivitySnapshot().some((entry) => entry.type === "DEMO_RESET")).toBe(true);
  });

  it("requires the exact explicit approval phrase and writes nothing without it", async () => {
    const { store, service } = await setup();
    const draft = await service.draftPlan("Prepare dinner for six.");
    const preview = await service.previewCommit(draft.plan.id);
    await expect(
      service.commitApprovedPlan({
        planId: draft.plan.id,
        approvalToken: preview.approvalToken,
        approvalText: "yes"
      })
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(store.getWorldSnapshot().revision).toBe(1);
    expect(store.getWorldSnapshot().appliedExecution).toBeNull();
    expect(store.getActivitySnapshot().some((entry) => entry.type === "COMMIT_REJECTED")).toBe(true);
  });

  it("rejects a stale revision after preview", async () => {
    const { store, service } = await setup();
    const draft = await service.draftPlan("Prepare dinner for six.");
    const preview = await service.previewCommit(draft.plan.id);
    const world = store.getWorldSnapshot();
    await store.replaceWorld({ ...world, revision: world.revision + 1 }, world.revision);
    await expect(
      service.commitApprovedPlan({
        planId: draft.plan.id,
        approvalToken: preview.approvalToken,
        approvalText: "APPROVE LOCAL DEMO COMMIT"
      })
    ).rejects.toMatchObject({ code: "STALE_PLAN" });
    expect(store.getWorldSnapshot().appliedExecution).toBeNull();
  });

  it("refuses to preview a plan the scheduler rejects", async () => {
    const { store, service } = await setup();
    const seed = store.getWorldSnapshot();
    await store.replaceWorld({ ...seed, arrivalDeadlineMinute: 900 }, seed.revision);
    const draft = await service.draftPlan("Impossible early dinner.");
    expect(draft.schedule.feasible).toBe(false);
    await expect(service.previewCommit(draft.plan.id)).rejects.toMatchObject({
      code: "PLAN_NOT_FEASIBLE"
    });
    expect(store.getWorldSnapshot().appliedExecution).toBeNull();
  });

  it("invalidates an in-flight approval when the demo is reset", async () => {
    const { service } = await setup();
    const draft = await service.draftPlan("Prepare dinner for six.");
    const preview = await service.previewCommit(draft.plan.id);
    await service.resetDemo("RESET DEMO DATA");
    await expect(
      service.commitApprovedPlan({
        planId: draft.plan.id,
        approvalToken: preview.approvalToken,
        approvalText: "APPROVE LOCAL DEMO COMMIT"
      })
    ).rejects.toMatchObject({ code: "INVALID_APPROVAL" });
  });

  it("requires the exact reset confirmation and preserves audit history", async () => {
    const { store, service } = await setup();
    await service.draftPlan("Prepare dinner for six.");
    const countBefore = store.getActivitySnapshot().length;
    await expect(service.resetDemo("yes")).rejects.toMatchObject({
      code: "RESET_CONFIRMATION_REQUIRED"
    });
    expect(store.getActivitySnapshot().length).toBe(countBefore);
    const reset = await service.resetDemo("RESET DEMO DATA");
    expect(reset.world.revision).toBe(2);
    expect(store.getActivitySnapshot().length).toBeGreaterThan(countBefore);
  });
});