/**
 * Pure pose math for the HBX-100 flow.
 * No Three.js. Product meshes and tool heads both read `motion()`.
 *
 * Continuity rule: operation N at t=0, fault=0 equals operation N-1 at t=1, fault=0.
 * A hold is fault=1 frozen near t=0.42. That pose shows the failure and is
 * not the next committed morphology.
 */

import { FLOW, stationById } from "./route.js";

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
    thin: 0,
    fillet: 0,
    filletCure: 0,
    mark: 0,
    bondGlow: 0,
  };
}

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
  p.thin = 0;
  return p;
}

/** Same stack after backgrind. The wafer and the die stack read thinner. */
export function poseThinned() {
  const p = poseBonded(0);
  p.thin = 1;
  p.wafer = { x: 0, y: 0.02, z: 0, s: 1, op: 1 };
  p.stack = { x: 0, y: 0.04, z: 0, s: 1 };
  return p;
}

/** Thinned wafer on dicing tape. Still one piece. */
export function poseMounted() {
  const p = poseThinned();
  p.frameOp = 1;
  p.tapeOp = 1;
  return p;
}

/** Four separated stacks on dicing tape. The full wafer is gone. */
export function poseSingulated() {
  const p = poseMounted();
  p.wafer = { x: 0, y: 0.02, z: 0, s: 0.15, op: 0 };
  p.stack = { x: -0.62, y: 0.06, z: 0.58, s: 0.55 };
  p.couponOp = 1;
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
  p.fillet = 0;
  p.balls = 0;
  p.trayOp = 0;
  return p;
}

/** Dispensed, not yet cured. */
export function poseWet() {
  const p = poseWos(0, 1);
  p.fillet = 0.72;
  p.filletCure = 0;
  p.voidS = 0;
  return p;
}

/** Cured fillet. Balls are still absent. */
export function poseUnderfilled() {
  const p = poseWet();
  p.fillet = 1;
  p.filletCure = 1;
  return p;
}

export function poseBalled() {
  const p = poseUnderfilled();
  p.balls = 1;
  p.mark = 0;
  p.trayOp = 0;
  return p;
}

export function poseMarked() {
  const p = poseBalled();
  p.mark = 1;
  return p;
}

export function posePacked() {
  const p = poseMarked();
  p.trayOp = 1;
  p.trayX = 0;
  p.voidS = 0;
  p.stack = { ...p.stack, y: p.stack.y - 0.05 };
  p.sub = { ...p.sub, y: -0.02 };
  return p;
}

function holdBlend(good, bad, u, f, span) {
  const k = smooth(Math.min(1, u / span));
  return blend(good, bad, f * k);
}

