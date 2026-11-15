/**
 * Pure pose math for the five HBX-100 stations.
 * No Three.js. Product meshes and tool heads both read `motion()`.
 *
 * Continuity rule: station N at t=0, fault=0 equals station N-1 at t=1, fault=0.
 * A hold is fault=1 frozen near t=0.42. That pose must show the failure
 * and must not already be the next station's committed morphology.
 */

import { STATIONS } from "./route.js";

export function smooth(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}

function blend(a, b, k) {
  if (typeof a === "number") return lerp(a, b, k);
  if (Array.isArray(a)) return a.map((v, i) => blend(v, b[i], k));
  const out = {};
  for (const key of Object.keys(a)) out[key] = blend(a[key], b[key], k);
  return out;
}

function base() {
  return {
    wafer: { x: 0.15, y: 0.05, z: -0.32, s: 0.92, op: 1 },
    stack: { x: 0, y: 0, z: 0, s: 1 },
    logic: { x: -0.55, y: 0.1, z: 0.22 },
    hbms: [
      { x: -0.55, y: 0.08, z: -0.28 },
      { x: -0.55, y: 0.08, z: -0.62 },
      { x: -0.12, y: 0.08, z: -0.28 },
      { x: -0.12, y: 0.08, z: 0.22 },
    ],
    bond: { x: 0, y: 0.02, z: 0, s: 0, op: 0 },
    couponOp: 0,
    frameOp: 0,
    tapeOp: 0,
    kerfX: 0,
    kerfZ: 0,
    cloneOp: 0,
    cloneSpread: 0,
    sub: { x: 1.55, y: 0, z: 0, op: 0, warp: 0 },
    balls: 0,
    trayX: 1.35,
    trayOp: 0,
    voidS: 0,
    ring: 0,
    pockets: 1,
    fiducial: 0,
  };
}

/** Bare KGD still sitting in the die-bank pockets, next to the source wafer. */
export function poseBank() {
  return base();
}

/** Issued KGD: separate dies on the nest, same height, not a stack. */
export function poseIssued() {
  const p = base();
  p.logic = { x: 0.62, y: 0.2, z: 0.46 };
  p.hbms = [
    { x: 1.12, y: 0.16, z: -0.5 },
    { x: 1.12, y: 0.16, z: -0.16 },
    { x: 1.12, y: 0.16, z: 0.16 },
    { x: 1.12, y: 0.16, z: 0.5 },
  ];
  p.pockets = 0.28;
  p.bond = { x: 0, y: 0.02, z: 0, s: 0, op: 0 };
  return p;
}

/** Stacked die on the wafer. `offset` shifts the stack off the bond target. */
export function poseBonded(offset) {
  const p = base();
  p.wafer = { x: 0, y: 0.05, z: 0, s: 1, op: 1 };
  p.stack = { x: offset, y: 0.08, z: 0, s: 1 };
  p.logic = { x: 0, y: 0.1, z: 0 };
  p.hbms = [
    { x: 0, y: 0.2, z: 0 },
    { x: 0, y: 0.3, z: 0 },
    { x: 0, y: 0.4, z: 0 },
    { x: 0, y: 0.5, z: 0 },
  ];
  p.bond = { x: 0, y: 0.02, z: 0, s: 1, op: 1 };
  p.couponOp = 0;
  p.pockets = 0;
  p.fiducial = 1;
  p.ring = Math.abs(offset) > 0.05 ? 1 : 0;
  p.sub = { x: 1.55, y: 0, z: 0, op: 0, warp: 0 };
  return p;
}

/** Four separated stacks on dicing tape. The full wafer is gone. */
export function poseSingulated() {
  const p = poseBonded(0);
  p.wafer = { x: 0, y: 0.02, z: 0, s: 0.15, op: 0 };
  p.stack = { x: -0.62, y: 0.08, z: 0.58, s: 0.55 };
  p.couponOp = 1;
  p.frameOp = 1;
  p.tapeOp = 1;
  p.kerfX = 0;
  p.kerfZ = 0;
  p.cloneOp = 1;
  p.cloneSpread = 1;
  p.fiducial = 0;
  p.ring = 0;
  p.pockets = 0;
  p.sub = { x: 1.55, y: 0, z: 0, op: 0, warp: 0 };
  return p;
}

