/**
 * Product catalog for the packaging pilot line.
 *
 * HBX-100 keeps the route.js / recipes.js objects as its only spine.
 * HBX-240 and HBX-S12 bring their own flow and recipe tables.
 * A lot binds one product. There is no second state machine.
 *
 * HBX-S12 contract chosen here:
 * - Incoming inspect borrows a substrate magazine at IQC-11 and sends it
 *   back to SUB. No interposer FOUP is issued, so INT stays stocked.
 * - Die-bank then issues the already-singulated KGD tray (shortage still
 *   freezes that step). Substrate is issued again at bake.
 * - Attach starts from issued dice, not a diced wafer. No FRAME.
 * - CoW and dice tools stay on the floor and are not on this route.
 */

import {
  DOCK_REQUIREMENTS,
  FLOW,
  HOLDS,
  MORPHS,
  OUTPUT_PRESENT,
  PUTAWAY,
} from "./route.js";
import { FLOW_ID, RECIPES } from "./recipes.js";

function param(id, name, value, unit) {
  return { id, name, value, unit };
}

function recipe(flow, id, op, tool, params) {
  return { id, flow, op, tool, params };
}

function withRecipe(step, recipeId) {
  return { ...step, recipe: recipeId, contract: { ...step.contract } };
}

function adapt(id, patch = {}) {
  const base = FLOW.find((step) => step.id === id);
  return {
    ...base,
    ...patch,
    contract: { ...base.contract, ...(patch.contract || {}) },
  };
}

const FLOW_240 = "HBX-240-COW-WOS";

