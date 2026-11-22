/**
 * Shop-floor state for the 34 shared tools.
 * RUN is derived while a lot is actually processing. The other five are
 * stored. DOWN, PM, and QUAL refuse to start a process. ASSIST waits for
 * an operator to clear it. Background events are bucketed and fair: they
 * expire, and a crane-pause scenario does not take a process tool down.
 */
import { TOOLS } from "./route.js";

export const EQ_STATES = ["RUN", "IDLE", "ASSIST", "DOWN", "PM", "QUAL"];
export const EQ_BLOCK_START = ["DOWN", "PM", "QUAL"];
const CYCLE = ["ASSIST", "DOWN", "PM", "QUAL"];
const TOOL_IDS = TOOLS.map((tool) => tool.id);

const SCENARIO_SEED = {
  first: { tool: "BGR-54", state: "PM", until: 18 },
  kgd: { tool: "XRY-56", state: "QUAL", until: 18 },
  overlay: { tool: "NDT-55", state: "ASSIST", until: 18 },
  warpage: { tool: "CVD-13", state: "DOWN", until: 18 },
};

export function eqBlocksStart(state) {
  return state === "DOWN" || state === "PM" || state === "QUAL";
}

export function eqBucket(elapsed) {
  const t = Number(elapsed);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(t / 6);
}

/** One non-idle tool per elapsed bucket, rotating through the floor. */
export function backgroundOf(index, count, bucket) {
  if (bucket < 1 || count <= 0 || index < 0) return "IDLE";
  if (index !== bucket % count) return "IDLE";
  return CYCLE[Math.floor(bucket / count) % CYCLE.length];
}

function seedFor(scenario) {
  const seed = SCENARIO_SEED[scenario];
  if (!seed || !TOOL_IDS.includes(seed.tool)) return {};
  return { [seed.tool]: { state: seed.state, until: seed.until } };
}

export class Equipment {
  constructor(scenario = null) {
    this.scenario = scenario || null;
    this.ids = TOOL_IDS.slice();
    this.forced = new Map();
    this.suppress = new Map();
    this.seeds = seedFor(this.scenario);
  }

  view(elapsed = 0, { runningTool = null } = {}) {
    const map = {};
    for (const id of this.ids) {
      map[id] = this.stateOf(id, elapsed, { running: id === runningTool });
    }
    return map;
  }

  stateOf(id, elapsed = 0, { running = false } = {}) {
    if (!this.ids.includes(id)) return "IDLE";
    const bucket = eqBucket(elapsed);
    if (this.forced.has(id)) {
      const forced = this.forced.get(id);
      if (forced === "IDLE" && running) return "RUN";
      return forced;
    }
    if (this.suppress.get(id) === bucket) return running ? "RUN" : "IDLE";
    if (this.scenario === "pause") return running ? "RUN" : "IDLE";
    const seed = this.seeds[id];
    if (seed && elapsed < seed.until) return seed.state;
    const bg = backgroundOf(this.ids.indexOf(id), this.ids.length, bucket);
    if (bg !== "IDLE") return bg;
    return running ? "RUN" : "IDLE";
  }

  isForced(id) {
    return this.forced.has(id);
  }

  force(id, state) {
    if (!this.ids.includes(id)) return false;
    if (!EQ_STATES.includes(state) || state === "RUN") return false;
    this.forced.set(id, state);
    return true;
  }

  /** Drop a forced or background assist so the tool can run again. */
  clearAssist(id, elapsed = 0) {
    if (this.stateOf(id, elapsed) !== "ASSIST") return false;
    if (this.forced.get(id) === "ASSIST") this.forced.delete(id);
    if (this.seeds[id]?.state === "ASSIST") delete this.seeds[id];
    this.suppress.set(id, eqBucket(elapsed));
    return this.stateOf(id, elapsed) !== "ASSIST";
  }

  /** Let a non-forced block expire for the rest of this time bucket. */
  releaseBlock(id, elapsed = 0) {
    if (this.forced.has(id)) return false;
    if (this.seeds[id]) delete this.seeds[id];
    this.suppress.set(id, eqBucket(elapsed));
    return true;
  }
}

export function equipmentView(elapsed = 0, scenario = null, opts = {}) {
  return new Equipment(scenario).view(elapsed, opts);
}
