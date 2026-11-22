/**
 * Simulated shop-floor snapshot for the APEX-3D trainer.
 * Pure data: no DOM and no Three.js. The hero lot still lives in js/mes.js.
 * Companion lots are derived here so the overview, the chips, and the small
 * product meshes stay on the same tools. They are not a second state machine
 * and they do not take a crane job.
 *
 * Bottleneck severity, highest first:
 *   open hold, longest queue (a KGD shortage on that queue is material),
 *   load at or above LOAD_THRESHOLD, crane pause, otherwise clear.
 * Numbers are derived from the session. They step with elapsed time in
 * fixed buckets and do not jump every frame.
 */
import { equipmentView } from "./equip.js";
import { BAY_IDS, FLOW, PORTS } from "./route.js";

export const LOAD_THRESHOLD = 80;
export const QUEUE_THRESHOLD = 3;
export const BUSY_UTIL = 60;
export const OPS_LAYER_STORAGE_KEY = "apex3d-ops-layers";
export const LAYER_IDS = ["load", "alarm", "queue", "current"];

export const SEVERITY = {
  hold: 400,
  queue: 200,
  load: 100,
  pause: 50,
  clear: 0,
};

/** Keys the three dictionaries must all define. */
export const OPS_COPY_KEYS = [
  "opsKicker",
  "opsTitle",
  "opsLayerLabel",
  "opsLayerLoad",
  "opsLayerAlarm",
  "opsLayerQueue",
  "opsLayerCurrent",
  "opsBay_m1",
  "opsBay_m2",
  "opsBay_m3",
  "opsBay_m4",
  "opsBay_m5",
  "opsStatLoad",
  "opsStatQueue",
  "opsStatAlarm",
  "opsChipAlarm",
  "opsChipQueue",
  "opsReason_overlay",
  "opsReason_warpage",
  "opsReason_void",
  "opsReason_kgd",
  "opsReason_pause",
  "opsAdvice_hold_overlay",
  "opsAdvice_hold_warpage",
  "opsAdvice_hold_void",
  "opsAdvice_hold_kgd",
  "opsAdvice_kgd",
  "opsAdvice_queue",
  "opsAdvice_queue_tcb",
  "opsAdvice_load",
  "opsAdvice_pause",
  "opsAdvice_clear",
];

const BAY_ACCENT = {
  m1: "#d3925a",
  m2: "#3ee0c0",
  m3: "#8aa0ff",
  m4: "#e0a15a",
  m5: "#e7a098",
};

/** TCB is the bottleneck. Queues are per tool, not per step. */
const PRESSURE = {
  "TCB-32": 1,
  "DRI-15": 0.72,
  "PLT-17": 0.6,
  "MOLD-51": 0.7,
  "FLX-31": 0.55,
  "PRB-22": 0.4,
  "ATE-58": 0.42,
};
const BASE_QUEUE = {
  "TCB-32": 6,
  "DRI-15": 3,
  "PLT-17": 2,
  "MOLD-51": 2,
  "FLX-31": 2,
  "PRB-22": 1,
  "UF-42": 2,
  "ATT-44": 2,
  "MET-34": 2,
};

const UTIL_SCALE = { none: 18, few: 34, many: 54 };
const QUEUE_SCALE = { none: 0, few: 0.5, many: 1 };

export function defaultLayers() {
  return { load: true, alarm: true, queue: true, current: false };
}

export function sanitizeLayers(raw) {
  const next = defaultLayers();
  if (!raw || typeof raw !== "object") return next;
  for (const id of LAYER_IDS) {
    if (typeof raw[id] === "boolean") next[id] = raw[id];
  }
  return next;
}

export function readLayers(storage) {
  if (!storage || typeof storage.getItem !== "function") return defaultLayers();
  try {
    const raw = storage.getItem(OPS_LAYER_STORAGE_KEY);
    if (!raw) return defaultLayers();
    return sanitizeLayers(JSON.parse(raw));
  } catch {
    return defaultLayers();
  }
}

