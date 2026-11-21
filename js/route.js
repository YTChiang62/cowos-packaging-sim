/**
 * HBX-100 CoWoS-S route (trainer v12).
 *
 * Five modules, eighteen stages, eighty-six operations. The numbered public
 * template lists 83 steps; three compound lines are split so litho/etch,
 * sputter/plate, and bump reflow/clean each have their own operation.
 * Shared tools: many operations dock at the same machine.
 * Morphology commits only when the operation that owns that morph finishes
 * with no open hold:
 *   bank → bumped → issued → bonded → cowfill → os → underfilled
 *        → balled → molded → marked → packed
 *
 * This is a training line. Parameters are typical values from a public
 * reference template, not a production recipe, and nothing writes back to
 * a factory system.
 */

import { FLOW_ID, RECIPES, recipeById } from "./recipes.js";
import {
  MODULES,
  STAGES,
  STEPS,
  TEMPLATE_CODES,
  TOOL_DEFS,
} from "./flow-data.js";

export { FLOW_ID, RECIPES, recipeById, MODULES, STAGES, TEMPLATE_CODES };

export const MORPHS = [
  "bank",
  "bumped",
  "issued",
  "bonded",
  "cowfill",
  "os",
  "underfilled",
  "balled",
  "molded",
  "marked",
  "packed",
];

export const HOLD_AT = 0.42;
export const BAY_IDS = ["m1", "m2", "m3", "m4", "m5"];

const COL_X0 = -44;
const COL_PITCH = 5;
const NORTH_Z = -17.15;
const SOUTH_Z = 17.15;

function toolPlace(side, col) {
  const x = COL_X0 + col * COL_PITCH;
  if (side === "N") return { x, z: NORTH_Z, face: 1 };
  return { x, z: SOUTH_Z, face: -1 };
}

export const TOOLS = TOOL_DEFS.map(([id, bay, kind, side, col]) => ({
  id,
  bay,
  kind,
  place: { ...toolPlace(side, col), bay },
}));

const TOOL_BY_ID = Object.fromEntries(TOOLS.map((tool) => [tool.id, tool]));

function docksFor(step) {
  const port = step.tool;
  switch (step.dock) {
    case "INT":
      return [{ port, type: "FOUP", role: "issue", zone: "INT", sku: "interposer", becomesLot: true }];
    case "FOUP":
      return [{ port, type: "FOUP", role: "travel" }];
    case "KGD":
      return [
        { port: `${port}:tray`, type: "TRAY", role: "issue", zone: "DBK", sku: "kgd" },
        { port, type: "FOUP", role: "travel" },
      ];
    case "SUBIN":
      return [
        { port, type: "FOUP", role: "travel" },
        { port: `${port}:mag`, type: "MAG", role: "issue", zone: "SUB", sku: "substrate" },
      ];
    case "SUB":
      return [{ port, type: "MAG", role: "follow", sku: "substrate" }];
    case "ATT":
      return [
        { port: `${port}:mag`, type: "MAG", role: "follow", sku: "substrate", unlessLot: "TRAY" },
        { port, type: "FOUP", role: "travel", unlessLot: "TRAY" },
        { port: `${port}:out`, type: "TRAY", role: "travel", onlyLot: "TRAY" },
      ];
    case "TRAY":
    case "FIN":
      return [{ port, type: "TRAY", role: "travel" }];
    default:
      throw new Error(`unknown dock ${step.dock} on ${step.id}`);
  }
}

function presentFor(step) {
  const tool = step.tool;
  switch (step.present) {
    case "kgd":
      return { type: "FOUP", port: tool, markKgd: true };
    case "sub":
      return { type: "MAG", port: step.dock === "SUBIN" ? `${tool}:mag` : tool, keepLot: true, sku: "substrate" };
    case "att":
      return {
        type: "TRAY",
        port: `${tool}:out`,
        convertFrom: "FOUP",
        returnZone: "INT",
        returnSku: "substrate",
        sideZone: "SUB",
        newSku: "wip-tray",
        idPrefix: "JD-",
      };
    case "fin":
      return { type: "TRAY", port: tool, sku: "finished" };
    case "tray":
      return { type: "TRAY", port: tool };
    default:
      return { type: "FOUP", port: tool };
  }
}