/**
 * Hero stack on a package substrate.
 * `warp` 0..1 bends the substrate. `seat` 0..1 lowers the stack onto it.
 */
export function poseWos(warp, seat) {
  const p = poseSingulated();
  p.frameOp = 0;
  p.tapeOp = 0;
  p.kerfX = 0;
  p.kerfZ = 0;
  p.cloneOp = 0;
  p.cloneSpread = 1;
  p.wafer = { x: 0, y: 0.02, z: 0, s: 0.15, op: 0 };
  p.couponOp = 1;
  p.stack = { x: 0, y: 0.2 + (1 - seat) * 0.42, z: 0, s: 0.8 };
  p.sub = { x: 0, y: 0, z: 0, op: 1, warp };
  p.fiducial = 0;
  p.ring = 0;
  return p;
}

/** WoS assembly plus ball array and JEDEC tray. `voidS` is the underfill bubble. */
export function posePacked(balls, trayAmt, voidS) {
  const p = poseWos(0, 1);
  p.balls = balls;
  p.trayOp = trayAmt;
  p.trayX = lerp(1.35, 0, trayAmt);
  p.voidS = voidS;
  p.stack = { ...p.stack, y: p.stack.y - trayAmt * 0.05 };
  p.sub = { ...p.sub, y: -trayAmt * 0.02 };
  return p;
}

/** Pose for one station at time t (0..1) and fault (0 good, 1 held). */
export function frame(station, t, fault = 0) {
  const f = Math.min(1, Math.max(0, fault));
  const u = Math.min(1, Math.max(0, t));
  if (station === "diebank") {
    const k = smooth(u) * (1 - f);
    return blend(poseBank(), poseIssued(), k);
  }
  if (station === "hbond") {
    const kGood = smooth(Math.min(1, u / 0.78));
    const kBad = smooth(Math.min(1, u / 0.36));
    const k = Math.max(kGood, f * kBad);
    return blend(poseIssued(), poseBonded(0.42 * f), k);
  }
  if (station === "dice") {
    const split = smooth(Math.max(0, (u - 0.45) / 0.55));
    const pose = blend(poseBonded(0), poseSingulated(), split);
    const kerfX = Math.min(1, smooth(u / 0.48));
    const kerfZ = u < 0.48 ? 0 : smooth((u - 0.48) / 0.42);
    pose.kerfX = kerfX * (1 - split);
    pose.kerfZ = kerfZ * (1 - split);
    return pose;
  }
  if (station === "wos") {
    const enter = smooth(Math.min(1, u / 0.5));
    const seat = smooth(Math.min(1, u / 0.75)) * (1 - 0.62 * f);
    return blend(poseSingulated(), poseWos(f, seat), Math.max(enter, seat));
  }
  if (station === "ballpack") {
    const grow = smooth(Math.min(1, u / 0.55));
    const capped = Math.min(grow, 0.16);
    const balls = lerp(grow, capped, f);
    const trayAmt = (1 - f) * smooth(Math.max(0, (u - 0.5) / 0.5));
    const voidS = f * smooth(Math.min(1, u / 0.3));
    return posePacked(balls, trayAmt, voidS);
  }
  return poseBank();
}

function worldOf(pose, local) {
  return {
    x: pose.stack.x + local.x * pose.stack.s,
    y: pose.stack.y + local.y * pose.stack.s,
    z: pose.stack.z + local.z * pose.stack.s,
  };
}

function bondLift(t, fault) {
  const forced = 0.18;
  let natural;
  if (t < 0.12) natural = 0.78;
  else if (t < 0.48) natural = lerp(0.78, 0.16, smooth((t - 0.12) / 0.36));
  else if (t < 0.7) natural = 0.16;
  else natural = lerp(0.16, 0.78, smooth((t - 0.7) / 0.3));
  return fault * forced + (1 - fault) * natural;
}

