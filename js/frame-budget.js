/**
 * Frame budget for the APEX-3D view.
 * Pure data: no Three.js and no DOM. plant.js applies it.
 * The training clock, the 86-step flow, and equipment states are not touched.
 * A fixed work-light count keeps the shader from rebuilding as the camera moves.
 */

export const FRAME_BUDGET = {
  maxPixelRatio: 1.5,
  shadowMapSize: 1024,
  workLights: 4,
  /** Local geometry smaller than this does not cast a useful sun shadow. */
  shadowMinExtent: 0.8,
};

export function castsShadow(extent) {
  return extent >= FRAME_BUDGET.shadowMinExtent;
}

/**
 * Nearest work lights to the camera target, always `min(limit, entries.length)`
 * of them. `pinnedId` stays in the set so the tool in hand is lit even when
 * the camera is looking somewhere else.
 */
export function selectWorkLights(entries, target, limit, pinnedId) {
  const list = Array.isArray(entries) ? entries : [];
  const cap = Math.max(0, Math.min(limit | 0, list.length));
  if (!cap) return [];
  const tx = target?.x || 0;
  const tz = target?.z || 0;
  const ranked = list.map((entry) => {
    const dx = entry.x - tx;
    const dz = entry.z - tz;
    return { id: entry.id, d: dx * dx + dz * dz };
  });
  ranked.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const picked = [];
  const seen = new Set();
  if (pinnedId && list.some((entry) => entry.id === pinnedId)) {
    picked.push(pinnedId);
    seen.add(pinnedId);
  }
  for (const entry of ranked) {
    if (picked.length >= cap) break;
    if (seen.has(entry.id)) continue;
    picked.push(entry.id);
    seen.add(entry.id);
  }
  return picked;
}