function buildOp(step) {
  const tool = TOOL_BY_ID[step.tool];
  const stage = STAGES.find((item) => item.id === step.stage);
  return {
    id: step.id,
    code: step.code,
    module: stage.module,
    stage: step.stage,
    bay: tool.bay,
    tool: step.tool,
    kind: tool.kind,
    recipe: `R-${step.id}`,
    duration: step.dur,
    place: tool.place,
    carrier: step.carrier,
    morphIn: step.morphIn,
    morphOut: step.morphOut,
    hold: step.hold,
    split: step.split,
    profile: "cowos",
    contract: {
      name: step.name[2],
      carrier: step.carrier,
      in: step.morphIn,
      changes: step.name[2],
      out: step.morphOut,
      hold: step.hold ? `${step.hold} hold` : null,
    },
  };
}

export const FLOW = STEPS.map(buildOp);
export const STATIONS = FLOW;

const FLOW_BY_ID = Object.fromEntries(FLOW.map((step) => [step.id, step]));

export const HOLDS = {
  kgd: {
    id: "kgd",
    stationId: "s213",
    variant: "shortage",
    blocksMorph: "issued",
    radio: "radioKgdEE",
    actions: [
      { id: "wait", label: "hold_kgd_wait", hint: "hold_kgd_wait_s", role: null },
      { id: "partial", label: "hold_kgd_partial", hint: "hold_kgd_partial_s", role: "PE" },
    ],
  },
  overlay: {
    id: "overlay",
    stationId: "s327",
    variant: "offset",
    blocksMorph: "cowfill",
    radio: "radioOverlayPE",
    actions: [
      { id: "rework", label: "hold_overlay_rework", hint: "hold_overlay_rework_s", role: null, backTo: "s324" },
      { id: "scrap", label: "hold_overlay_scrap", hint: "hold_overlay_scrap_s", role: null, scrap: 2 },
      { id: "release", label: "hold_overlay_release", hint: "hold_overlay_release_s", role: "PE" },
    ],
  },
  warpage: {
    id: "warpage",
    stationId: "s423",
    variant: "warp",
    blocksMorph: "balled",
    radio: "radioWarpPE",
    actions: [
      { id: "rework", label: "hold_warpage_rework", hint: "hold_warpage_rework_s", role: null, backTo: "s412" },
      { id: "bake", label: "hold_warpage_bake", hint: "hold_warpage_bake_s", role: null },
      { id: "scrap", label: "hold_warpage_scrap", hint: "hold_warpage_scrap_s", role: null, newSubstrate: true },
      { id: "release", label: "hold_warpage_release", hint: "hold_warpage_release_s", role: "PE" },
    ],
  },
  void: {
    id: "void",
    stationId: "s332",
    variant: "void",
    blocksMorph: "cowfill",
    radio: "radioVoidMFG",
    actions: [
      { id: "rework", label: "hold_void_rework", hint: "hold_void_rework_s", role: null, backTo: "s332" },
      { id: "scrap", label: "hold_void_scrap", hint: "hold_void_scrap_s", role: null, scrap: 1 },
      { id: "release", label: "hold_void_release", hint: "hold_void_release_s", role: "PE" },
    ],
  },
};

export const CARRIER_TYPES = ["FOUP", "TRAY", "FRAME", "MAG"];
export const INV_STATUS = ["stock", "reserved", "transit", "locked"];

export const ZONES = [
  { id: "DBK", carrier: "TRAY", sku: "kgd", bins: ["A1", "A2", "A3"] },
  { id: "INT", carrier: "FOUP", sku: "interposer", bins: ["B1", "B2", "B3"] },
  { id: "SUB", carrier: "MAG", sku: "substrate", bins: ["C1", "C2", "C3"] },
  { id: "FG", carrier: "TRAY", sku: "finished", bins: ["D1", "D2", "D3"] },
];

export const STOCKER = { id: "stocker", place: { x: -49.2, z: 0 } };
export const OHT_MODES = ["AUTO", "MANUAL", "PAUSE"];
export const VEHICLE_STATES = ["idle", "goto_pick", "hoist_pick", "travel", "hoist_drop", "paused"];
export const VEHICLE_IDS = ["OHT-1", "OHT-2"];

/** Shorter than v11 so an 86-step auto-run stays a training-length loop. */
export const LEG = {
  travelMin: 0.55,
  travelMax: 1.05,
  travelSpeed: 48,
  hoist: 0.32,
  handoff: 0.22,
  stacker: 0.45,
};

export const RAIL_Y = 6.25;