const RECIPES_240 = {
  "IQC-INSP-240": recipe(FLOW_240, "IQC-INSP-240", "iqc", "IQC-11", [
    param("sample", "Sample size", 8, "pcs"),
    param("program", "Inspect program", "HBX240-IQC-B", ""),
    param("accept", "Accept criteria", "0 fail", ""),
  ]),
  "KGD-ISSUE-240": recipe(FLOW_240, "KGD-ISSUE-240", "diebank", "DBK-02", [
    param("qty", "Issue qty", 20, "die"),
    param("map", "Tray map", "HBX-WFL-8", ""),
    param("fifo", "FIFO rule", "FIFO", ""),
  ]),
  "PLASMA-COW-240": recipe(FLOW_240, "PLASMA-COW-240", "plasma", "PLS-11", [
    param("gas", "Gas", "Ar/H2", ""),
    param("power", "Power", 320, "W"),
    param("time", "Time", 60, "s"),
    param("pressure", "Pressure", 70, "mTorr"),
  ]),
  "HBOND-COW-240": recipe(FLOW_240, "HBOND-COW-240", "hbond", "HB-21", [
    param("force", "Bond force", 55, "N"),
    param("temp", "Bond temp", 260, "°C"),
    param("align", "Align tolerance", 0.3, "µm"),
    param("dwell", "Dwell", 10, "s"),
  ]),
  "ANNEAL-COW-240": recipe(FLOW_240, "ANNEAL-COW-240", "anneal", "ANN-22", [
    param("temp", "Temp", 320, "°C"),
    param("time", "Time", 40, "min"),
    param("atmosphere", "Atmosphere", "N2", ""),
  ]),
  "MET-OVL-240": recipe(FLOW_240, "MET-OVL-240", "overlay", "MET-23", [
    param("limit", "Overlay limit", 0.6, "µm"),
    param("sites", "Sample sites", 13, "site"),
    param("wave", "Wavelength", 633, "nm"),
  ]),
  "BG-COW-240": recipe(FLOW_240, "BG-COW-240", "backgrind", "BG-24", [
    param("thick", "Target thickness", 55, "µm"),
    param("rpm", "Spindle speed", 1600, "rpm"),
    param("feed", "Feed", 0.3, "µm/s"),
  ]),
  "MOUNT-240": recipe(FLOW_240, "MOUNT-240", "mount", "MNT-80", [
    param("tape", "Tape type", "UV-dicing", ""),
    param("temp", "Mount temp", 70, "°C"),
    param("frame", "Frame", 300, "mm"),
  ]),
  "DICE-COW-240": recipe(FLOW_240, "DICE-COW-240", "dice", "DIC-81", [
    param("blade", "Blade", "NBC-ZH08", ""),
    param("feed", "Feed", 32, "mm/s"),
    param("street", "Street width", 60, "µm"),
  ]),
  "AOI-DICE-240": recipe(FLOW_240, "AOI-DICE-240", "diceaoi", "AOI-82", [
    param("program", "Inspect program", "HBX240-DICE-AOI", ""),
    param("chip", "Chipping limit", 10, "µm"),
    param("mag", "Magnification", 20, "×"),
  ]),
  "BAKE-SUB-240": recipe(FLOW_240, "BAKE-SUB-240", "subbake", "BAK-03", [
    param("temp", "Temp", 150, "°C"),
    param("time", "Time", 6, "h"),
    param("atmosphere", "Atmosphere", "N2", ""),
  ]),
  "WOS-ATTACH-240": recipe(FLOW_240, "WOS-ATTACH-240", "wos", "WOS-04", [
    param("force", "Attach force", 12, "N"),
    param("temp", "Attach temp", 290, "°C"),
    param("place", "Placement accuracy", 3, "µm"),
  ]),
  "UF-DISP-240": recipe(FLOW_240, "UF-DISP-240", "underfill", "UF-05", [
    param("volume", "Volume", 28, "mg"),
    param("pattern", "Pattern", "I-line", ""),
    param("visc", "Viscosity class", "UF-B", ""),
  ]),
  "UF-CURE-240": recipe(FLOW_240, "UF-CURE-240", "ufcure", "CUR-06", [
    param("profile", "Temp profile", "UF-RAMP-165", ""),
    param("time", "Time", 100, "min"),
    param("peak", "Peak temp", 165, "°C"),
  ]),
  "MET-WRP-240": recipe(FLOW_240, "MET-WRP-240", "warpage", "MET-07", [
    param("limit", "Warpage limit", 45, "µm"),
    param("sites", "Sample sites", 9, "site"),
    param("temp", "Temperature", 25, "°C"),
  ]),
  "BALL-ATT-240": recipe(FLOW_240, "BALL-ATT-240", "ball", "BGA-51", [
    param("alloy", "Ball alloy", "SAC305", ""),
    param("pitch", "Pitch", 0.3, "mm"),
    param("count", "Ball count", 64, "ea"),
  ]),
  "REFLOW-BGA-240": recipe(FLOW_240, "REFLOW-BGA-240", "reflow", "RFW-52", [
    param("peak", "Peak temp", 250, "°C"),
    param("profile", "Profile name", "SAC-250", ""),
    param("tal", "Time above liquidus", 70, "s"),
  ]),
  "FLUX-CLN-240": recipe(FLOW_240, "FLUX-CLN-240", "fluxclean", "CLN-53", [
    param("chem", "Chemistry", "DI/saponifier", ""),
    param("time", "Time", 10, "min"),
    param("temp", "Temp", 65, "°C"),
  ]),
  "FT-HBX-240": recipe(FLOW_240, "FT-HBX-240", "ftest", "TST-54", [
    param("program", "Test program", "FT-HBX240-B7", ""),
    param("temp", "Temp", 25, "°C"),
    param("sites", "Site count", 16, "site"),
  ]),
  "MARK-240": recipe(FLOW_240, "MARK-240", "mark", "MRK-55", [
    param("content", "Mark content", "HBX240", ""),
    param("template", "Template", "LASER-2L", ""),
    param("power", "Power", 9, "W"),
  ]),
  "PACK-TRAY-240": recipe(FLOW_240, "PACK-TRAY-240", "pack", "PCK-56", [
    param("tray", "Tray type", "JEDEC", ""),
    param("qty", "Pack qty", 16, "unit"),
    param("orient", "Orientation", "pin1-A1", ""),
  ]),
};

const RECIPE_240_BY_OP = Object.fromEntries(
  Object.values(RECIPES_240).map((item) => [item.op, item.id])
);

const FLOW_S12 = "HBX-S12-SUB";

