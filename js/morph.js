/**
 * Pure pose math for the HBX-100 flow.
 * No Three.js. Product meshes and tool heads both read `motion()`.
 *
 * Continuity rule: operation N at t=0, fault=0 equals operation N-1 at t=1, fault=0.
 * A hold is fault=1 frozen near t=0.42. That pose shows the failure and is
 * not the next committed morphology.
 */

import { FLOW, S12_FLOW, stationById } from "./route.js";

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
    dieOp: 1,
    mold: 0,
  };
}

let poseProfile = "cowos";

/** HBX-S12 draws dice on a substrate. HBX-100/240 keep the interposer wafer. */
export function useProfile(profile) {
  poseProfile = profile === "substrate" ? "substrate" : "cowos";
}

export function poseBank() {
  return base();
}

/** Bumped interposer: microbumps on the wafer, dies not stacked yet. */
export function poseBumped() {
  const p = poseBank();
  p.wafer = { x: 0, y: 0.05, z: 0, s: 1, op: 1 };
  p.pockets = 0;
  p.fiducial = 1;
  p.bond = { x: 0, y: 0.02, z: 0, s: 1, op: 1 };
  p.stack = { x: 0, y: 0.05, z: 0, s: 1 };
  p.dieOp = 0;
  p.logic = { x: 0, y: -1.2, z: 0 };
  p.hbms = p.hbms.map(() => ({ x: 1.4, y: -1.2, z: 0 }));
  return p;
}

/** Issued KGD beside the bumped interposer. Dies share one plane. */
export function poseIssued() {
  const p = poseBumped();
  p.dieOp = 1;
  p.pockets = 1;
  p.logic = { x: 0.62, y: 0.2, z: 0.46 };
  p.hbms = [
    { x: 1.12, y: 0.16, z: -0.5 },
    { x: 1.12, y: 0.16, z: -0.16 },
    { x: 1.12, y: 0.16, z: 0.16 },
    { x: 1.12, y: 0.16, z: 0.5 },
  ];
  return p;
}