const northTools = TOOLS.filter((tool) => tool.place.face > 0).sort((a, b) => a.place.x - b.place.x);
const southTools = TOOLS.filter((tool) => tool.place.face < 0).sort((a, b) => b.place.x - a.place.x);

export const RAIL_NODES = [
  { id: "ioDBK", x: -46, z: -2.4 },
  { id: "ioINT", x: -46, z: -0.8 },
  { id: "ioSUB", x: -46, z: 0.8 },
  { id: "ioFG", x: -46, z: 2.4 },
  { id: "westN", x: -46, z: -15.6 },
  ...northTools.map((tool) => ({ id: tool.id, x: tool.place.x, z: -15.6 })),
  { id: "eastN", x: 40, z: -15.6 },
  { id: "eastS", x: 40, z: 15.6 },
  ...southTools.map((tool) => ({ id: tool.id, x: tool.place.x, z: 15.6 })),
  { id: "westS", x: -46, z: 15.6 },
];

export const LOAD_LOCAL_Z = 1.55;

export const DOCK_REQUIREMENTS = Object.fromEntries(FLOW.map((step) => [step.id, docksFor(STEPS.find((item) => item.id === step.id))]));
export const OUTPUT_PRESENT = Object.fromEntries(FLOW.map((step) => [step.id, presentFor(STEPS.find((item) => item.id === step.id))]));

export const PORTS = {
  "io:DBK": { accept: ["TRAY"], rail: "ioDBK", zone: "DBK", kind: "io" },
  "io:INT": { accept: ["FOUP"], rail: "ioINT", zone: "INT", kind: "io" },
  "io:SUB": { accept: ["MAG"], rail: "ioSUB", zone: "SUB", kind: "io" },
  "io:FG": { accept: ["TRAY"], rail: "ioFG", zone: "FG", kind: "io" },
};

for (const step of FLOW) {
  for (const req of DOCK_REQUIREMENTS[step.id]) {
    const port = PORTS[req.port] || {
      accept: [],
      rail: step.tool,
      tool: step.tool,
      stationId: step.id,
      kind: "load",
    };
    if (!port.accept.includes(req.type)) port.accept.push(req.type);
    PORTS[req.port] = port;
  }
}

export const PUTAWAY = { stationId: "s535", zone: "FG", port: "io:FG", type: "TRAY" };

function cloneHold(hold, patch) {
  return {
    ...hold,
    ...patch,
    actions: (patch.actions || hold.actions).map((action) => ({ ...action })),
  };
}

export const S12_FLOW_IDS = [
  "s12_issue", "s214", "s231", "s232", "s233", "s12_attach",
  "s421", "s422", "s423", "s431", "s432", "s433", "s434",
  "s511", "s512", "s513", "s524", "s532", "s533", "s534", "s535",
];

function s12Step(id, patch) {
  const base = FLOW_BY_ID[id] || FLOW_BY_ID.s213;
  return {
    ...base,
    ...patch,
    id,
    profile: "substrate",
    contract: { ...base.contract, ...(patch.contract || {}) },
  };
}

export const S12_FLOW = [
  s12Step("s12_issue", {
    code: "2.1.3",
    morphIn: "bank",
    morphOut: "issued",
    carrier: "TRAY",
    hold: "kgd",
    recipe: "R-s12-issue",
    contract: {
      name: "KGD issue",
      carrier: "TRAY",
      in: "bank",
      changes: "Issue already-singulated KGD. No interposer.",
      out: "issued",
      hold: "kgd hold",
    },
  }),
  ...["s214", "s231", "s232", "s233"].map((id) => s12Step(id, {})),
  s12Step("s12_attach", {
    code: "4.1.2",
    tool: "ATT-44",
    kind: "wos",
    bay: "m4",
    module: "m4",
    stage: "s41",
    place: TOOL_BY_ID["ATT-44"].place,
    morphIn: "issued",
    morphOut: "os",
    carrier: "TRAY",
    hold: null,
    recipe: "R-s12-attach",
    contract: {
      name: "Die on substrate",
      carrier: "TRAY",
      in: "issued",
      changes: "Place the singulated die on the ABF substrate.",
      out: "os",
      hold: null,
    },
  }),
  ...["s421", "s422", "s423", "s431", "s432", "s433", "s434", "s511", "s512", "s513", "s524", "s532", "s533", "s534", "s535"]
    .map((id) => s12Step(id, {})),
];