const RECIPES_S12 = {
  "IQC-S12-01": recipe(FLOW_S12, "IQC-S12-01", "iqc", "IQC-11", [
    param("sample", "Sample size", 4, "pcs"),
    param("program", "Inspect program", "S12-IN-SUB", ""),
    param("accept", "Accept criteria", "0 fail", ""),
  ]),
  "KGD-S12-01": recipe(FLOW_S12, "KGD-S12-01", "diebank", "DBK-02", [
    param("qty", "Issue qty", 8, "die"),
    param("map", "Tray map", "S12-DIE-1", ""),
    param("fifo", "FIFO rule", "FIFO", ""),
  ]),
  "BAKE-S12-01": recipe(FLOW_S12, "BAKE-S12-01", "subbake", "BAK-03", [
    param("temp", "Temp", 125, "°C"),
    param("time", "Time", 2, "h"),
    param("atmosphere", "Atmosphere", "N2", ""),
  ]),
  "WOS-S12-01": recipe(FLOW_S12, "WOS-S12-01", "wos", "WOS-04", [
    param("force", "Attach force", 6, "N"),
    param("temp", "Attach temp", 260, "°C"),
    param("place", "Placement accuracy", 8, "µm"),
  ]),
  "UF-S12-01": recipe(FLOW_S12, "UF-S12-01", "underfill", "UF-05", [
    param("volume", "Volume", 12, "mg"),
    param("pattern", "Pattern", "L-line", ""),
    param("visc", "Viscosity class", "UF-A", ""),
  ]),
  "CURE-S12-01": recipe(FLOW_S12, "CURE-S12-01", "ufcure", "CUR-06", [
    param("profile", "Temp profile", "UF-RAMP-150", ""),
    param("time", "Time", 60, "min"),
    param("peak", "Peak temp", 150, "°C"),
  ]),
  "WRP-S12-01": recipe(FLOW_S12, "WRP-S12-01", "warpage", "MET-07", [
    param("limit", "Warpage limit", 90, "µm"),
    param("sites", "Sample sites", 5, "site"),
    param("temp", "Temperature", 25, "°C"),
  ]),
  "BALL-S12-01": recipe(FLOW_S12, "BALL-S12-01", "ball", "BGA-51", [
    param("alloy", "Ball alloy", "SAC305", ""),
    param("pitch", "Pitch", 0.5, "mm"),
    param("count", "Ball count", 16, "ea"),
  ]),
  "RFW-S12-01": recipe(FLOW_S12, "RFW-S12-01", "reflow", "RFW-52", [
    param("peak", "Peak temp", 245, "°C"),
    param("profile", "Profile name", "SAC-245", ""),
    param("tal", "Time above liquidus", 55, "s"),
  ]),
  "CLN-S12-01": recipe(FLOW_S12, "CLN-S12-01", "fluxclean", "CLN-53", [
    param("chem", "Chemistry", "DI/saponifier", ""),
    param("time", "Time", 6, "min"),
    param("temp", "Temp", 55, "°C"),
  ]),
  "FT-S12-01": recipe(FLOW_S12, "FT-S12-01", "ftest", "TST-54", [
    param("program", "Test program", "FT-HBXS12-A1", ""),
    param("temp", "Temp", 25, "°C"),
    param("sites", "Site count", 8, "site"),
  ]),
  "MARK-S12-01": recipe(FLOW_S12, "MARK-S12-01", "mark", "MRK-55", [
    param("content", "Mark content", "HBXS12", ""),
    param("template", "Template", "LASER-1L", ""),
    param("power", "Power", 7, "W"),
  ]),
  "PACK-S12-01": recipe(FLOW_S12, "PACK-S12-01", "pack", "PCK-56", [
    param("tray", "Tray type", "JEDEC", ""),
    param("qty", "Pack qty", 8, "unit"),
    param("orient", "Orientation", "pin1-A1", ""),
  ]),
};

