/**
 * Shift scenarios for one training lot.
 * They only choose the initial warehouse, hold, or crane state.
 * The lot still walks the single Session spine and the existing hold sheet.
 */

export const SCENARIO_IDS = ["first", "kgd", "overlay", "warpage", "pause"];

export function scenarioApplies(product, id) {
  if (!SCENARIO_IDS.includes(id)) return false;
  if (id === "first" || id === "pause") return true;
  const flowIds = new Set((product?.flow || []).map((step) => step.id));
  const holds = product?.holds || {};
  if (id === "overlay") return !!(holds.overlay && flowIds.has(holds.overlay.stationId));
  if (id === "warpage") return !!(holds.warpage && flowIds.has(holds.warpage.stationId));
  if (id === "kgd") return !!(holds.kgd && flowIds.has(holds.kgd.stationId));
  return false;
}

export function scenariosForProduct(product) {
  return SCENARIO_IDS.filter((id) => scenarioApplies(product, id));
}

export function buildAfterAction(sessionLike, kpi = {}) {
  const scenario = sessionLike?.scenario || "shift";
  const resolved = sessionLike?.holdsResolved || [];
  const holds = resolved.length;
  return {
    scenario,
    happenedKey: `aarHappened_${scenario}`,
    guidanceKey: holds > 0 ? `aarDid_${scenario}` : `aarShould_${scenario}`,
    cycleMin: kpi.cycleMin ?? 0,
    holds,
    availability: kpi.availability ?? 0,
  };
}

/** The review shows these three figures and no others. */
export function afterActionFigures(review) {
  return [
    { key: "aarCycle", n: review.cycleMin },
    { key: "aarHolds", n: review.holds },
    { key: "aarAvail", n: review.availability },
  ];
}
