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

function pump(session, max = 8000) {
  let n = 0;
  const pending = () => session.busy || session.awaitingTransport || !!session.hold?.waiting;
  while (pending() && n < max) {
    session.tick(0.25);
    const drifted = session.facility?.agreementErrors?.() || [];
    if (drifted.length) throw new Error(`inventory drifted from crane: ${drifted.join(",")}`);
    n += 1;
  }
  if (n >= max) {
    const step = session.step?.();
    throw new Error(`pump exceeded guard @ ${step?.id} beat ${session.beatIndex} status ${session.status}`);
  }
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

const packedTray = good.facility.wh.get(good.facility.lotCarrierId);
check(
  "finished tray is put away in FG",
  packedTray?.sku === "finished" && packedTray.status === "stock" && String(packedTray.location).startsWith("bin:FG")
);
check(
  "warehouse log records an issue and a putaway",
  good.facility.wh.log.some((e) => e.kind === "issue") && good.facility.wh.log.some((e) => e.kind === "putaway")
);
check("good-lot inventory still agrees with the crane", good.facility.agreementErrors().length === 0);

const beforeWos = new Session({ intensity: "none" });
{
  let n = 0;
  while (!(beforeWos.step().id === "hbond" && beforeWos.beatIndex === 0 && !beforeWos.busy) && n < 8000) {
    if (!beforeWos.busy && !beforeWos.hold) beforeWos.advance();
    beforeWos.tick(0.25);
    n += 1;
  }
}
check(
  "substrate magazines stay in SUB until WoS",
  beforeWos.facility.wh.carriers
    .filter((c) => c.sku === "substrate")
    .every((c) => c.status === "stock" && String(c.location).startsWith("bin:SUB"))
);

const short = new Session({ intensity: "many", role: "EE" });
short.advance();
{
  let n = 0;
  while (!short.hold && n < 500) {
    short.tick(0.25);
    n += 1;
  }
}
check("KGD shortage hold opens from the warehouse", short.hold?.id === "kgd" && short.morph === "bank");
check(
  "DBK issue is refused while every KGD tray is locked or empty",
  short.facility.wh.log.some((e) => e.kind === "refuse" && e.reason === "kgd_shortage") &&
    short.facility.wh.carriers.filter((c) => c.zone === "DBK").every((c) => c.status === "locked" || c.qty <= 0)
);
check(
  "the crane does not claim a carrier that was never issued",
  short.facility.amhs.claimCount === 0 &&
    short.facility.amhs.vehicles.every((v) => v.state === "idle" && !v.carrying) &&
    short.facility.wh.carriers.every((c) => c.status !== "transit")
);
check("die bank cannot process without that issue", !short.facility.readyForProcess("diebank"));
const claimsBefore = short.facility.amhs.claimCount;
short.resolve("wait");
pump(short);
check("replenished KGD is actually picked up", short.facility.amhs.claimCount > claimsBefore);

const manual = new Session({ intensity: "none" });
manual.facility.setMode("MANUAL");
manual.advance();
{
  let n = 0;
  while (manual.facility.amhs.queue.length === 0 && n < 800) {
    manual.tick(0.25);
    n += 1;
  }
}
check(
  "manual mode queues the move and leaves both vehicles idle",
  manual.facility.mode === "MANUAL" &&
    manual.facility.amhs.queue.length > 0 &&
    manual.facility.amhs.vehicles.every((v) => v.state === "idle" && !v.carrying)
);
check("a manual call assigns a vehicle", manual.facility.dispatchQueued().ok === true);
manual.tick(0.25);
check(
  "the called vehicle is on the way to the pickup",
  manual.facility.amhs.vehicles.some((v) => v.state === "goto_pick" || v.state === "hoist_pick")
);
{
  let n = 0;
  while (manual.facility.amhs.vehicles.some((v) => v.state !== "idle") && n < 4000) {
    manual.tick(0.25);
    n += 1;
  }
}
check(
  "manual mode does not auto-dispatch the next move",
  manual.facility.amhs.vehicles.every((v) => v.state === "idle" && !v.carrying) &&
    (manual.facility.amhs.queue.length > 0 || manual.facility.moves.some((m) => m.phase === "retrieve" || m.phase === "queued"))
);

const paused = new Session({ intensity: "none" });
paused.facility.setMode("PAUSE");
paused.advance();
{
  let n = 0;
  while (n < 800) {
    paused.tick(0.25);
    n += 1;
    if (paused.facility.moves.length) break;
  }
  for (let i = 0; i < 40; i++) paused.tick(0.25);
}
check(
  "pause freezes new crane assignments",
  paused.facility.mode === "PAUSE" &&
    paused.facility.amhs.claimCount === 0 &&
    paused.facility.amhs.vehicles.every((v) => v.state === "idle" && !v.carrying)
);
paused.facility.setMode("AUTO");
{
  let n = 0;
  while (paused.facility.amhs.vehicles.every((v) => v.state === "idle") && n < 2000) {
    paused.tick(0.25);
    n += 1;
  }
}
check("AUTO resumes and assigns an idle vehicle", paused.facility.amhs.vehicles.some((v) => v.state !== "idle"));

const live = new Session({ intensity: "none" });
live.advance();
{
  let n = 0;
  while (!live.facility.amhs.vehicles.some((v) => v.state === "hoist_pick") && n < 4000) {
    if (!live.busy && !live.awaitingTransport && !live.hold) live.advance();
    live.tick(0.1);
    n += 1;
  }
}
check("a vehicle enters the pickup hoist", live.facility.amhs.vehicles.some((v) => v.history.includes("hoist_pick")));
live.facility.setMode("PAUSE");
{
  let n = 0;
  while (live.facility.amhs.vehicles.some((v) => v.state === "hoist_pick" || v.state === "hoist_drop") && n < 800) {
    live.tick(0.1);
    n += 1;
  }
}
check(
  "pause lets the current hoist finish, then holds the vehicle",
  live.facility.amhs.vehicles.some((v) => v.state === "paused" && v.history.includes("hoist_pick"))
);
check(
  "that vehicle does not travel on to a drop after the hoist is paused",
  live.facility.amhs.vehicles.filter((v) => v.history.includes("hoist_pick")).every((v) => {
    const at = v.history.lastIndexOf("hoist_pick");
    return !v.history.slice(at + 1).includes("travel");
  })
);

const dock = new Session({ intensity: "none" });
dock.advance();
{
  let n = 0;
  while (!dock.awaitingTransport && n < 400) {
    dock.tick(0.25);
    n += 1;
  }
}
check(
  "process has not started while the carrier is still en route",
  dock.awaitingTransport && dock.morph === "bank" && dock.processProgress === 0 && !dock.facility.readyForProcess("diebank")
);
{
  let n = 0;
  let sawTransit = false;
  while (dock.awaitingTransport && n < 4000) {
    dock.tick(0.25);
    const drift = dock.facility.agreementErrors();
    if (drift.length) throw new Error(`dock agreement ${drift.join(",")}`);
    if (dock.morph !== "bank") throw new Error("morph changed before dock");
    if (dock.facility.amhs.vehicles.some((v) => v.carrying)) sawTransit = true;
    n += 1;
  }
  check("the issued carrier rides the crane before the hand-off", sawTransit);
}
check(
  "the tool is ready only after the hand-off, and the morph is still unissued",
  dock.facility.readyForProcess("diebank") && dock.morph === "bank" && dock.processProgress === 0 && dock.beatIndex >= 2
);

const mismatch = new Session({ intensity: "none" });
const spare = mismatch.facility.wh.get("INT-B2");
const spareLoc = spare.location;
const refused = mismatch.facility.requestMove({ carrierId: spare.id, to: "DIC-81" });
check("a FOUP is refused at the FRAME port", refused.ok === false && refused.reason === "type_mismatch");
check(
  "the refused carrier stays in its bin and no vehicle claims it",
  spare.location === spareLoc &&
    spare.status === "stock" &&
    mismatch.facility.amhs.claimCount === 0 &&
    mismatch.facility.amhs.vehicles.every((v) => v.state === "idle" && !v.carrying)
);
check(
  "the refusal is in the warehouse log",
  mismatch.facility.wh.log.some((e) => e.kind === "refuse" && e.reason === "type_mismatch" && e.carrierId === "INT-B2")
);

const blocked = new Session({ intensity: "many", role: "PE" });
{
  let guard = 0;
  while (blocked.hold?.id !== "overlay" && blocked.status !== "DONE" && guard < 40) {
    guard += 1;
    if (blocked.hold) {
      blocked.resolve(blocked.hold.id === "kgd" ? "wait" : "release");
      if (blocked.hold?.waiting) pump(blocked);
    } else {
      if (!blocked.busy) blocked.advance();
      pump(blocked);
    }
  }
}
const heldCarrier = blocked.facility.wh.get(blocked.facility.lotCarrierId);
check("overlay hold is holding the lot carrier at HB-21", blocked.hold?.id === "overlay" && String(heldCarrier.location).endsWith("HB-21") && heldCarrier.status === "locked");
const toOther = blocked.facility.requestMove({ carrierId: heldCarrier.id, to: "DBK-02" });
check("an open hold refuses delivery to another process tool", toOther.ok === false && toOther.reason === "hold_blocks_delivery");
check("the refused hold move left the carrier locked at HB-21", heldCarrier.location.endsWith("HB-21") && heldCarrier.status === "locked");
const sentHome = blocked.facility.returnToStock(heldCarrier.id);
check("the same hold allows a return to the warehouse", sentHome.ok === true);
{
  let n = 0;
  while (!String(heldCarrier.location).startsWith("bin:INT") && n < 4000) {
    blocked.tick(0.25);
    if (String(heldCarrier.location).includes("DIC")) throw new Error("hold delivered to dice");
    n += 1;
  }
}
check(
  "returned carrier is stored in INT and was not delivered onward",
  String(heldCarrier.location).startsWith("bin:INT") &&
    heldCarrier.status === "stock" &&
    blocked.facility.wh.log.some((e) => e.kind === "return" && e.carrierId === heldCarrier.id)
);

const divert = new Session({ intensity: "none" });
const called = divert.facility.requestMove({ carrierId: "INT-B2", to: "HB-21" });
check("a matching FOUP call to the bonder is accepted", called.ok === true);
{
  let n = 0;
  while (!divert.facility.amhs.vehicles.some((v) => v.carrying === "INT-B2" && v.state === "travel") && n < 4000) {
    divert.tick(0.2);
    n += 1;
  }
}
check("that FOUP is in transit on a vehicle", divert.facility.wh.get("INT-B2").status === "transit");
divert.facility.onHold("diebank");
{
  let n = 0;
  while (!String(divert.facility.wh.get("INT-B2").location).startsWith("bin:") && n < 4000) {
    divert.tick(0.25);
    const loc = divert.facility.wh.get("INT-B2").location;
    if (loc === "tool:HB-21" || loc === "port:HB-21") throw new Error(`docked despite hold: ${loc}`);
    n += 1;
  }
}
check(
  "an in-flight move to another tool returns to the warehouse",
  String(divert.facility.wh.get("INT-B2").location).startsWith("bin:INT")
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall acceptance checks passed");