export const S12_DOCKS = {
  s12_issue: [
    { port: "PRB-22:tray", type: "TRAY", role: "issue", zone: "DBK", sku: "kgd", becomesLot: true },
  ],
  s214: [{ port: "PRB-22:tray", type: "TRAY", role: "travel" }],
  s231: [{ port: "PRB-22:mag", type: "MAG", role: "issue", zone: "SUB", sku: "substrate" }],
  s232: [{ port: "CLN-24", type: "MAG", role: "follow", sku: "substrate" }],
  s233: [{ port: "BAK-26", type: "MAG", role: "follow", sku: "substrate" }],
  s12_attach: [
    { port: "ATT-44:mag", type: "MAG", role: "follow", sku: "substrate" },
    { port: "ATT-44:out", type: "TRAY", role: "travel" },
  ],
  s421: [{ port: "UF-42", type: "TRAY", role: "travel" }],
  s422: [{ port: "OVN-41", type: "TRAY", role: "travel" }],
  s423: [{ port: "MET-43", type: "TRAY", role: "travel" }],
  s431: [{ port: "BGA-45", type: "TRAY", role: "travel" }],
  s432: [{ port: "OVN-41", type: "TRAY", role: "travel" }],
  s433: [{ port: "CLN-46", type: "TRAY", role: "travel" }],
  s434: [{ port: "MET-43", type: "TRAY", role: "travel" }],
  s511: [{ port: "MOLD-51", type: "TRAY", role: "travel" }],
  s512: [{ port: "MOLD-51", type: "TRAY", role: "travel" }],
  s513: [{ port: "MRK-53", type: "TRAY", role: "travel" }],
  s524: [{ port: "NDT-55", type: "TRAY", role: "travel" }],
  s532: [{ port: "ATE-58", type: "TRAY", role: "travel" }],
  s533: [{ port: "ATE-58", type: "TRAY", role: "travel" }],
  s534: [{ port: "TNR-59", type: "TRAY", role: "travel" }],
  s535: [{ port: "TNR-59", type: "TRAY", role: "travel" }],
};

export const S12_OUTPUT = {
  s12_issue: { type: "TRAY", port: "PRB-22:tray", markKgd: true },
  s214: { type: "TRAY", port: "PRB-22:tray" },
  s231: { type: "MAG", port: "PRB-22:mag", keepLot: true, sku: "substrate" },
  s232: { type: "MAG", port: "CLN-24", keepLot: true, sku: "substrate" },
  s233: { type: "MAG", port: "BAK-26", keepLot: true, sku: "substrate" },
  s12_attach: {
    type: "TRAY",
    port: "ATT-44:out",
    sideReturn: true,
    returnSku: "substrate",
    returnZone: "SUB",
  },
  s421: { type: "TRAY", port: "UF-42" },
  s422: { type: "TRAY", port: "OVN-41" },
  s423: { type: "TRAY", port: "MET-43" },
  s431: { type: "TRAY", port: "BGA-45" },
  s432: { type: "TRAY", port: "OVN-41" },
  s433: { type: "TRAY", port: "CLN-46" },
  s434: { type: "TRAY", port: "MET-43" },
  s511: { type: "TRAY", port: "MOLD-51" },
  s512: { type: "TRAY", port: "MOLD-51" },
  s513: { type: "TRAY", port: "MRK-53" },
  s524: { type: "TRAY", port: "NDT-55" },
  s532: { type: "TRAY", port: "ATE-58" },
  s533: { type: "TRAY", port: "ATE-58" },
  s534: { type: "TRAY", port: "TNR-59" },
  s535: { type: "TRAY", port: "TNR-59", sku: "finished" },
};

export const S12_HOLDS = {
  kgd: cloneHold(HOLDS.kgd, { stationId: "s12_issue" }),
  void: cloneHold(HOLDS.void, {
    stationId: "s421",
    blocksMorph: "underfilled",
    actions: HOLDS.void.actions.map((action) => (
      action.id === "rework" ? { ...action, backTo: "s421" } : { ...action }
    )),
  }),
  warpage: cloneHold(HOLDS.warpage, {}),
};

export const S12_MORPHS = ["bank", "issued", "os", "underfilled", "balled", "molded", "marked", "packed"];

const EXTRA = Object.fromEntries(S12_FLOW.filter((step) => !FLOW_BY_ID[step.id]).map((step) => [step.id, step]));