/** Pose for one operation at time t (0..1) and fault (0 good, 1 held). */
export function frame(station, t, fault = 0) {
  const f = Math.min(1, Math.max(0, fault));
  const u = Math.min(1, Math.max(0, t));
  if (station === "iqc" || station === "plasma" || station === "diceaoi" || station === "subbake") {
    const still = {
      iqc: poseBank,
      plasma: poseIssued,
      diceaoi: poseSingulated,
      subbake: poseSingulated,
    }[station];
    return still();
  }
  if (station === "diebank") {
    const k = smooth(u) * (1 - f);
    return blend(poseBank(), poseIssued(), k);
  }
  if (station === "hbond") {
    const k = smooth(Math.min(1, u / 0.78));
    return blend(poseIssued(), poseBonded(0), k);
  }
  if (station === "anneal") {
    const p = poseBonded(0);
    p.bondGlow = Math.sin(u * Math.PI);
    return p;
  }
  if (station === "overlay") {
    const bad = poseBonded(0.42);
    return holdBlend(poseBonded(0), bad, u, f, 0.36);
  }
  if (station === "backgrind") {
    return blend(poseBonded(0), poseThinned(), smooth(u));
  }
  if (station === "mount") {
    return blend(poseThinned(), poseMounted(), smooth(u));
  }
  if (station === "dice") {
    const split = smooth(Math.max(0, (u - 0.45) / 0.55));
    const pose = blend(poseMounted(), poseSingulated(), split);
    const kerfX = Math.min(1, smooth(u / 0.48));
    const kerfZ = u < 0.48 ? 0 : smooth((u - 0.48) / 0.42);
    pose.kerfX = kerfX * (1 - split);
    pose.kerfZ = kerfZ * (1 - split);
    return pose;
  }
  if (station === "wos") {
    const enter = smooth(Math.min(1, u / 0.5));
    const seat = smooth(Math.min(1, u / 0.75));
    return blend(poseSingulated(), poseWos(0, seat), Math.max(enter, seat));
  }
  if (station === "underfill") {
    const good = blend(poseWos(0, 1), poseWet(), smooth(u));
    const bad = poseWos(0, 1);
    bad.fillet = 0.12;
    bad.voidS = 1;
    bad.balls = 0;
    bad.trayOp = 0;
    return blend(good, holdBlend(poseWos(0, 1), bad, u, 1, 0.32), f);
  }
  if (station === "ufcure") {
    return blend(poseWet(), poseUnderfilled(), smooth(u));
  }
  if (station === "warpage") {
    const bent = poseUnderfilled();
    bent.sub = { ...bent.sub, warp: 1 };
    bent.stack = { ...bent.stack, y: bent.stack.y + 0.22 };
    bent.balls = 0;
    bent.trayOp = 0;
    return holdBlend(poseUnderfilled(), bent, u, f, 0.4);
  }
  if (station === "ball") {
    return blend(poseUnderfilled(), poseBalled(), smooth(Math.min(1, u / 0.7)));
  }
  if (station === "reflow" || station === "fluxclean" || station === "ftest") {
    return poseBalled();
  }
  if (station === "mark") {
    return blend(poseBalled(), poseMarked(), smooth(u));
  }
  if (station === "pack") {
    return blend(poseMarked(), posePacked(), smooth(u));
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

function contactorDip(t, fault) {
  if (fault > 0.5) return 0.22;
  if (t < 0.55) return 0;
  if (t < 0.74) return smooth((t - 0.55) / 0.19);
  return 1 - smooth(Math.min(1, (t - 0.74) / 0.2));
}

function ballLift(t) {
  if (t < 0.08) return 0.8;
  if (t < 0.42) return lerp(0.8, 0.18, smooth((t - 0.08) / 0.34));
  if (t < 0.58) return lerp(0.18, 0.72, smooth((t - 0.42) / 0.16));
  return 0.76;
}

export function bladeCue(t) {
  if (t < 0.05) return { x: -0.85, y: 0.95, z: -0.55, axis: "z" };
  if (t > 0.9) return { x: 0.85, y: 1.05, z: -0.55, axis: "z" };
  const y = 0.22;
  if (t < 0.48) {
    return { x: lerp(-0.85, 0.85, smooth((t - 0.05) / 0.43)), y, z: 0, axis: "z" };
  }
  return { x: 0, y, z: lerp(-0.7, 0.7, smooth((t - 0.48) / 0.42)), axis: "x" };
}

/** Tool-head and product pose for one frame of an operation. */
export function motion(station, t, fault = 0) {
  const u = Math.min(1, Math.max(0, t));
  const f = Math.min(1, Math.max(0, fault));
  const pose = frame(station, u, f);
  const kind = stationById(station)?.kind || "";
  let aim;
  if (kind === "ball" || kind === "packer" || station === "warpage" || station === "underfill" || station === "ufcure") {
    aim = { x: pose.sub.x, y: 0.2, z: pose.sub.z };
  } else if (station === "hbond" || station === "wos" || station === "dice" || station === "backgrind") {
    aim = worldOf(pose, pose.hbms[3]);
  } else {
    aim = worldOf(pose, pose.logic);
  }
  let lift = 0.85;
  if (station === "diebank") lift = issueLift(smooth(u) * (1 - f), f);
  else if (station === "hbond") lift = bondLift(u, f);
  else if (station === "wos") lift = wosLift(u, f);
  else if (station === "ball") lift = ballLift(u);
  else if (kind === "inspect" || kind === "metrology") lift = 0.72 + Math.sin(u * Math.PI) * 0.08;
  pose.alarm = f;
  const head = { x: aim.x, y: aim.y + lift, z: aim.z };
  const lamp = (station === "plasma" || station === "anneal" || station === "reflow" || station === "ufcure" || station === "subbake")
    ? Math.sin(Math.min(1, u) * Math.PI)
    : (station === "ftest" && f < 0.5 ? smooth(Math.max(0, 1 - Math.abs(u - 0.62) / 0.12)) : 0);
  const pusher = station === "wos" || station === "pack" ? smooth(Math.min(1, u / 0.42)) : 0;
  const table = station === "dice" ? bladeCue(u).x : 0;
  const contactor = station === "ftest" ? contactorDip(u, f) : 0;
  const sweep = (kind === "inspect" || kind === "metrology") ? Math.sin(u * Math.PI * 2) : 0;
  const door = (kind === "oven" || kind === "plasma" || kind === "clean") ? Math.sin(Math.min(1, u) * Math.PI) : 0;
  const needle = station === "underfill" ? (f > 0.5 ? 0.35 : (u > 0.2 && u < 0.75 ? smooth((u - 0.2) / 0.2) : 0)) : 0;
  const wheel = station === "backgrind" ? (u > 0.15 && u < 0.8 ? smooth((u - 0.15) / 0.2) : 0) : 0;
  const laser = station === "mark" ? (u > 0.25 && u < 0.8 ? 1 : 0) : 0;
  const pass = station === "underfill" || station === "ball"
    ? Math.sin(u * Math.PI * 2)
    : 0;
  return { pose, head, blade: bladeCue(u), lamp, pusher, table, contactor, sweep, door, needle, wheel, laser, pass };
}

export function specForMorph(morph) {
  if (morph === "bank" || !morph) return { station: "iqc", t: 0, fault: 0 };
  const st = FLOW.find((s) => s.morphOut === morph && s.morphIn !== s.morphOut);
  if (!st) return { station: "iqc", t: 0, fault: 0 };
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