const S12_FLOW = [
  adapt("iqc", {
    recipe: "IQC-S12-01",
    carrier: "MAG",
    morphIn: "bank",
    morphOut: "bank",
    contract: {
      name: "Incoming inspect",
      carrier: "Substrate magazine",
      in: "Singulated KGD still in DBK. Substrate magazine still in SUB. No interposer FOUP.",
      changes: "Inspect the substrate magazine at incoming. Do not issue an interposer.",
      out: "Magazine returns to SUB. Morphology stays bank.",
      hold: null,
    },
  }),
  adapt("diebank", {
    recipe: "KGD-S12-01",
    carrier: "TRAY",
    morphIn: "bank",
    morphOut: "issued",
    contract: {
      name: "Die-bank issue",
      carrier: "Die-bank tray",
      in: "Inspected lot, KGD still in DBK",
      changes: "Issue already-singulated KGD. No interposer, no stack.",
      out: "Issued KGD tray",
      hold: "KGD shortage — warehouse refuses the issue; the crane must not claim a tray that was never issued",
    },
  }),
  adapt("subbake", {
    recipe: "BAKE-S12-01",
    carrier: "MAG",
    morphIn: "issued",
    morphOut: "issued",
    contract: {
      name: "Substrate bake",
      carrier: "Substrate magazine",
      in: "Issued KGD tray. Substrate still in SUB.",
      changes: "Issue and bake the substrate. Dice stay issued.",
      out: "Baked substrate magazine",
      hold: null,
    },
  }),
  adapt("wos", {
    recipe: "WOS-S12-01",
    carrier: "TRAY",
    morphIn: "issued",
    morphOut: "wos",
    contract: {
      name: "Die attach",
      carrier: "KGD tray and substrate magazine",
      in: "Issued singulated KGD and a baked substrate",
      changes: "Place the die on the substrate. No frame, no dicing.",
      out: "Die on substrate",
      hold: null,
    },
  }),
  adapt("underfill", {
    recipe: "UF-S12-01",
    carrier: "TRAY",
    morphIn: "wos",
    morphOut: "wos",
  }),
  adapt("ufcure", {
    recipe: "CURE-S12-01",
    carrier: "TRAY",
    morphIn: "wos",
    morphOut: "underfilled",
  }),
  adapt("warpage", {
    recipe: "WRP-S12-01",
    carrier: "TRAY",
    morphIn: "underfilled",
    morphOut: "underfilled",
  }),
  adapt("ball", {
    recipe: "BALL-S12-01",
    carrier: "TRAY",
    morphIn: "underfilled",
    morphOut: "balled",
  }),
  adapt("reflow", {
    recipe: "RFW-S12-01",
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
  }),
  adapt("fluxclean", {
    recipe: "CLN-S12-01",
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
  }),
  adapt("ftest", {
    recipe: "FT-S12-01",
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
  }),
  adapt("mark", {
    recipe: "MARK-S12-01",
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
  }),
  adapt("pack", {
    recipe: "PACK-S12-01",
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "packed",
  }),
];

const S12_DOCKS = {
  iqc: [
    { port: "IQC-11", type: "MAG", role: "issue", zone: "SUB", sku: "substrate" },
  ],
  diebank: [
    { port: "DBK-02:tray", type: "TRAY", role: "issue", zone: "DBK", sku: "kgd", becomesLot: true },
  ],
  subbake: [
    { port: "BAK-03", type: "MAG", role: "issue", zone: "SUB", sku: "substrate" },
  ],
  wos: [
    { port: "WOS-04", type: "MAG", role: "follow", sku: "substrate" },
    { port: "WOS-04:out", type: "TRAY", role: "travel" },
  ],
  underfill: [{ port: "UF-05", type: "TRAY", role: "travel" }],
  ufcure: [{ port: "CUR-06", type: "TRAY", role: "travel" }],
  warpage: [{ port: "MET-07", type: "TRAY", role: "travel" }],
  ball: [{ port: "BGA-51", type: "TRAY", role: "travel" }],
  reflow: [{ port: "RFW-52", type: "TRAY", role: "travel" }],
  fluxclean: [{ port: "CLN-53", type: "TRAY", role: "travel" }],
  ftest: [{ port: "TST-54", type: "TRAY", role: "travel" }],
  mark: [{ port: "MRK-55", type: "TRAY", role: "travel" }],
  pack: [{ port: "PCK-56", type: "TRAY", role: "travel" }],
};

const S12_OUTPUT = {
  iqc: { type: "MAG", port: "IQC-11", borrow: true, returnZone: "SUB" },
  diebank: { type: "TRAY", port: "DBK-02:tray", markKgd: true },
  subbake: { type: "MAG", port: "BAK-03", keepLot: true, sku: "substrate" },
  wos: {
    type: "TRAY",
    port: "WOS-04:out",
    sideReturn: true,
    returnSku: "substrate",
    returnZone: "SUB",
  },
  underfill: { type: "TRAY", port: "UF-05" },
  ufcure: { type: "TRAY", port: "CUR-06" },
  warpage: { type: "TRAY", port: "MET-07" },
  ball: { type: "TRAY", port: "BGA-51" },
  reflow: { type: "TRAY", port: "RFW-52" },
  fluxclean: { type: "TRAY", port: "CLN-53" },
  ftest: { type: "TRAY", port: "TST-54" },
  mark: { type: "TRAY", port: "MRK-55" },
  pack: { type: "TRAY", port: "PCK-56", sku: "finished" },
};