function parkSpans() {
  const edges = [];
  const groups = BAY_IDS.map((id) => {
    const xs = TOOLS.filter((tool) => tool.bay === id).map((tool) => tool.place.x);
    return { id, min: Math.min(...xs), max: Math.max(...xs) };
  });
  edges.push(groups[0].min - 2.6);
  for (let i = 0; i < groups.length - 1; i += 1) {
    edges.push((groups[i].max + groups[i + 1].min) / 2);
  }
  edges.push(groups.at(-1).max + 2.6);
  return groups.map((group, i) => ({
    id: group.id,
    x: (edges[i] + edges[i + 1]) / 2,
    z: 0,
    w: edges[i + 1] - edges[i],
    d: 42,
  }));
}

export const PARKS = parkSpans();

export function portAccepts(portId, type) {
  const port = PORTS[portId];
  return !!(port && port.accept.includes(type));
}

export function returnZoneFor(carrier) {
  if (!carrier) return null;
  if (carrier.type === "FRAME") return null;
  if (carrier.sku === "finished" || carrier.sku === "wip-tray") return "FG";
  if (carrier.type === "FOUP") return "INT";
  if (carrier.type === "MAG") return "SUB";
  if (carrier.type === "TRAY") return carrier.sku === "kgd" || carrier.sku === "kgd-issued" ? "DBK" : "FG";
  return null;
}

export function loadPortXZ(station) {
  const face = station.place.face > 0 ? 1 : -1;
  return {
    x: station.place.x,
    z: station.place.z + face * LOAD_LOCAL_Z,
  };
}

let _rail = null;
export function railPath() {
  if (_rail) return _rail;
  const segs = [];
  let acc = 0;
  for (let i = 0; i < RAIL_NODES.length; i += 1) {
    const a = RAIL_NODES[i];
    const b = RAIL_NODES[(i + 1) % RAIL_NODES.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segs.push({ a, b, start: acc, len });
    acc += len;
  }
  const at = {};
  segs.forEach((seg, i) => { at[RAIL_NODES[i].id] = seg.start; });
  _rail = { segs, length: acc, at };
  return _rail;
}

export function nodeS(nodeId) {
  const s = railPath().at[nodeId];
  if (s == null) throw new Error(`unknown rail node ${nodeId}`);
  return s;
}

export function forwardDistance(from, to) {
  const length = railPath().length;
  let d = to - from;
  if (d < 0) d += length;
  return d;
}

export function railPoint(s) {
  const rail = railPath();
  let u = s % rail.length;
  if (u < 0) u += rail.length;
  for (const seg of rail.segs) {
    if (u <= seg.start + seg.len + 1e-6) {
      const k = seg.len === 0 ? 0 : Math.min(1, Math.max(0, (u - seg.start) / seg.len));
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * k,
        y: RAIL_Y,
        z: seg.a.z + (seg.b.z - seg.a.z) * k,
      };
    }
  }
  return { x: RAIL_NODES[0].x, y: RAIL_Y, z: RAIL_NODES[0].z };
}

export function travelDuration(distance) {
  if (distance < 0.3) return 0.45;
  return Math.min(LEG.travelMax, Math.max(LEG.travelMin, distance / LEG.travelSpeed));
}

export function stationById(id) {
  return FLOW_BY_ID[id] || EXTRA[id] || null;
}

export function stationByTool(tool) {
  return FLOW.find((step) => step.tool === tool) || null;
}

export function holdForStation(stationId) {
  return Object.values(HOLDS).find((hold) => hold.stationId === stationId) || null;
}

export function planHolds(intensity) {
  if (intensity === "none") return [];
  if (intensity === "few") return ["kgd", "void"];
  return ["kgd", "overlay", "warpage", "void"];
}

export function committedMorph(stepIndex, beatIndex, holdOpen, processBeatIndex) {
  let morph = FLOW[0].morphIn;
  for (let i = 0; i < FLOW.length; i += 1) {
    const passed = stepIndex > i || (stepIndex === i && beatIndex > processBeatIndex && !holdOpen);
    if (!passed) break;
    morph = FLOW[i].morphOut;
  }
  return morph;
}

export function morphRank(morph) {
  const i = MORPHS.indexOf(morph);
  return i < 0 ? -1 : i;
}

export function morphIsBlocked(morph, blocksMorph) {
  if (!blocksMorph) return false;
  return morphRank(morph) >= morphRank(blocksMorph);
}