export function writeLayers(layers, storage) {
  const next = sanitizeLayers(layers);
  if (storage && typeof storage.setItem === "function") {
    try {
      storage.setItem(OPS_LAYER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode and the acceptance fake can both refuse a write */
    }
  }
  return next;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function bucketOf(elapsed) {
  const t = Number(elapsed);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(t / 6);
}

function wobble(index, bucket, auto) {
  return Math.round(Math.sin((index + 1) * 1.4 + bucket * 0.8) * (auto ? 6 : 4));
}

function kgdLocked(carriers) {
  const rows = (carriers || []).filter((c) => c.sku === "kgd" && c.zone === "DBK");
  if (!rows.length) return false;
  return rows.every((c) => c.status === "locked" || !(c.qty > 0));
}

function dockedFrom(fac) {
  const lot = (fac?.carriers || []).find((c) => c.id === fac.lotCarrierId);
  if (!lot) return null;
  const loc = String(lot.location || "");
  if (loc.startsWith("tool:")) return loc.slice(5);
  if (loc.startsWith("port:")) return PORTS[loc.slice(5)]?.tool || null;
  return null;
}

/** Normalize a Session or a plain descriptor. Elapsed is seconds. */
export function opsInputFromSession(session, elapsed = 0) {
  const step = session.step();
  const fac = session.facility?.snapshot?.() || {};
  const hold = session.hold
    ? { id: session.hold.id, stationId: session.hold.stationId }
    : null;
  return {
    intensity: session.intensity || "few",
    stepIndex: session.stepIndex,
    stepId: step.id,
    tool: step.tool,
    status: session.status,
    busy: !!session.busy,
    hold,
    craneMode: fac.mode || session.facility?.mode || "AUTO",
    kgdShortage: kgdLocked(fac.carriers) || fac.lastRefusal === "kgd_shortage" || hold?.id === "kgd",
    dockedTool: dockedFrom(fac),
    elapsed,
    auto: !!session.auto,
    scenario: session.scenario || null,
    productId: session.product?.id || null,
    eqMap: session.equip?.view?.(session.elapsed || elapsed || 0, {
      runningTool: session.busy && !session.hold && session.processProgress > 0 && !session._equipWait
        ? step.tool
        : null,
    }) || null,
  };
}

function normalize(input) {
  if (input && typeof input.step === "function" && input.facility) {
    return opsInputFromSession(input, input.opsElapsed || 0);
  }
  const stepIndex = clamp(input?.stepIndex ?? 0, 0, FLOW.length - 1);
  const step = FLOW[stepIndex];
  const intensity = UTIL_SCALE[input?.intensity] != null ? input.intensity : "few";
  return {
    intensity,
    stepIndex,
    stepId: input?.stepId || step.id,
    tool: input?.tool || step.tool,
    status: input?.status || "QUEUE",
    busy: !!input?.busy,
    hold: input?.hold?.id ? { id: input.hold.id, stationId: input.hold.stationId } : null,
    craneMode: input?.craneMode || "AUTO",
    kgdShortage: !!input?.kgdShortage,
    dockedTool: input?.dockedTool || null,
    elapsed: input?.elapsed || 0,
    auto: !!input?.auto,
    scenario: input?.scenario || null,
    productId: input?.productId || null,
    eqMap: input?.eqMap || null,
  };
}

function activeTools(state) {
  const ids = new Set();
  if (state.busy || state.status === "RUN" || state.status === "HOLD") ids.add(state.tool);
  if (state.dockedTool) ids.add(state.dockedTool);
  if (state.hold?.stationId) {
    const step = FLOW.find((item) => item.id === state.hold.stationId);
    if (step) ids.add(step.tool);
  }
  return ids;
}

function scoreTool(step, index, state, active) {
  const dist = index - state.stepIndex;
  const pressure = PRESSURE[step.tool] ?? 0.3;
  let util = 12 + pressure * UTIL_SCALE[state.intensity];
  if (index < state.stepIndex) util *= 0.72;
  util += wobble(index, bucketOf(state.elapsed), state.auto);
  util = clamp(Math.round(util), 4, 74);
  const heroHere = active.has(step.tool);
  if (heroHere) util = Math.max(util, 90);

  let queue = Math.round((BASE_QUEUE[step.tool] ?? 0) * QUEUE_SCALE[state.intensity]);
  if (dist === 0 || dist === 1) queue += state.intensity === "none" ? 0 : 1;
  if (step.hold === "kgd" && state.kgdShortage) queue = Math.max(queue, 4);
  if (state.craneMode === "PAUSE" && step.tool === state.tool) queue += 1;
  queue = Math.max(0, queue);

  const alarm = !!(state.hold && state.hold.stationId === step.id);
  const material = step.hold === "kgd" && !!state.kgdShortage;
  return {
    id: step.tool,
    stationId: step.id,
    bay: step.bay,
    index,
    util,
    queue,
    alarm,
    alarmReason: alarm ? state.hold.id : null,
    material,
    busy: util >= BUSY_UTIL,
    current: step.tool === state.tool,
    eq: "IDLE",
  };
}

function scoreBay(id, tools) {
  const mine = tools.filter((tool) => tool.bay === id);
  const avg = mine.reduce((sum, tool) => sum + tool.util, 0) / Math.max(1, mine.length);
  const peak = mine.reduce((max, tool) => Math.max(max, tool.util), 0);
  const load = clamp(Math.round(avg * 0.42 + peak * 0.58), 0, 100);
  return {
    id,
    load,
    alarmCount: mine.filter((tool) => tool.alarm).length,
    queueSum: mine.reduce((sum, tool) => sum + tool.queue, 0),
    current: mine.some((tool) => tool.current),
  };
}

function stat(key, n, tone) {
  return { key, vars: { n }, tone };
}

function selectBottleneck(tools, bays, state) {
  const hero = tools.find((tool) => tool.current) || tools[0];
  const bayName = (id) => `opsBay_${id}`;

  if (state.hold?.id) {
    const tool = tools.find((item) => item.stationId === state.hold.stationId) || hero;
    const bay = bays.find((item) => item.id === tool.bay);
    const stats = [stat("opsStatAlarm", bay?.alarmCount || 1, "alarm")];
    if (tool.queue > 0) stats.push(stat("opsStatQueue", tool.queue, "queue"));
    else stats.push(stat("opsStatLoad", tool.util, "load"));
    return {
      kind: "hold",
      severity: SEVERITY.hold,
      tool: tool.id,
      stationId: tool.stationId,
      bay: tool.bay,
      load: tool.util,
      queue: tool.queue,
      adviceKey: `opsAdvice_hold_${state.hold.id}`,
      adviceVars: { tool: tool.id, bayKey: bayName(tool.bay), queue: tool.queue, load: tool.util },
      stats: stats.slice(0, 2),
    };
  }

  const queued = tools.filter((tool) => tool.queue >= QUEUE_THRESHOLD);
  if (queued.length) {
    queued.sort((a, b) => b.queue - a.queue || Number(b.material) - Number(a.material) || a.index - b.index);
    const tool = queued[0];
    const material = !!tool.material;
    const adviceKey = material
      ? "opsAdvice_kgd"
      : tool.id === "TCB-32"
        ? "opsAdvice_queue_tcb"
        : "opsAdvice_queue";
    return {
      kind: material ? "material" : "queue",
      severity: SEVERITY.queue,
      tool: tool.id,
      stationId: tool.stationId,
      bay: tool.bay,
      load: tool.util,
      queue: tool.queue,
      adviceKey,
      adviceVars: { tool: tool.id, bayKey: bayName(tool.bay), queue: tool.queue, load: tool.util },
      stats: [stat("opsStatQueue", tool.queue, "queue"), stat("opsStatLoad", tool.util, "load")],
    };
  }

  const hot = tools.filter((tool) => tool.util >= LOAD_THRESHOLD);
  if (hot.length) {
    hot.sort((a, b) => b.util - a.util || a.index - b.index);
    const tool = hot[0];
    const bay = bays.find((item) => item.id === tool.bay);
    return {
      kind: "load",
      severity: SEVERITY.load,
      tool: tool.id,
      stationId: tool.stationId,
      bay: tool.bay,
      load: tool.util,
      queue: tool.queue,
      adviceKey: "opsAdvice_load",
      adviceVars: { tool: tool.id, bayKey: bayName(tool.bay), queue: tool.queue, load: tool.util, bayLoad: bay?.load ?? tool.util },
      stats: [stat("opsStatLoad", tool.util, "load")],
    };
  }

  if (state.craneMode === "PAUSE") {
    const stats = hero.queue > 0 ? [stat("opsStatQueue", hero.queue, "queue")] : [];
    return {
      kind: "pause",
      severity: SEVERITY.pause,
      tool: hero.id,
      stationId: hero.stationId,
      bay: hero.bay,
      load: hero.util,
      queue: hero.queue,
      adviceKey: "opsAdvice_pause",
      adviceVars: { tool: hero.id, bayKey: bayName(hero.bay), queue: hero.queue, load: hero.util },
      stats,
    };
  }

  return {
    kind: "clear",
    severity: SEVERITY.clear,
    tool: null,
    stationId: null,
    bay: null,
    load: 0,
    queue: 0,
    adviceKey: "opsAdvice_clear",
    adviceVars: {},
    stats: [],
  };
}

function chipFromTool(tool) {
  return {
    kind: "tool",
    id: tool.id,
    stationId: tool.stationId,
    bay: tool.bay,
    accent: BAY_ACCENT[tool.bay],
    load: tool.util,
    queue: tool.queue,
    alarm: tool.alarm,
    alarmReason: tool.alarmReason,
    material: tool.material,
    busy: tool.busy,
    current: tool.current,
    loadVisible: tool.busy,
    eq: tool.eq || "IDLE",
  };
}

function chipFromBay(bay) {
  return {
    kind: "bay",
    id: bay.id,
    stationId: null,
    bay: bay.id,
    accent: BAY_ACCENT[bay.id],
    load: bay.load,
    queue: bay.queueSum,
    alarm: bay.alarmCount > 0,
    alarmReason: null,
    material: bay.id === "m2" && bay.queueSum >= QUEUE_THRESHOLD,
    busy: bay.load >= BUSY_UTIL,
    current: bay.current,
    loadVisible: true,
    alarmCount: bay.alarmCount,
  };
}

export function buildOpsSnapshot(input) {
  const state = normalize(input);
  const active = activeTools(state);
  const scored = FLOW.map((step, index) => scoreTool(step, index, state, active));
  const tools = [];
  for (const stepScore of scored) {
    const prev = tools.find((tool) => tool.id === stepScore.id);
    if (!prev) {
      tools.push({ ...stepScore });
      continue;
    }
    prev.queue = Math.max(prev.queue, stepScore.queue);
    prev.util = Math.max(prev.util, stepScore.util);
    prev.alarm = prev.alarm || stepScore.alarm;
    prev.material = prev.material || stepScore.material;
    prev.busy = prev.util >= BUSY_UTIL;
    if (stepScore.alarm) prev.alarmReason = stepScore.alarmReason;
    if (stepScore.current) {
      prev.current = true;
      prev.stationId = stepScore.stationId;
      prev.index = stepScore.index;
    }
  }
  const eqMap = state.eqMap || equipmentView(state.elapsed, state.scenario);
  for (const tool of tools) tool.eq = eqMap[tool.id] || "IDLE";
  const bays = BAY_IDS.map((id) => scoreBay(id, tools));
  const bottleneck = selectBottleneck(tools, bays, state);
  const chips = [...bays.map(chipFromBay), ...tools.map(chipFromTool)];
  const companions = placeCompanions(state, tools);
  return {
    elapsedBucket: bucketOf(state.elapsed),
    intensity: state.intensity,
    craneMode: state.craneMode,
    kgdShortage: state.kgdShortage,
    holdId: state.hold?.id || null,
    tools,
    bays,
    chips,
    bottleneck,
    companions,
  };
}

/** few stays at 2 visible lots; many raises the floor to 4. none matches few. */
export function companionCount(intensity) {
  return intensity === "many" ? 4 : 2;
}

const COMPANION_IDS = ["APX-C01", "APX-C02", "APX-C03", "APX-C04"];

function placeCompanions(state, tools) {
  const n = companionCount(state.intensity);
  const hero = tools.find((tool) => tool.id === state.tool) || tools.find((tool) => tool.current) || null;
  const holdIndex = state.hold?.stationId
    ? (tools.find((tool) => tool.stationId === state.hold.stationId)?.index ?? null)
    : null;
  const allowed = (tool) => holdIndex == null || tool.index <= holdIndex;
  let pool = tools.filter((tool) => allowed(tool) && tool.queue > 0 && tool.id !== hero?.id);
  pool.sort((a, b) => b.queue - a.queue || a.index - b.index);
  if (pool.length < n) {
    const rest = tools.filter((tool) => allowed(tool) && tool.id !== hero?.id && !pool.includes(tool));
    rest.sort((a, b) => b.queue - a.queue || a.index - b.index);
    pool = pool.concat(rest);
  }
  if (pool.length < n && holdIndex != null) {
    const held = tools.find((tool) => tool.index === holdIndex);
    if (held) {
      while (pool.length < n) pool.push(held);
    }
  }
  if (pool.length < n) {
    const fallback = tools.filter((tool) => tool.id !== hero?.id);
    let i = 0;
    while (pool.length < n && fallback.length) {
      pool.push(fallback[i % fallback.length]);
      i += 1;
    }
  }
  return pool.slice(0, n).map((tool, index) => ({
    id: COMPANION_IDS[index],
    tool: tool.id,
    stationId: tool.stationId,
    bay: tool.bay,
    index: tool.index,
    queue: tool.queue,
    busy: !!tool.busy,
    alarm: !!tool.alarm,
    pose: tool.alarm || tool.queue > 0 ? "queue" : "dock",
    moving: false,
    slot: index,
  }));
}

export function buildCompanions(input) {
  if (input && Array.isArray(input.companions) && input.bottleneck && Array.isArray(input.tools)) {
    return input.companions;
  }
  return buildOpsSnapshot(input).companions;
}

export function selectCompanion(companions, id) {
  if (!id || !Array.isArray(companions)) return null;
  return companions.find((lot) => lot.id === id) || null;
}

/** Which parts of a chip the layer toggles actually draw. */
export function presentChip(chip, layers) {
  const on = sanitizeLayers(layers);
  const load = on.load && !!chip.loadVisible;
  const notable = chip.kind === "tool" && !!chip.eq && chip.eq !== "IDLE" && chip.eq !== "RUN";
  const alarm = on.alarm && (!!chip.alarm || notable);
  const queue = on.queue && chip.queue > 0;
  const current = on.current && !!chip.current;
  return {
    visible: load || alarm || queue || current,
    load,
    alarm,
    queue,
    current,
  };
}

export function visibleChips(snapshot, layers) {
  if (!snapshot) return [];
  return snapshot.chips.filter((chip) => presentChip(chip, layers).visible);
}