const S12_MORPHS = ["bank", "issued", "wos", "underfilled", "balled", "packed"];
const S12_SKIPPED_TOOLS = ["PLS-11", "HB-21", "ANN-22", "MET-23", "BG-24", "MNT-80", "DIC-81", "AOI-82"];

function baysOf(flow) {
  const seen = [];
  for (const step of flow) {
    if (!seen.includes(step.bay)) seen.push(step.bay);
  }
  return seen;
}

function product(spec) {
  const flow = spec.flow;
  return {
    ...spec,
    steps: flow.length,
    toolsUsed: new Set(flow.map((step) => step.tool)).size,
    bays: baysOf(flow),
    recipe(id) {
      return spec.recipes[id] || null;
    },
  };
}

export const PRODUCTS = [
  product({
    id: "HBX-100",
    flowId: FLOW_ID,
    nameKey: "prod_hbx100_name",
    blurbKey: "prod_hbx100_blurb",
    storyKey: "prod_hbx100_story",
    mark: "HBX-100",
    flow: FLOW,
    recipes: RECIPES,
    holds: HOLDS,
    morphs: MORPHS,
    rules: null,
    kgdQty: 12,
    sites: 12,
    hbmCount: 4,
    materials: ["mat_int", "mat_kgd", "mat_sub", "mat_ball"],
    zones: ["INT", "DBK", "SUB", "FG"],
    skipWaferMorph: false,
    skippedTools: [],
  }),
  product({
    id: "HBX-240",
    flowId: FLOW_240,
    nameKey: "prod_hbx240_name",
    blurbKey: "prod_hbx240_blurb",
    storyKey: "prod_hbx240_story",
    mark: "HBX-240",
    flow: FLOW.map((step) => withRecipe(step, RECIPE_240_BY_OP[step.id])),
    recipes: RECIPES_240,
    holds: HOLDS,
    morphs: MORPHS,
    rules: {
      docks: DOCK_REQUIREMENTS,
      output: OUTPUT_PRESENT,
      putaway: PUTAWAY,
      kgdQty: 20,
    },
    kgdQty: 20,
    sites: 16,
    hbmCount: 8,
    materials: ["mat_int", "mat_kgd", "mat_sub", "mat_ball"],
    zones: ["INT", "DBK", "SUB", "FG"],
    skipWaferMorph: false,
    skippedTools: [],
  }),
  product({
    id: "HBX-S12",
    flowId: FLOW_S12,
    nameKey: "prod_hbxs12_name",
    blurbKey: "prod_hbxs12_blurb",
    storyKey: "prod_hbxs12_story",
    mark: "HBX-S12",
    flow: S12_FLOW,
    recipes: RECIPES_S12,
    holds: { kgd: HOLDS.kgd, void: HOLDS.void, warpage: HOLDS.warpage },
    morphs: S12_MORPHS,
    rules: {
      docks: S12_DOCKS,
      output: S12_OUTPUT,
      putaway: PUTAWAY,
      acceptExtra: { "IQC-11": ["MAG"] },
      kgdQty: 8,
    },
    kgdQty: 8,
    sites: 8,
    hbmCount: 0,
    materials: ["mat_kgd", "mat_sub", "mat_ball"],
    zones: ["DBK", "SUB", "FG"],
    skipWaferMorph: true,
    skippedTools: S12_SKIPPED_TOOLS,
  }),
];

const BY_ID = Object.fromEntries(PRODUCTS.map((item) => [item.id, item]));

export function productById(id) {
  return BY_ID[id] || null;
}

export function committedMorphOf(flow, stepIndex, beatIndex, holdOpen, processBeatIndex) {
  let morph = flow[0].morphIn;
  for (let i = 0; i < flow.length; i += 1) {
    const passed = stepIndex > i || (stepIndex === i && beatIndex > processBeatIndex && !holdOpen);
    if (!passed) break;
    morph = flow[i].morphOut;
  }
  return morph;
}