export function opThatCommits(morph) {
  return FLOW.find((step) => step.morphOut === morph && step.morphIn !== step.morphOut) || null;
}

export function moduleById(id) {
  return MODULES.find((mod) => mod.id === id) || null;
}

export function stageById(id) {
  return STAGES.find((stage) => stage.id === id) || null;
}

export function genealogyRows(lot, morph, hold) {
  const rank = morphRank(morph);
  const rows = [{ key: "gen_source", value: `${lot.wafer} · ${lot.totalSites} sites` }];
  if (rank >= morphRank("issued")) {
    rows.push({ key: "gen_logic", value: lot.logic });
    rows.push({ key: "gen_hbm", value: lot.hbm.join(" · ") });
  } else {
    rows.push({ key: "gen_logic", value: "gen_pending" });
    rows.push({ key: "gen_hbm", value: "gen_pending" });
  }
  if (hold?.id === "overlay") rows.push({ key: "gen_bond", value: "gen_bond_offset" });
  else if (rank >= morphRank("bonded")) rows.push({ key: "gen_bond", value: `${lot.wafer}-COW` });
  if (rank >= morphRank("cowfill")) rows.push({ key: "gen_uf", value: "gen_uf_ok" });
  else if (hold?.id === "void") rows.push({ key: "gen_uf", value: "gen_uf_void" });
  if (rank >= morphRank("os")) {
    const sub = hold?.id === "warpage" ? `${lot.substrate} · HOLD` : lot.substrate;
    rows.push({ key: "gen_sub", value: sub });
    rows.push({ key: "gen_asm", value: `${lot.unit}-OS` });
  }
  if (rank >= morphRank("balled")) rows.push({ key: "gen_ball", value: "gen_ball_ok" });
  else if (hold?.id === "void") rows.push({ key: "gen_ball", value: "gen_ball_void" });
  if (rank >= morphRank("molded")) rows.push({ key: "gen_mold", value: "gen_mold_ok" });
  if (rank >= morphRank("marked")) rows.push({ key: "gen_mark", value: lot.unit });
  if (rank >= morphRank("packed")) rows.push({ key: "gen_unit", value: lot.unit });
  return rows;
}

const CONTRACT_FIELDS = ["name", "carrier", "in", "changes", "out", "hold"];

