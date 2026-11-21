/**
 * Shift KPI for the training lot. Three numbers only:
 * cycle time (minutes), throughput (lots per hour), availability (percent).
 *
 * Values come from the hero step, the ops snapshot, an open hold, and crane
 * pause. They change when the elapsed-time bucket changes, not every frame.
 */
import { buildOpsSnapshot, opsInputFromSession } from "./ops.js";

export const KPI_BUCKET_SEC = 6;

export function kpiBucket(elapsed) {
  const t = Number(elapsed);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(t / KPI_BUCKET_SEC);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * @param {object} input
 * stepIndex, flowLength, status, hold|{id}, craneMode, elapsed, intensity,
 * tools (ops snapshot tools), selectedIndex (companion station, optional)
 */
export function buildKpi(input = {}) {
  const bucket = kpiBucket(input.elapsed || 0);
  const flowLength = Math.max(1, input.flowLength || 21);
  const viewingCompanion = Number.isInteger(input.selectedIndex);
  const stepIndex = viewingCompanion ? input.selectedIndex : (input.stepIndex || 0);
  const status = viewingCompanion ? "RUN" : (input.status || "QUEUE");
  const done = status === "DONE" ? flowLength : Math.max(0, stepIndex);
  const into = status === "DONE" ? 0 : Math.min(17, bucket);
  const hold = !!(input.hold && input.hold.id) || !!input.holdId;
  const paused = (input.craneMode || "AUTO") === "PAUSE";

  let cycleMin = done * 18 + into;
  if (!viewingCompanion && hold) cycleMin += 6;

  const intensity = input.intensity || "few";
  const base = intensity === "many" ? 4.8 : intensity === "none" ? 2.4 : 3.6;
  let throughput = base * (0.65 + 0.35 * (Math.min(done, flowLength) / flowLength));
  if (hold) throughput *= 0.6;
  if (paused) throughput *= 0.75;
  throughput = Math.round(throughput * 10) / 10;

  const tools = Array.isArray(input.tools) ? input.tools : [];
  let availability = 96;
  if (tools.length) {
    const blocked = tools.filter((tool) => tool.alarm || tool.util >= 80).length;
    availability = Math.round(100 - (blocked / tools.length) * 38);
  }
  if (hold) availability = Math.min(availability, 84);
  if (paused) availability -= 11;
  availability = clamp(availability, 40, 99);

  return {
    cycleMin,
    throughput,
    availability,
    bucket,
  };
}

export function buildKpiFromSession(session, elapsed = 0, selectedIndex = null) {
  const base = opsInputFromSession(session, elapsed);
  const snap = buildOpsSnapshot(base);
  return buildKpi({
    ...base,
    flowLength: session.flow?.length || 21,
    tools: snap.tools,
    selectedIndex: Number.isInteger(selectedIndex) ? selectedIndex : null,
  });
}
