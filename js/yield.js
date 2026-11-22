/**
 * Training yield and binning for the existing M5 final-test steps.
 * Not a new module and not a plant SPC system. The split is deterministic
 * from the lot and the step so a replay stays stable.
 */

export function isFinalTest(step) {
  if (!step) return false;
  return step.id === "s532" || step.id === "s533" || step.tool === "ATE-58";
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function buildYield(lot, step) {
  const sites = Math.max(1, Number(lot?.totalSites) || 12);
  const h = hash(`${lot?.id || "LOT"}:${step?.id || "s533"}`);
  let fail = h % 9 === 0 ? 1 : 0;
  let downgrade = h % 3 === 0 ? 1 : 0;
  if (fail + downgrade >= sites) {
    fail = sites > 1 ? 1 : 0;
    downgrade = 0;
  }
  const pass = sites - fail - downgrade;
  const yieldPct = Math.round((pass / sites) * 1000) / 10;
  const grade = fail > 0 ? "C" : downgrade > 0 ? "B" : "A";
  return {
    stepId: step?.id || "s533",
    tool: step?.tool || "ATE-58",
    yieldPct,
    pass,
    downgrade,
    fail,
    grade,
    bins: `A ${pass} / B ${downgrade} / C ${fail}`,
  };
}
