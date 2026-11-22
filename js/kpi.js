/**
 * Shift KPI for the training lot. Three numbers:
 * cycle time (minutes), throughput (lots per hour), availability (percent).
 * Plus one compact line: shift target versus actual output.
 *
 * Values come from the hero step, the ops snapshot, an open hold, and crane
 * pause. They change when the elapsed-time bucket changes, not every frame.
 * The target is a preset for the product and scenario, not a planning system.
 */
import { buildOpsSnapshot, opsInputFromSession } from "./ops.js";

export const KPI_BUCKET_SEC = 6;

const PRODUCT_TARGET = { "HBX-100": 4.2, "HBX-240": 3.4, "HBX-S12": 5.1 };
const SCENARIO_TARGET = { first: 0, kgd: -0.8, overlay: -0.6, warpage: -0.6, pause: -0.5 };

/** Preset output rate (lots per hour) for this product and scenario. */
export function shiftTarget({ productId = "HBX-100", scenario = "first" } = {}) {
  const base = PRODUCT_TARGET[productId] ?? PRODUCT_TARGET["HBX-100"];
  const cut = SCENARIO_TARGET[scenario] ?? 0;
  return Math.round((base + cut) * 10) / 10;
}

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

  const targetOut = shiftTarget({
    productId: input.productId || "HBX-100",
    scenario: input.scenario || "first",
  });

  return {
    cycleMin,
    throughput,
    availability,
    bucket,
    targetOut,
    actualOut: throughput,
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
    productId: session.product?.id || "HBX-100",
    scenario: session.scenario || "first",
  });
}
