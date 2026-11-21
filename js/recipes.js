/**
 * HBX-100 CoWoS-S recipes. One object per flow operation.
 * Parameters are typical training values from a public reference template,
 * not a production recipe.
 */

import { FLOW_ID, STEPS } from "./flow-data.js";

export { FLOW_ID };

export const RECIPES = Object.fromEntries(STEPS.map((step) => {
  const id = `R-${step.id}`;
  return [id, {
    id,
    flow: FLOW_ID,
    op: step.id,
    tool: step.tool,
    params: step.params,
  }];
}));

export function recipeById(id) {
  return RECIPES[id] || null;
}
