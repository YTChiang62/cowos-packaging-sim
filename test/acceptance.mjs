/**
 * Contract and morphology checks that do not need WebGL.
 * Run: node --experimental-detect-module test/acceptance.mjs
 */
import { Session } from "../js/mes.js";
import {
  HOLDS,
  MORPHS,
  STATIONS,
  assertContract,
  morphIsBlocked,
  morphRank,
} from "../js/route.js";
import { frame, motion, posesEqual } from "../js/morph.js";

let failed = 0;
function check(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", name);
  } else {
    console.log("ok  ", name);
  }
}

const contractErrors = assertContract();
check("frozen contract has no structural errors", contractErrors.length === 0);
if (contractErrors.length) console.error(contractErrors.join("\n"));

check("morph chain is bank→issued→bonded→singulated→wos→packed", MORPHS.join(",") === "bank,issued,bonded,singulated,wos,packed");

check("diebank t=0 is not yet issued", !posesEqual(frame("diebank", 0, 0), frame("diebank", 1, 0)));
check("issued dies share a plane (not a stack)", (() => {
  const p = frame("diebank", 1, 0);
  const ys = p.hbms.map((h) => h.y);
  return Math.max(...ys) - Math.min(...ys) < 0.02 && p.bond.op < 0.05 && p.logic.y < 0.35;
})());
check("KGD shortage at the hold point matches the unissued bank", posesEqual(frame("diebank", 0.42, 1), frame("diebank", 0, 0)));
check("KGD shortage is not a bonded stack", frame("diebank", 0.42, 1).bond.op < 0.05 && frame("diebank", 0.42, 1).hbms[3].y < 0.2);

check("hybrid bond starts from issued KGD", posesEqual(frame("hbond", 0, 0), frame("diebank", 1, 0)));
check("good bond ends as a stack with a bond plane", (() => {
  const p = frame("hbond", 1, 0);
  const ys = p.hbms.map((h) => h.y);
  return p.bond.op > 0.9 && p.bond.s > 0.9 && ys[3] - ys[0] > 0.2 && Math.abs(p.stack.x) < 0.02 && p.cloneOp < 0.05;
})());
check("bond offset shows misalignment and is not diced", (() => {
  const p = frame("hbond", 0.42, 1);
  return p.stack.x > 0.3 && p.bond.op > 0.8 && p.ring > 0.8 && p.frameOp < 0.05 && p.cloneOp < 0.05 && p.wafer.op > 0.8;
})());
check("bond-offset head is down on the die", motion("hbond", 0.42, 1).head.y < 0.9);

check("dice starts from the bonded wafer", posesEqual(frame("dice", 0, 0), frame("hbond", 1, 0)));
check("dice ends as separated units, wafer gone", (() => {
  const p = frame("dice", 1, 0);
  return p.cloneOp > 0.9 && p.cloneSpread > 0.9 && p.wafer.op < 0.05 && p.frameOp > 0.9 && p.tapeOp > 0.9;
})());
check("saw travels between the start and middle of the cut", motion("dice", 0.08, 0).blade.x < motion("dice", 0.32, 0).blade.x);

check("WoS starts from singulated units", posesEqual(frame("wos", 0, 0), frame("dice", 1, 0)));
check("good WoS seats the stack on a flat substrate and has no balls", (() => {
  const p = frame("wos", 1, 0);
  return p.sub.op > 0.9 && p.sub.warp < 0.05 && p.balls < 0.05 && p.trayOp < 0.05 && p.stack.y < 0.35;
})());
check("warpage shows a bent substrate, no ball array, not in a tray", (() => {
  const p = frame("wos", 0.42, 1);
  return p.sub.op > 0.8 && p.sub.warp > 0.8 && p.balls < 0.05 && p.trayOp < 0.05 && p.stack.y > 0.35;
})());

check("ball/FT/pack starts from the WoS assembly", posesEqual(frame("ballpack", 0, 0), frame("wos", 1, 0)));
check("good pack has a full ball array seated in the tray and no void", (() => {
  const p = frame("ballpack", 1, 0);
  return p.balls > 0.95 && p.trayOp > 0.95 && p.voidS < 0.05 && Math.abs(p.trayX) < 0.05;
})());
check("underfill void does not finish the bumped/packed morphology", (() => {
  const p = frame("ballpack", 0.42, 1);
  return p.balls < 0.25 && p.voidS > 0.8 && p.trayOp < 0.05;
})());

