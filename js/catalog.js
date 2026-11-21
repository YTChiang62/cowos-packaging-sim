/**
 * Product catalog for the packaging pilot line.
 *
 * HBX-100 is the full CoWoS-S template in route.js / recipes.js.
 * HBX-240 keeps that backbone and tightens warp, align, and a few recipes.
 * HBX-S12 is a single-die substrate route: no interposer fab and no CoW.
 * A lot binds one product. There is no second state machine.
 */

import {
  DOCK_REQUIREMENTS,
  FLOW,
  HOLDS,
  MORPHS,
  OUTPUT_PRESENT,
  PUTAWAY,
  S12_DOCKS,
  S12_FLOW,
  S12_HOLDS,
  S12_MORPHS,
  S12_OUTPUT,
  TOOLS,
} from "./route.js";
import { FLOW_ID, RECIPES } from "./recipes.js";

const M1_M3 = new Set(TOOLS.filter((tool) => tool.bay === "m1" || tool.bay === "m3").map((tool) => tool.id));

function tighten(recipe, flowId, overrides) {
  return {
    ...recipe,
    id: `${recipe.id}-240`,
    flow: flowId,
    params: recipe.params.map((param) => (
      overrides && overrides[param.id] != null ? { ...param, value: overrides[param.id] } : { ...param }
    )),
  };
}

const FLOW_240 = "HBX-240-COWOS-S";
const TIGHT = {
  s213: { qty: 16 },
  s322: { align: 0.5 },
  s324: { force: 80, align: 1 },
  s327: { limit: 1 },
  s423: { limit: 80 },
  s431: { count: 64 },
  s513: { content: "HBX240" },
  s514: { limit: 90 },
  s532: { program: "FT-HBX240-B7" },
};

const RECIPES_240 = {};
const FLOW_240_STEPS = FLOW.map((step) => {
  const base = RECIPES[step.recipe];
  const next = tighten(base, FLOW_240, TIGHT[step.id]);
  RECIPES_240[next.id] = next;
  return { ...step, recipe: next.id };
});

function s12Recipe(step) {
  const base = RECIPES[step.recipe] || RECIPES["R-s213"];
  const id = step.recipe.startsWith("R-s12") ? step.recipe : `${step.recipe}-S12`;
  return {
    id,
    flow: "HBX-S12-SUB",
    op: step.id,
    tool: step.tool,
    params: base.params.map((param) => ({ ...param })),
  };
}

const RECIPES_S12 = {};
const FLOW_S12 = S12_FLOW.map((step) => {
  const recipe = s12Recipe(step);
  if (step.id === "s12_issue") {
    const qty = recipe.params.find((param) => param.id === "qty");
    if (qty) qty.value = 1;
  }
  if (step.id === "s513") {
    const content = recipe.params.find((param) => param.id === "content");
    if (content) content.value = "HBXS12";
  }
  if (step.id === "s532") {
    const program = recipe.params.find((param) => param.id === "program");
    if (program) program.value = "FT-HBXS12-A1";
  }
  RECIPES_S12[recipe.id] = recipe;
  return { ...step, recipe: recipe.id };
});

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
    poseProfile: "cowos",
    rules: null,
    kgdQty: 9,
    sites: 12,
    hbmCount: 8,
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
    flow: FLOW_240_STEPS,
    recipes: RECIPES_240,
    holds: HOLDS,
    morphs: MORPHS,
    poseProfile: "cowos",
    rules: {
      docks: DOCK_REQUIREMENTS,
      output: OUTPUT_PRESENT,
      putaway: PUTAWAY,
      kgdQty: 16,
    },
    kgdQty: 16,
    sites: 16,
    hbmCount: 8,
    materials: ["mat_int", "mat_kgd", "mat_sub", "mat_ball"],
    zones: ["INT", "DBK", "SUB", "FG"],
    skipWaferMorph: false,
    skippedTools: [],
  }),
  product({
    id: "HBX-S12",
    flowId: "HBX-S12-SUB",
    nameKey: "prod_hbxs12_name",
    blurbKey: "prod_hbxs12_blurb",
    storyKey: "prod_hbxs12_story",
    mark: "HBX-S12",
    flow: FLOW_S12,
    recipes: RECIPES_S12,
    holds: S12_HOLDS,
    morphs: S12_MORPHS,
    poseProfile: "substrate",
    rules: {
      docks: S12_DOCKS,
      output: S12_OUTPUT,
      putaway: PUTAWAY,
      kgdQty: 8,
    },
    kgdQty: 8,
    sites: 8,
    hbmCount: 0,
    materials: ["mat_kgd", "mat_sub", "mat_ball"],
    zones: ["DBK", "SUB", "FG"],
    skipWaferMorph: true,
    skippedTools: [...M1_M3],
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