/** Singulated KGD only. HBX-S12 never grows an interposer wafer. */
export function poseIssuedDie() {
  const p = poseIssued();
  p.wafer = { x: 0, y: 0.05, z: 0, s: 0.2, op: 0 };
  p.bond = { x: 0, y: 0.02, z: 0, s: 0, op: 0 };
  p.fiducial = 0;
  p.dieOp = 1;
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

/** CoW underfill on the wafer. No substrate yet. */
export function poseCowfill() {
  const p = poseBonded(0);
  p.fillet = 0.7;
  p.filletCure = 1;
  return p;
}

/**
 * Reconstructed wafer seated on the ABF substrate.
 * `warp` 0..1 bends the substrate. `seat` 0..1 lowers the stack onto it.
 */
export function poseOs(warp = 0, seat = 1) {
  const p = poseCowfill();
  p.stack = { x: 0, y: 0.18 + (1 - seat) * 0.36, z: 0, s: 0.82 };
  p.wafer = { x: 0, y: 0.1, z: 0, s: 0.78, op: 1 };
  p.sub = { x: 0, y: 0, z: 0, op: 1, warp };
  p.fillet = 0.45;
  p.filletCure = 1;
  return p;
}

/** Die on substrate, no interposer. Used by HBX-S12. */
export function poseDieOnSub(warp = 0, seat = 1) {
  const p = poseIssuedDie();
  p.pockets = 0;
  p.frameOp = 0;
  p.tapeOp = 0;
  p.stack = { x: 0, y: 0.18 + (1 - seat) * 0.36, z: 0, s: 0.85 };
  p.logic = { x: 0, y: 0.1, z: 0 };
  p.hbms = [
    { x: 0, y: 0.2, z: 0 },
    { x: 0, y: 0.28, z: 0 },
    { x: 0, y: 0.36, z: 0 },
    { x: 0, y: 0.44, z: 0 },
  ];
  p.wafer = { x: 0, y: 0.02, z: 0, s: 0.15, op: 0 };
  p.sub = { x: 0, y: 0, z: 0, op: 1, warp };
  p.bond = { x: 0, y: 0.02, z: 0, s: 0.4, op: 0.3 };
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
  const p = poseOs(0, 1);
  p.fillet = 0.72;
  p.filletCure = 0;
  p.voidS = 0;
  return p;
}

/** Cured second underfill. Balls are still absent. */
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

export function poseMolded() {
  const p = poseBalled();
  p.mold = 1;
  p.couponOp = 1;
  p.mark = 0;
  return p;
}

export function poseMarked() {
  const p = poseMolded();
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

function poseBare() {
  const p = poseBank();
  p.wafer = { x: 0, y: 0.05, z: 0, s: 0.2, op: 0 };
  p.pockets = 0.2;
  p.dieOp = 0;
  return p;
}

const COWOS = {
  bank: poseBank,
  bumped: poseBumped,
  issued: poseIssued,
  bonded: () => poseBonded(0),
  cowfill: poseCowfill,
  os: () => poseOs(0, 1),
  underfilled: poseUnderfilled,
  balled: poseBalled,
  molded: poseMolded,
  marked: poseMarked,
  packed: posePacked,
};

const SUBSTRATE = {
  bank: poseBare,
  issued: poseIssuedDie,
  os: () => poseDieOnSub(0, 1),
  underfilled: () => {
    const p = poseDieOnSub(0, 1);
    p.fillet = 1;
    p.filletCure = 1;
    return p;
  },
  balled: () => {
    const p = SUBSTRATE.underfilled();
    p.balls = 1;
    return p;
  },
  molded: () => {
    const p = SUBSTRATE.balled();
    p.mold = 1;
    p.couponOp = 1;
    return p;
  },
  marked: () => {
    const p = SUBSTRATE.molded();
    p.mark = 1;
    return p;
  },
  packed: () => {
    const p = SUBSTRATE.marked();
    p.trayOp = 1;
    p.trayX = 0;
    return p;
  },
};

function poseOf(morph, profile) {
  const table = profile === "substrate" ? SUBSTRATE : COWOS;
  const fn = table[morph] || COWOS[morph] || poseBank;
  return fn();
}

function holdBlend(good, bad, u, f, span) {
  const k = smooth(Math.min(1, u / span));
  return blend(good, bad, f * k);
}

/**
 * HBX-S12 attach starts from issued dice, not a singulated wafer.
 * HBX-100 `frame("wos")` is unchanged.
 */
export function poseSkipToWos(t) {
  const u = Math.min(1, Math.max(0, t));
  const seat = smooth(Math.min(1, u / 0.75));
  return blend(poseIssuedDie(), poseDieOnSub(0, seat), smooth(u));
}

function faultPose(step, profile, u) {
  if (step.hold === "kgd") return poseOf(step.morphIn, profile);
  if (step.hold === "overlay") return poseBonded(0.42);
  if (step.hold === "void") {
    const bad = poseOf(step.morphIn, profile);
    bad.fillet = 0.12;
    bad.voidS = 1;
    bad.balls = 0;
    bad.filletCure = 0;
    return holdBlend(poseOf(step.morphIn, profile), bad, u, 1, 0.32);
  }
  if (step.hold === "warpage") {
    const bent = poseOf(step.morphIn, profile);
    bent.sub = { ...bent.sub, warp: 1 };
    bent.stack = { ...bent.stack, y: bent.stack.y + 0.22 };
    bent.balls = 0;
    bent.trayOp = 0;
    return holdBlend(poseOf(step.morphIn, profile), bent, u, 1, 0.4);
  }
  return poseOf(step.morphIn, profile);
}

/** Pose for one operation at time t (0..1) and fault (0 good, 1 held). */
export function frame(station, t, fault = 0) {
  const step = stationById(station);
  const u = Math.min(1, Math.max(0, t));
  const f = Math.min(1, Math.max(0, fault));
  if (!step) return poseBank();
  const profile = step.profile === "substrate" || poseProfile === "substrate" ? "substrate" : "cowos";
  const enter = poseOf(step.morphIn, profile);
  const leave = poseOf(step.morphOut, profile);
  const good = step.morphIn === step.morphOut ? enter : blend(enter, leave, smooth(u));
  if (f < 0.02 || !step.hold) return good;
  return blend(good, faultPose(step, profile, u), f);
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
  const step = stationById(station);
  const kind = step?.kind || "";
  const bonding = kind === "tcb" || kind === "bonder" || kind === "wos";
  let aim;
  if (kind === "ball" || kind === "packer" || kind === "dispense" || step?.hold === "warpage") {
    aim = { x: pose.sub.x, y: 0.2, z: pose.sub.z };
  } else if (bonding || kind === "grinder" || kind === "dicer") {
    aim = worldOf(pose, pose.hbms[3]);
  } else {
    aim = worldOf(pose, pose.logic);
  }
  let lift = 0.85;
  if (step?.hold === "kgd" || (kind === "probe" && step?.morphOut === "issued" && step?.morphIn !== "issued")) {
    lift = issueLift(smooth(u) * (1 - f), f);
  } else if (kind === "tcb" && step?.morphOut === "bonded" && step?.morphIn !== "bonded") lift = bondLift(u, f);
  else if (kind === "wos") lift = wosLift(u, f);
  else if (kind === "ball") lift = ballLift(u);
  else if (kind === "inspect" || kind === "metrology" || kind === "csam" || kind === "xray") {
    lift = 0.72 + Math.sin(u * Math.PI) * 0.08;
  }
  pose.alarm = f;
  const head = { x: aim.x, y: aim.y + lift, z: aim.z };
  const thermal = kind === "oven" || kind === "plasma" || kind === "pecvd" || kind === "burnin" || kind === "mold";
  const lamp = thermal
    ? Math.sin(Math.min(1, u) * Math.PI)
    : (kind === "ate" && f < 0.5 ? smooth(Math.max(0, 1 - Math.abs(u - 0.62) / 0.12)) : 0);
  const pusher = kind === "wos" || kind === "packer" ? smooth(Math.min(1, u / 0.42)) : 0;
  const table = kind === "dicer" ? bladeCue(u).x : 0;
  const contactor = kind === "ate" ? contactorDip(u, f) : 0;
  const sweep = (kind === "inspect" || kind === "metrology" || kind === "csam" || kind === "xray" || kind === "litho")
    ? Math.sin(u * Math.PI * 2)
    : 0;
  const door = (thermal || kind === "clean" || kind === "dummy") ? Math.sin(Math.min(1, u) * Math.PI) : 0;
  const needle = kind === "dispense" ? (f > 0.5 ? 0.35 : (u > 0.2 && u < 0.75 ? smooth((u - 0.2) / 0.2) : 0)) : 0;
  const wheel = kind === "grinder" || kind === "cmp" ? (u > 0.15 && u < 0.8 ? smooth((u - 0.15) / 0.2) : 0) : 0;
  const laser = kind === "marker" ? (u > 0.25 && u < 0.8 ? 1 : 0) : 0;
  const pass = kind === "dispense" || kind === "ball" ? Math.sin(u * Math.PI * 2) : 0;
  return { pose, head, blade: bladeCue(u), lamp, pusher, table, contactor, sweep, door, needle, wheel, laser, pass };
}

export function specForMorph(morph) {
  const flow = poseProfile === "substrate" ? S12_FLOW : FLOW;
  const fallback = flow[0]?.id || "s111";
  if (morph === "bank" || !morph) return { station: fallback, t: 0, fault: 0 };
  const st = flow.find((s) => s.morphOut === morph && s.morphIn !== s.morphOut);
  if (!st) return { station: fallback, t: 0, fault: 0 };
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