function issueLift(k, fault) {
  if (fault > 0.85) return 0.72;
  let dip = 0;
  if (k < 0.18) dip = Math.sin((k / 0.18) * Math.PI);
  else if (k > 0.78) dip = Math.sin(((k - 0.78) / 0.22) * Math.PI);
  return 0.9 - dip * 0.58;
}

function wosLift(t, fault) {
  const forced = 0.46;
  let natural;
  if (t < 0.22) natural = 0.82;
  else if (t < 0.62) natural = lerp(0.82, 0.18, smooth((t - 0.22) / 0.4));
  else if (t < 0.78) natural = 0.18;
  else natural = lerp(0.18, 0.82, smooth((t - 0.78) / 0.22));
  return fault * forced + (1 - fault) * natural;
}

function ballLift(t, fault) {
  const forced = 0.22;
  let natural;
  if (t < 0.08) natural = 0.8;
  else if (t < 0.42) natural = lerp(0.8, 0.18, smooth((t - 0.08) / 0.34));
  else if (t < 0.58) natural = lerp(0.18, 0.72, smooth((t - 0.42) / 0.16));
  else natural = 0.76;
  return fault * forced + (1 - fault) * natural;
}

export function bladeCue(t) {
  if (t < 0.05) return { x: -1.15, y: 1.05, z: -0.85, axis: "z" };
  if (t > 0.9) return { x: 1.05, y: 1.2, z: -0.95, axis: "z" };
  const y = 0.18;
  if (t < 0.48) {
    return { x: lerp(-1.15, 1.15, smooth((t - 0.05) / 0.43)), y, z: 0, axis: "z" };
  }
  return { x: 0, y, z: lerp(-1.05, 1.05, smooth((t - 0.48) / 0.42)), axis: "x" };
}

/** Tool-head and product pose for one frame of a station. */
export function motion(station, t, fault = 0) {
  const u = Math.min(1, Math.max(0, t));
  const f = Math.min(1, Math.max(0, fault));
  const pose = frame(station, u, f);
  let aim;
  if (station === "ballpack") {
    aim = { x: pose.sub.x, y: 0.2, z: pose.sub.z };
  } else if (station === "hbond" || station === "wos" || station === "dice") {
    aim = worldOf(pose, pose.hbms[3]);
  } else {
    aim = worldOf(pose, pose.logic);
  }
  let lift = 0.8;
  if (station === "diebank") lift = issueLift(smooth(u) * (1 - f), f);
  else if (station === "hbond") lift = bondLift(u, f);
  else if (station === "wos") lift = wosLift(u, f);
  else if (station === "ballpack") lift = ballLift(u, f);
  else lift = 1.1;
  pose.alarm = f;
  const head = { x: aim.x, y: aim.y + lift, z: aim.z };
  const lamp = station === "ballpack" && f < 0.5 ? smooth(Math.max(0, 1 - Math.abs(u - 0.5) / 0.12)) : 0;
  const pusher = station === "wos" ? smooth(Math.min(1, u / 0.42)) : 0;
  return { pose, head, blade: bladeCue(u), lamp, pusher };
}

export function specForMorph(morph) {
  if (morph === "bank" || !morph) return { station: "diebank", t: 0, fault: 0 };
  const st = STATIONS.find((s) => s.morphOut === morph);
  if (!st) return { station: "diebank", t: 0, fault: 0 };
  return { station: st.id, t: 1, fault: 0 };
}

export function posesEqual(a, b, eps = 1e-6) {
  if (typeof a === "number") return Math.abs(a - b) <= eps;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => posesEqual(v, b[i], eps));
  }
  if (a && typeof a === "object") {
    const keys = Object.keys(a);
    if (!b || keys.length !== Object.keys(b).length) return false;
    return keys.every((k) => posesEqual(a[k], b[k], eps));
  }
  return a === b;
}
