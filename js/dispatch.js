/**
 * Training dispatch between the hero lot and companion lots.
 * FIFO keeps arrival order. A hot lot jumps a busy tool or crane queue
 * only while the rule is HOT. The default rule is FIFO.
 */

export const DISPATCH_FIFO = "FIFO";
export const DISPATCH_HOT = "HOT";

export function normalizeRule(rule) {
  return rule === DISPATCH_HOT ? DISPATCH_HOT : DISPATCH_FIFO;
}

export function orderLots(lots, rule = DISPATCH_FIFO) {
  const hot = normalizeRule(rule) === DISPATCH_HOT;
  const rows = (lots || []).map((lot, index) => ({
    ...lot,
    arrival: Number.isFinite(lot.arrival) ? lot.arrival : index,
    hot: !!lot.hot,
  }));
  return rows.slice().sort((a, b) => {
    if (hot && a.hot !== b.hot) return a.hot ? -1 : 1;
    if (a.arrival !== b.arrival) return a.arrival - b.arrival;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** Crane moves keep insertion order unless the rule is hot-lot. */
export function orderMoves(moves, rule = DISPATCH_FIFO, hotLots = []) {
  const hot = new Set(hotLots || []);
  const rows = (moves || []).map((move, index) => ({
    ...move,
    seq: Number.isFinite(move.seq) ? move.seq : index,
  }));
  const useHot = normalizeRule(rule) === DISPATCH_HOT;
  return rows.slice().sort((a, b) => {
    if (useHot) {
      const ah = hot.has(a.lotId) ? 0 : 1;
      const bh = hot.has(b.lotId) ? 0 : 1;
      if (ah !== bh) return ah - bh;
    }
    return a.seq - b.seq;
  });
}