export function assertContract() {
  const errors = [];
  if (FLOW.length !== 86) errors.push(`expected 86 operations, got ${FLOW.length}`);
  if (MODULES.length !== 5) errors.push("expected 5 modules");
  if (STAGES.length !== 18) errors.push("expected 18 stages");
  if (TEMPLATE_CODES.length !== 83) errors.push("template code list drifted");
  const seenCodes = new Set(FLOW.map((step) => step.code));
  for (const code of TEMPLATE_CODES) {
    if (!seenCodes.has(code)) errors.push(`missing template step ${code}`);
  }
  if (FLOW.filter((step) => step.split).length !== 6) errors.push("expected three compound lines split into pairs");
  if (TOOLS.length !== 34) errors.push(`expected 34 shared tools, got ${TOOLS.length}`);
  if (new Set(FLOW.map((step) => step.tool)).size !== TOOLS.length) errors.push("a flow tool is not on the floor");
  const shared = FLOW.some((step, i) => FLOW.some((other, j) => j !== i && other.tool === step.tool));
  if (!shared) errors.push("tools should be shared across steps");
  if (MORPHS.join(",") !== "bank,bumped,issued,bonded,cowfill,os,underfilled,balled,molded,marked,packed") {
    errors.push("morph list drifted");
  }
  const ids = new Set();
  FLOW.forEach((step, i) => {
    if (!BAY_IDS.includes(step.bay)) errors.push(`${step.id} is outside the five modules`);
    if (ids.has(step.id)) errors.push(`duplicate operation ${step.id}`);
    ids.add(step.id);
    if (step.duration < 0.5 || step.duration > 1.6) errors.push(`${step.id} duration ${step.duration} is outside 0.5–1.6 s`);
    if (i === 0 && step.morphIn !== "bank") errors.push("route must start at bank");
    if (i === FLOW.length - 1 && step.morphOut !== "packed") errors.push("route must end at packed");
    if (i > 0 && step.morphIn !== FLOW[i - 1].morphOut) {
      errors.push(`${step.id} morphIn ${step.morphIn} does not follow ${FLOW[i - 1].morphOut}`);
    }
    for (const field of CONTRACT_FIELDS) {
      if (!(field in step.contract)) errors.push(`${step.id} missing contract.${field}`);
    }
    const recipe = recipeById(step.recipe);
    if (!recipe) errors.push(`${step.id} has no recipe`);
    else if (recipe.op !== step.id || recipe.tool !== step.tool || recipe.flow !== FLOW_ID) {
      errors.push(`${step.recipe} is not tied to ${step.id}`);
    } else if (!recipe.params || recipe.params.length < 3 || recipe.params.length > 6) {
      errors.push(`${step.recipe} needs 3–6 parameters`);
    }
    const node = RAIL_NODES.find((item) => item.id === step.tool);
    const xz = loadPortXZ(step);
    if (!node) errors.push(`${step.tool} is not on the rail`);
    else if (Math.hypot(node.x - xz.x, node.z - xz.z) > 0.2) errors.push(`${step.tool} rail node misses the load port`);
    if (!DOCK_REQUIREMENTS[step.id]?.length) errors.push(`${step.id} has no dock`);
    if (!OUTPUT_PRESENT[step.id]) errors.push(`${step.id} has no job-out`);
  });
  const commits = {
    bumped: "s149",
    issued: "s213",
    bonded: "s324",
    cowfill: "s334",
    os: "s412",
    underfilled: "s422",
    balled: "s431",
    molded: "s511",
    marked: "s513",
    packed: "s534",
  };
  for (const [morph, id] of Object.entries(commits)) {
    if (opThatCommits(morph)?.id !== id) errors.push(`${morph} should commit at ${id}`);
  }
  const expectHold = { kgd: "s213", overlay: "s327", void: "s332", warpage: "s423" };
  const expectBlock = { kgd: "issued", overlay: "cowfill", void: "cowfill", warpage: "balled" };
  const expectRework = { overlay: "s324", void: "s332", warpage: "s412" };
  for (const [id, stationId] of Object.entries(expectHold)) {
    const hold = HOLDS[id];
    if (!hold) errors.push(`missing hold ${id}`);
    else if (hold.stationId !== stationId || hold.blocksMorph !== expectBlock[id]) {
      errors.push(`hold ${id} is wired wrong`);
    }
  }
  for (const [id, back] of Object.entries(expectRework)) {
    const action = HOLDS[id]?.actions.find((item) => item.id === "rework");
    if (action?.backTo !== back) errors.push(`hold ${id} rework must return to ${back}`);
  }
  const owned = new Set(Object.values(HOLDS).map((hold) => hold.stationId));
  for (const step of FLOW) {
    if (step.contract.hold && !owned.has(step.id)) errors.push(`${step.id} names a hold that is not wired`);
    if (!step.contract.hold && owned.has(step.id)) errors.push(`${step.id} has a hold the contract does not name`);
  }
  if (ZONES.map((zone) => zone.id).join(",") !== "DBK,INT,SUB,FG") errors.push("warehouse zones drifted");
  if (OHT_MODES.join(",") !== "AUTO,MANUAL,PAUSE") errors.push("crane modes drifted");
  if (PUTAWAY.stationId !== "s535" || PUTAWAY.zone !== "FG") errors.push("ship must put away to FG");
  if (!DOCK_REQUIREMENTS.s111.some((req) => req.zone === "INT" && req.becomesLot)) errors.push("interposer issues at incoming inspect");
  if (!DOCK_REQUIREMENTS.s213.some((req) => req.zone === "DBK" && req.sku === "kgd")) errors.push("KGD issues at probe");
  const beforeSub = FLOW.slice(0, FLOW.findIndex((step) => step.id === "s231"));
  if (beforeSub.some((step) => (DOCK_REQUIREMENTS[step.id] || []).some((req) => req.zone === "SUB"))) {
    errors.push("substrate must not issue before substrate IQC");
  }
  if (ZONES.some((zone) => zone.carrier === "FRAME")) errors.push("FRAME must not be a warehouse zone");
  if (S12_FLOW.length < 16 || S12_FLOW.length > 24) errors.push("S12 length drifted");
  if (S12_FLOW.some((step) => step.module === "m1" || step.module === "m3")) errors.push("S12 must skip M1 and M3");
  const railIds = new Set(RAIL_NODES.map((node) => node.id));
  for (const [id, port] of Object.entries(PORTS)) {
    if (!railIds.has(port.rail)) errors.push(`port ${id} has no rail node`);
  }
  return errors;
}