function pump(session, max = 800) {
  let n = 0;
  const pending = () => session.busy || session.awaitingTransport || !!session.hold?.waiting;
  while (pending() && n < max) {
    if (session.awaitingTransport) session.transportDone();
    else session.tick(0.2);
    n += 1;
  }
  if (n >= max) throw new Error("pump exceeded guard");
}

function walk(session, resolve) {
  const seen = [];
  let guard = 0;
  while (session.status !== "DONE" && guard < 30) {
    guard += 1;
    if (session.hold) {
      seen.push({
        hold: session.hold.id,
        morph: session.morph,
        station: session.step().id,
        blocked: session.hold.blocksMorph,
      });
      if (session.holdBlocksCurrentMorph()) throw new Error(`hold ${session.hold.id} leaked ${session.morph}`);
      const action = resolve(session.hold);
      const res = session.resolve(action);
      if (!res.ok) throw new Error(`resolve ${action} failed on ${session.hold?.id}`);
      if (session.hold?.waiting) pump(session);
      continue;
    }
    if (!session.busy) session.advance();
    pump(session);
    seen.push({ station: session.step().id, morph: session.morph, status: session.status, beat: session.beatIndex });
  }
  return seen;
}

const good = new Session({ intensity: "none", role: "MFG" });
const goodTrace = walk(good, () => {
  throw new Error("good lot should not hold");
});
check("good lot reaches packed", good.status === "DONE" && good.morph === "packed");
const goodMorphs = goodTrace.map((s) => s.morph);
check(
  "good lot commits issued, bonded, singulated, wos, then packed",
  goodMorphs.includes("issued") &&
    goodMorphs.includes("bonded") &&
    goodMorphs.includes("singulated") &&
    goodMorphs.includes("wos") &&
    good.morph === "packed"
);
check("good genealogy names the packed serial", good.genealogy().some((r) => r.key === "gen_unit" && r.value === good.lot.unit));
check("good genealogy names the bond and the substrate", (() => {
  const keys = good.genealogy().map((r) => r.key);
  return keys.includes("gen_bond") && keys.includes("gen_sub") && keys.includes("gen_ball");
})());

const many = new Session({ intensity: "many", role: "PE" });
const manyTrace = walk(many, (hold) => {
  if (hold.id === "kgd") return "wait";
  if (hold.id === "overlay") return "release";
  if (hold.id === "warpage") return "release";
  if (hold.id === "void") return "release";
  throw new Error("unexpected hold " + hold.id);
});
const fired = manyTrace.filter((s) => s.hold).map((s) => s.hold);
check("many-run fires kgd, bond offset, warpage, and underfill void", fired.join(",") === "kgd,overlay,warpage,void");
check("each hold froze on its contract station", manyTrace.filter((s) => s.hold).every((s) => HOLDS[s.hold].stationId === s.station));
check("many-run still finishes packed after the holds clear", many.status === "DONE" && many.morph === "packed");

for (const id of ["kgd", "overlay", "warpage", "void"]) {
  const session = new Session({ intensity: "many", role: "PE" });
  let guard = 0;
  while (session.hold?.id !== id && session.status !== "DONE" && guard < 40) {
    guard += 1;
    if (session.hold) {
      const action = session.hold.id === "kgd" ? "wait" : "release";
      session.resolve(action);
      pump(session);
      continue;
    }
    if (!session.busy) session.advance();
    pump(session);
  }
  check(`${id} hold is reachable`, session.hold?.id === id);
  if (session.hold?.id === id) {
    check(
      `${id} does not commit ${session.hold.blocksMorph}`,
      !morphIsBlocked(session.morph, session.hold.blocksMorph)
    );
    check(
      `${id} morph rank stays before the block`,
      morphRank(session.morph) < morphRank(session.hold.blocksMorph)
    );
  }
}

const rework = new Session({ intensity: "many", role: "MFG" });
let g2 = 0;
while ((!rework.hold || rework.hold.id !== "overlay") && g2 < 40) {
  g2 += 1;
  if (rework.hold) {
    rework.resolve("wait");
    if (rework.hold?.waiting) pump(rework);
  } else {
    if (!rework.busy) rework.advance();
    pump(rework);
  }
}
check("overlay rework setup reached the bond hold", rework.hold?.id === "overlay");
const morphAtOffset = rework.morph;
rework.resolve("rework");
check("bond-offset rework stays on HB-21 and does not dice", rework.step().id === "hbond" && rework.morph === morphAtOffset && rework.morph !== "singulated");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall acceptance checks passed");
