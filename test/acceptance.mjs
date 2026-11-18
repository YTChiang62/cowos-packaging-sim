/**
 * Contract and morphology checks that do not need WebGL.
 * Run: node --experimental-detect-module test/acceptance.mjs
 */
import { Session } from "../js/mes.js";
import {
  FLOW,
  FLOW_ID,
  HOLDS,
  LOAD_LOCAL_Z,
  MORPHS,
  RAIL_NODES,
  RECIPES,
  STOCKER,
  assertContract,
  morphIsBlocked,
  morphRank,
  opThatCommits,
  recipeById,
} from "../js/route.js";
import { frame, motion, posesEqual } from "../js/morph.js";
import {
  OVERVIEW_CAMERA,
  PERSON_RADIUS,
  PLANT_FLOOR,
  TOOL_HALF_X,
  TOOL_VISUAL_SCALE,
  TOOL_Z_MAX,
  TOOL_Z_MIN,
  WALK_SPAWN,
  WalkController,
  blockedAt,
  buildSolids,
  nextCameraMode,
  preservedLoadPort,
  stockerSolid,
  toolSolid,
  wallSolids,
} from "../js/walk.js";
import {
  DEFAULT_THEME,
  THEME_IDS,
  THEME_STORAGE_KEY,
  applyTheme,
  paletteOf,
  readThemeId,
  writeThemeId,
} from "../js/themes.js";

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

const ORDER = [
  "iqc", "diebank", "plasma", "hbond", "anneal", "overlay", "backgrind",
  "mount", "dice", "diceaoi", "subbake", "wos", "underfill", "ufcure", "warpage",
  "ball", "reflow", "fluxclean", "ftest", "mark", "pack",
];
check("flow has 21 operations in order", FLOW.map((s) => s.id).join(",") === ORDER.join(","));
check(
  "morph chain is bank→issued→bonded→thinned→singulated→wos→underfilled→balled→packed",
  MORPHS.join(",") === "bank,issued,bonded,thinned,singulated,wos,underfilled,balled,packed"
);

for (const step of FLOW) {
  const recipe = recipeById(step.recipe);
  check(
    `${step.id} has one recipe with parameters on ${step.tool}`,
    !!recipe &&
      recipe.op === step.id &&
      recipe.tool === step.tool &&
      recipe.flow === FLOW_ID &&
      recipe.params.length >= 3 &&
      recipe.params.length <= 6 &&
      recipe.params.every((p) => p.name && p.value != null && "unit" in p)
  );
}
check("recipe table matches the flow one-to-one", Object.keys(RECIPES).length === FLOW.length);

for (let i = 1; i < FLOW.length; i++) {
  const prev = FLOW[i - 1].id;
  const cur = FLOW[i].id;
  check(`${cur} starts where ${prev} ended`, posesEqual(frame(cur, 0, 0), frame(prev, 1, 0)));
}

check("diebank t=0 is not yet issued", !posesEqual(frame("diebank", 0, 0), frame("diebank", 1, 0)));
check("issued dies share a plane (not a stack)", (() => {
  const p = frame("diebank", 1, 0);
  const ys = p.hbms.map((h) => h.y);
  return Math.max(...ys) - Math.min(...ys) < 0.02 && p.bond.op < 0.05 && p.logic.y < 0.35 && p.thin < 0.05;
})());
check("KGD shortage at the hold point matches the unissued bank", posesEqual(frame("diebank", 0.42, 1), frame("diebank", 0, 0)));
check("KGD shortage is not a bonded stack", frame("diebank", 0.42, 1).bond.op < 0.05 && frame("diebank", 0.42, 1).hbms[3].y < 0.2);

check("hybrid bond starts from issued KGD", posesEqual(frame("hbond", 0, 0), frame("plasma", 1, 0)));
check("good bond ends as a stack with a bond plane", (() => {
  const p = frame("hbond", 1, 0);
  const ys = p.hbms.map((h) => h.y);
  return p.bond.op > 0.9 && p.bond.s > 0.9 && ys[3] - ys[0] > 0.2 && Math.abs(p.stack.x) < 0.02 && p.cloneOp < 0.05 && p.thin < 0.05;
})());
check("bond offset at overlay shows misalignment and is not thinned or diced", (() => {
  const p = frame("overlay", 0.42, 1);
  return p.stack.x > 0.3 && p.bond.op > 0.8 && p.ring > 0.8 && p.frameOp < 0.05 && p.cloneOp < 0.05 && p.wafer.op > 0.8 && p.thin < 0.05;
})());
check("bond-offset head is down on the die", motion("overlay", 0.42, 1).head.y < 1.15);
check("anneal brightens the bond plane and returns to a bonded pose", frame("anneal", 0.5, 0).bondGlow > 0.9 && frame("anneal", 1, 0).thin < 0.05);

check("backgrind starts bonded and ends visibly thinner", (() => {
  const a = frame("backgrind", 0, 0);
  const b = frame("backgrind", 1, 0);
  return a.thin < 0.05 && b.thin > 0.85 && b.wafer.op > 0.8 && b.cloneOp < 0.05 && b.frameOp < 0.05;
})());
check("mount keeps the thinned wafer and adds a frame", frame("mount", 1, 0).thin > 0.8 && frame("mount", 1, 0).frameOp > 0.9 && frame("mount", 1, 0).cloneOp < 0.05);

check("dice starts from the mounted wafer", posesEqual(frame("dice", 0, 0), frame("mount", 1, 0)));
check("dice ends as separated units, wafer gone", (() => {
  const p = frame("dice", 1, 0);
  return p.cloneOp > 0.9 && p.cloneSpread > 0.9 && p.wafer.op < 0.05 && p.frameOp > 0.9 && p.tapeOp > 0.9 && p.thin > 0.8;
})());
check("saw travels between the start and middle of the cut", motion("dice", 0.08, 0).blade.x < motion("dice", 0.32, 0).blade.x);

check("WoS starts from singulated units", posesEqual(frame("wos", 0, 0), frame("subbake", 1, 0)));
check("good WoS seats the stack on a flat substrate and has no balls", (() => {
  const p = frame("wos", 1, 0);
  return p.sub.op > 0.9 && p.sub.warp < 0.05 && p.balls < 0.05 && p.trayOp < 0.05 && p.fillet < 0.05 && p.stack.y < 0.35;
})());
check("underfill void does not finish the fillet or later morphs", (() => {
  const p = frame("underfill", 0.42, 1);
  return p.voidS > 0.8 && p.fillet < 0.35 && p.balls < 0.05 && p.trayOp < 0.05 && p.filletCure < 0.05;
})());
check("cure commits a filled fillet", frame("ufcure", 1, 0).fillet > 0.95 && frame("ufcure", 1, 0).filletCure > 0.95 && frame("ufcure", 1, 0).balls < 0.05);
check("warpage shows a bent substrate, no ball array, not in a tray", (() => {
  const p = frame("warpage", 0.42, 1);
  return p.sub.op > 0.8 && p.sub.warp > 0.8 && p.balls < 0.05 && p.trayOp < 0.05 && p.fillet > 0.8 && p.stack.y > 0.35;
})());
check("ball attach grows balls and does not pack the tray", (() => {
  const p = frame("ball", 1, 0);
  return p.balls > 0.95 && p.trayOp < 0.05 && p.mark < 0.05;
})());
check("laser mark is readable by the end of mark", frame("mark", 1, 0).mark > 0.9 && frame("mark", 0, 0).mark < 0.05);
check("good pack has a full ball array seated in the tray and no void", (() => {
  const p = frame("pack", 1, 0);
  return p.balls > 0.95 && p.trayOp > 0.95 && p.voidS < 0.05 && Math.abs(p.trayX) < 0.05 && p.mark > 0.9;
})());

check("issued commits at diebank", opThatCommits("issued").id === "diebank");
check("thinned commits at backgrind", opThatCommits("thinned").id === "backgrind");
check("underfilled commits at cure", opThatCommits("underfilled").id === "ufcure");
check("balled commits at ball attach", opThatCommits("balled").id === "ball");

function pump(session, max = 20000) {
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
  while (session.status !== "DONE" && guard < 80) {
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

function runUntil(session, pred, guardMax = 80) {
  let guard = 0;
  while (!pred(session) && session.status !== "DONE" && guard < guardMax) {
    guard += 1;
    if (session.hold) {
      const action = session.hold.id === "kgd" ? "wait" : "release";
      session.resolve(action);
      if (session.hold?.waiting) pump(session);
      continue;
    }
    if (!session.busy) session.advance();
    pump(session);
  }
}

const seq = new Session({ intensity: "none" });
for (const step of FLOW) {
  runUntil(seq, (s) => s.step().id === step.id && s.beatIndex === 0 && !s.busy && !s.hold);
  check(
    `${step.id} is entered at ${step.morphIn} and not past it`,
    seq.morph === step.morphIn && morphRank(seq.morph) <= morphRank(step.morphOut)
  );
}
check("a clear lot is still inside the flow when the last op is queued", seq.step().id === "pack" && seq.morph === "balled");

const good = new Session({ intensity: "none", role: "MFG" });
const goodTrace = walk(good, () => {
  throw new Error("good lot should not hold");
});
check("good lot reaches packed", good.status === "DONE" && good.morph === "packed");
const goodMorphs = goodTrace.map((s) => s.morph);
check(
  "good lot commits issued, bonded, thinned, singulated, wos, underfilled, balled, then packed",
  ["issued", "bonded", "thinned", "singulated", "wos", "underfilled", "balled"].every((m) => goodMorphs.includes(m)) &&
    good.morph === "packed"
);
check("good genealogy names the packed serial", good.genealogy().some((r) => r.key === "gen_unit" && r.value === good.lot.unit));
check("good genealogy names the bond and the substrate", (() => {
  const keys = good.genealogy().map((r) => r.key);
  return keys.includes("gen_bond") && keys.includes("gen_sub") && keys.includes("gen_ball") && keys.includes("gen_uf");
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
check("many-run fires kgd, bond offset, underfill void, then warpage", fired.join(",") === "kgd,overlay,void,warpage");
check("each hold froze on its contract operation", manyTrace.filter((s) => s.hold).every((s) => HOLDS[s.hold].stationId === s.station));
check("many-run still finishes packed after the holds clear", many.status === "DONE" && many.morph === "packed");

for (const id of ["kgd", "overlay", "void", "warpage"]) {
  const session = new Session({ intensity: "many", role: "PE" });
  let guard = 0;
  while (session.hold?.id !== id && session.status !== "DONE" && guard < 80) {
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
    const nextTool = { overlay: "BG-24", void: "CUR-06", warpage: "BGA-51" }[id];
    if (nextTool) {
      const carrier = session.facility.wh.get(session.facility.lotCarrierId);
      const moved = session.facility.requestMove({ carrierId: carrier.id, to: nextTool });
      check(
        `${id} blocks delivery to the next process tool`,
        moved.ok === false && moved.reason === "hold_blocks_delivery" && carrier.status === "locked"
      );
    }
  }
}

const rework = new Session({ intensity: "many", role: "MFG" });
let g2 = 0;
while ((!rework.hold || rework.hold.id !== "overlay") && g2 < 80) {
  g2 += 1;
  if (rework.hold) {
    rework.resolve("wait");
    if (rework.hold?.waiting) pump(rework);
  } else {
    if (!rework.busy) rework.advance();
    pump(rework);
  }
}
check("overlay rework setup reached the bond-offset hold", rework.hold?.id === "overlay" && rework.morph === "bonded");
rework.resolve("rework");
check(
  "bond-offset rework returns to HB-21 and does not thin or dice",
  rework.step().id === "hbond" &&
    rework.step().tool === "HB-21" &&
    rework.morph !== "singulated" &&
    rework.morph !== "thinned" &&
    morphRank(rework.morph) < morphRank("thinned")
);

const voidRework = new Session({ intensity: "many", role: "PE" });
runUntil(voidRework, (s) => s.hold?.id === "void");
check("void hold is on underfill", voidRework.hold?.id === "void" && voidRework.step().id === "underfill");
const morphAtVoid = voidRework.morph;
voidRework.resolve("rework");
check(
  "underfill rework stays on UF-05 and does not commit the cured fillet",
  voidRework.step().id === "underfill" && voidRework.step().tool === "UF-05" && voidRework.morph === morphAtVoid && voidRework.morph !== "underfilled"
);

const warpRework = new Session({ intensity: "many", role: "PE" });
runUntil(warpRework, (s) => s.hold?.id === "warpage");
check("warpage hold is on MET-07", warpRework.hold?.id === "warpage" && warpRework.step().tool === "MET-07");
warpRework.resolve("rework");
check("warpage rework returns to WoS", warpRework.step().id === "wos" && warpRework.morph !== "balled");

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

const beforeBake = new Session({ intensity: "none" });
runUntil(beforeBake, (s) => s.step().id === "subbake" && s.beatIndex === 0 && !s.busy);
check(
  "substrate magazines stay in SUB until subbake",
  beforeBake.facility.wh.carriers
    .filter((c) => c.sku === "substrate")
    .every((c) => c.status === "stock" && String(c.location).startsWith("bin:SUB"))
);
check(
  "incoming did not issue a substrate",
  !beforeBake.facility.wh.log.some((e) => e.zone === "SUB" && (e.kind === "issue" || e.kind === "reserve"))
);

const short = new Session({ intensity: "many", role: "EE" });
{
  let guard = 0;
  while (!short.hold && short.status !== "DONE" && guard < 20) {
    guard += 1;
    if (!short.busy) short.advance();
    pump(short);
  }
}
check("KGD shortage hold opens from the warehouse at diebank", short.hold?.id === "kgd" && short.step().id === "diebank" && short.morph === "bank");
check(
  "DBK issue is refused while every KGD tray is locked or empty",
  short.facility.wh.log.some((e) => e.kind === "refuse" && e.reason === "kgd_shortage") &&
    short.facility.wh.carriers.filter((c) => c.zone === "DBK").every((c) => c.status === "locked" || c.qty <= 0)
);
check(
  "the crane does not claim a KGD tray that was never issued",
  short.facility.amhs.vehicles.every((v) => {
    const carried = v.carrying ? short.facility.wh.get(v.carrying) : null;
    return !carried || carried.sku !== "kgd";
  }) &&
    short.facility.wh.carriers.filter((c) => c.sku === "kgd" || c.zone === "DBK").every((c) => c.status !== "transit") &&
    short.facility.amhs.vehicles.every((v) => v.state === "idle" && !v.carrying)
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
  while ((manual.busy || manual.awaitingTransport || manual.facility.amhs.vehicles.some((v) => v.state !== "idle")) && n < 8000) {
    manual.tick(0.25);
    n += 1;
  }
}
if (!manual.busy && !manual.hold) manual.advance();
{
  let n = 0;
  while (manual.facility.amhs.queue.length === 0 && n < 2000) {
    manual.tick(0.25);
    n += 1;
  }
}
check(
  "manual mode does not auto-dispatch the next move",
  manual.facility.mode === "MANUAL" &&
    manual.facility.amhs.queue.length > 0 &&
    manual.facility.amhs.vehicles.every((v) => v.state === "idle" && !v.carrying)
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
  dock.awaitingTransport && dock.morph === "bank" && dock.processProgress === 0 && !dock.facility.readyForProcess("iqc")
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
  dock.facility.readyForProcess("iqc") && dock.morph === "bank" && dock.processProgress === 0 && dock.beatIndex >= 2
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
runUntil(blocked, (s) => s.hold?.id === "overlay");
const heldCarrier = blocked.facility.wh.get(blocked.facility.lotCarrierId);
check(
  "overlay hold is holding the lot carrier at MET-23",
  blocked.hold?.id === "overlay" && String(heldCarrier.location).endsWith("MET-23") && heldCarrier.status === "locked"
);
const toGrind = blocked.facility.requestMove({ carrierId: heldCarrier.id, to: "BG-24" });
check("an open hold refuses delivery to backgrind", toGrind.ok === false && toGrind.reason === "hold_blocks_delivery");
check("the refused hold move left the carrier locked at MET-23", heldCarrier.location.endsWith("MET-23") && heldCarrier.status === "locked");
const sentHome = blocked.facility.returnToStock(heldCarrier.id);
check("the same hold allows a return to the warehouse", sentHome.ok === true);
{
  let n = 0;
  while (!String(heldCarrier.location).startsWith("bin:INT") && n < 4000) {
    blocked.tick(0.25);
    if (String(heldCarrier.location).includes("BG-24") || String(heldCarrier.location).includes("DIC-81")) {
      throw new Error("hold delivered onward");
    }
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

const walker = new WalkController();
const entered = walker.enter();
check(
  "walk mode can be entered",
  walker.active === true && walker.camera.mode === "walk" && walker.camera.controls === false && walker.camera.follow === false
);
check(
  "the trainee starts on a walkable aisle",
  entered.x === WALK_SPAWN.x &&
    entered.z === WALK_SPAWN.z &&
    !walker.blocked(entered.x, entered.z) &&
    entered.x < -40 &&
    entered.z > 1
);
const along = walker.step({ forward: 1, strafe: 0, sprint: false, yaw: walker.yaw, dt: 0.35 });
check("a clear aisle step is accepted", along.moved === true && !walker.blocked(walker.x, walker.z));

const bonder = toolSolid(FLOW.find((s) => s.tool === "HB-21").place, "HB-21");
walker.x = (bonder.minX + bonder.maxX) / 2;
walker.z = bonder.maxZ + PERSON_RADIUS + 0.08;
check("the approach in front of the bonder is open", !walker.blocked(walker.x, walker.z));
const intoTool = walker.tryMove(0, -(PERSON_RADIUS + 0.55));
check(
  "movement into a tool body is blocked",
  intoTool.blocked === true && walker.z > bonder.maxZ && !blockedAt(walker.x, walker.z, walker.solids)
);
const beforeSlide = walker.x;
const slide = walker.tryMove(0.85, -(PERSON_RADIUS + 0.55));
check(
  "the trainee slides along the tool instead of entering it",
  slide.moved === true && walker.x !== beforeSlide && walker.z > bonder.maxZ && !walker.blocked(walker.x, walker.z)
);

const stock = stockerSolid();
walker.x = stock.maxX + PERSON_RADIUS + 0.12;
walker.z = 0;
const intoStock = walker.tryMove(-(PERSON_RADIUS + 0.7), 0);
check(
  "movement into the stocker is blocked",
  intoStock.blocked === true && walker.x > stock.maxX && !walker.blocked(walker.x, walker.z)
);
const south = wallSolids().find((wall) => wall.id === "wall-s");
walker.x = 4;
walker.z = south.minZ - PERSON_RADIUS - 0.12;
const intoWall = walker.tryMove(0, PERSON_RADIUS + 0.8);
check(
  "movement into the outer wall is blocked",
  intoWall.blocked === true && walker.z < south.minZ && !walker.blocked(walker.x, walker.z)
);

walker.x = bonder.ax;
walker.z = bonder.maxZ + PERSON_RADIUS + 0.25;
check("proximity inspect selects the hybrid bonder", walker.updateInspect() === "HB-21");
walker.x = stock.maxX + PERSON_RADIUS + 0.2;
walker.z = stock.az;
check("proximity inspect selects the stocker I/O", walker.updateInspect() === "stocker");

const fromFollow = nextCameraMode({ mode: "follow-lot", follow: "lot", controls: false }, "enter-walk");
check("entering walk turns follow off and disables orbit", fromFollow.mode === "walk" && fromFollow.follow === false && fromFollow.controls === false);
const restored = nextCameraMode(fromFollow, "exit-walk");
check(
  "leaving walk restores overview and enables orbit controls",
  restored.mode === "overview" && restored.controls === true && restored.follow === false
);
const left = walker.exit();
check("walk mode can be exited", walker.active === false && left.mode === "overview" && left.controls === true);

const sim = new Session({ intensity: "none" });
sim.setAuto(true);
walker.enter();
let craneMoved = false;
for (let i = 0; i < 40; i++) {
  sim.tick(0.25);
  walker.step({ forward: 1, strafe: 0, sprint: false, yaw: walker.yaw, dt: 0.25 });
  if (sim.facility.amhs.vehicles.some((v) => v.state !== "idle")) craneMoved = true;
}
check(
  "walk mode does not pause auto or the crane",
  sim.auto === true && sim.facility.mode === "AUTO" && craneMoved && walker.active === true
);

check("theme ids are light, neutral, and dark", THEME_IDS.join(",") === "light,neutral,dark");
check("the default scene theme is light", DEFAULT_THEME === "light");
check("an empty store resolves to the light theme", readThemeId(memStore()) === "light");
check("a missing store resolves to the light theme", readThemeId(null) === "light");
check("a stored dark id is kept", readThemeId(memStore({ [THEME_STORAGE_KEY]: "dark" })) === "dark");
check("an unknown stored id falls back to light", readThemeId(memStore({ [THEME_STORAGE_KEY]: "purple" })) === "light");

const themeStore = memStore();
check("writing a theme id persists it", writeThemeId("neutral", themeStore) === "neutral" && themeStore.getItem(THEME_STORAGE_KEY) === "neutral");

function fakeColor(hex = 0) {
  return { hex, setHex(v) { this.hex = v; } };
}
const themeTool = {
  group: { position: { x: -18, y: 0, z: -17.15 } },
  workLight: { color: fakeColor(), intensity: 0, distance: 0 },
  label: { userData: { plate: null, setPlate(p) { this.plate = p; } } },
};
const themePlant = {
  themeId: null,
  palette: null,
  renderer: { clear: null, toneMappingExposure: 0, setClearColor(c) { this.clear = c; } },
  scene: { fog: { color: fakeColor(), near: 0, far: 0 } },
  lights: {
    hemi: { color: fakeColor(), groundColor: fakeColor(), intensity: 0 },
    sun: { color: fakeColor(), intensity: 0 },
    fill: { color: fakeColor(), intensity: 0 },
    rim: { color: fakeColor(), intensity: 0 },
    stocker: { color: fakeColor(), intensity: 0, distance: 0 },
  },
  skirt: { material: { color: fakeColor() } },
  wallMat: { color: fakeColor(), opacity: 1 },
  bayGlass: { color: fakeColor(), opacity: 1 },
  bayFrame: { color: fakeColor() },
  bayPlinths: ["incoming", "cow", "dice", "wos", "pack"].map((id) => ({ id, material: { color: fakeColor() } })),
  floorPaint: null,
  repaintFloor(palette) { this.floorPaint = palette.floor.base; },
  tools: new Map([["HB-21", themeTool]]),
};

const placeSnap = JSON.stringify(FLOW.map((s) => [s.tool, s.id, s.recipe, s.place.x, s.place.z, s.place.face]));
const recipeSnap = JSON.stringify(Object.keys(RECIPES));
applyTheme(themePlant, "light", themeStore);
check("applyTheme selects light and stores it", themePlant.themeId === "light" && themeStore.getItem(THEME_STORAGE_KEY) === "light");
check("applyTheme writes the light clear color and exposure", themePlant.renderer.clear === themePlant.palette.clear && themePlant.renderer.toneMappingExposure === themePlant.palette.exposure);
check("applyTheme writes fog and the floor base", themePlant.scene.fog.color.hex === themePlant.palette.fog && themePlant.scene.fog.near === themePlant.palette.fogNear && themePlant.floorPaint === themePlant.palette.floor.base);
check("applyTheme writes hemisphere intensity and bay tint", themePlant.lights.hemi.intensity === themePlant.palette.hemi.intensity && themePlant.bayPlinths[0].material.color.hex === themePlant.palette.bays.incoming);
check("applyTheme writes wall opacity and the work light", themePlant.wallMat.opacity === themePlant.palette.wall.opacity && themeTool.workLight.intensity === themePlant.palette.work.intensity && themeTool.label.userData.plate === themePlant.palette.label);
check("applyTheme does not move a tool group", themeTool.group.position.x === -18 && themeTool.group.position.z === -17.15);

applyTheme(themePlant, "neutral");
check("neutral theme updates the palette id", themePlant.themeId === "neutral" && themePlant.palette.clear === paletteOf("neutral").clear && themePlant.renderer.clear === paletteOf("neutral").clear);
check("neutral floor is neither the light nor the dark base", themePlant.floorPaint === "#c5ced3");

applyTheme(themePlant, "nope", themeStore);
check("an unknown theme id falls back to light and is stored", themePlant.themeId === "light" && themeStore.getItem(THEME_STORAGE_KEY) === "light");

applyTheme(themePlant, "dark");
const dark = paletteOf("dark");
check(
  "dark theme keeps the v5 clear, fog, and exposure",
  dark.clear === 0x071016 && dark.fog === 0x071016 && dark.fogNear === 140 && dark.fogFar === 280 && dark.exposure === 1.32 && themePlant.renderer.clear === 0x071016
);
check("dark theme keeps the v5 floor and skirt", dark.floor.base === "#1c2e34" && dark.skirt === 0x141c20 && themePlant.skirt.material.color.hex === 0x141c20 && themePlant.floorPaint === "#1c2e34");
check("dark theme keeps the v5 wall opacity", dark.wall.opacity === 0.07 && themePlant.wallMat.opacity === 0.07);
check(
  "dark theme keeps the v5 lights",
  dark.hemi.sky === 0xd5eef2 && dark.hemi.ground === 0x24180e && dark.hemi.intensity === 1.25 &&
  dark.sun.color === 0xf2e6d0 && dark.sun.intensity === 1.35 &&
  dark.fill.color === 0x4aa89c && dark.fill.intensity === 0.35 &&
  dark.rim.color === 0x9fd4ff && dark.rim.intensity === 0.22 &&
  dark.stocker.color === 0xf0c08a && dark.stocker.intensity === 14 &&
  themePlant.lights.sun.intensity === 1.35 && themePlant.lights.stocker.intensity === 14
);
check(
  "dark theme keeps the v5 bay tints",
  dark.bays.incoming === 0x3a2a1c && dark.bays.cow === 0x102824 && dark.bays.dice === 0x1a1a30 && dark.bays.wos === 0x2a2214 && dark.bays.pack === 0x262018 &&
  themePlant.bayPlinths.every((entry) => entry.material.color.hex === dark.bays[entry.id])
);

check("switching theme does not move tools or change the flow", JSON.stringify(FLOW.map((s) => [s.tool, s.id, s.recipe, s.place.x, s.place.z, s.place.face])) === placeSnap);
check("switching theme does not change recipe ids", JSON.stringify(Object.keys(RECIPES)) === recipeSnap);

const footprint = buildSolids().filter((solid) => solid.kind === "tool");
check("equipment footprints are still the 21 tool solids", footprint.length === 21);
check(
  "tool solids use the enlarged shared footprint",
  TOOL_VISUAL_SCALE >= 1.4 &&
  TOOL_VISUAL_SCALE <= 1.65 &&
  TOOL_HALF_X * TOOL_VISUAL_SCALE * 2 < 4.7 &&
  FLOW.every((step) => {
    const solid = toolSolid(step.place, step.tool);
    const half = TOOL_HALF_X * TOOL_VISUAL_SCALE;
    const depth = (TOOL_Z_MAX - TOOL_Z_MIN) * TOOL_VISUAL_SCALE;
    return (
      Math.abs(solid.minX - (step.place.x - half)) < 1e-9 &&
      Math.abs(solid.maxX - (step.place.x + half)) < 1e-9 &&
      Math.abs((solid.maxZ - solid.minZ) - depth) < 1e-9 &&
      solid.id === step.tool
    );
  })
);
check(
  "scaled tools keep their load ports on the rail nodes",
  FLOW.every((step) => {
    const port = preservedLoadPort(step.place);
    const rail = RAIL_NODES.find((node) => node.id === step.tool);
    const unscaledZ = step.place.z + (step.place.face >= 0 ? 1 : -1) * LOAD_LOCAL_Z;
    return rail && Math.abs(port.x - rail.x) < 1e-6 && Math.abs(port.z - rail.z) < 1e-6 && Math.abs(port.z - unscaledZ) < 1e-6;
  })
);
{
  let overlap = false;
  for (let i = 0; i < footprint.length; i++) {
    for (let j = i + 1; j < footprint.length; j++) {
      const a = footprint[i];
      const b = footprint[j];
      if (a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ) overlap = true;
    }
  }
  check("enlarged tool solids do not overlap each other", overlap === false);
}
{
  const solids = buildSolids();
  let aisleClear = true;
  for (let x = -44; x <= 40; x += 2) {
    if (blockedAt(x, 0, solids) || blockedAt(x, 2.2, solids) || blockedAt(x, -2.2, solids)) aisleClear = false;
  }
  check("the main aisle stays walkable after the tool scale", aisleClear && !blockedAt(WALK_SPAWN.x, WALK_SPAWN.z, solids));
}
check(
  "the cleanroom slab is shorter than the old 80 m apron and still covers the stocker",
  (PLANT_FLOOR.maxZ - PLANT_FLOOR.minZ) < 70 &&
  PLANT_FLOOR.minX < STOCKER.place.x - 3 &&
  PLANT_FLOOR.maxX > 42 &&
  PLANT_FLOOR.minZ < -24 &&
  PLANT_FLOOR.maxZ > 24
);

function projectOverview(point, aspect) {
  const pos = OVERVIEW_CAMERA.position;
  const target = OVERVIEW_CAMERA.target;
  const fx = target[0] - pos[0];
  const fy = target[1] - pos[1];
  const fz = target[2] - pos[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  const forward = [fx / fl, fy / fl, fz / fl];
  const up = [0, 1, 0];
  const rx = forward[1] * up[2] - forward[2] * up[1];
  const ry = forward[2] * up[0] - forward[0] * up[2];
  const rz = forward[0] * up[1] - forward[1] * up[0];
  const rl = Math.hypot(rx, ry, rz) || 1;
  const right = [rx / rl, ry / rl, rz / rl];
  const ux = right[1] * forward[2] - right[2] * forward[1];
  const uy = right[2] * forward[0] - right[0] * forward[2];
  const uz = right[0] * forward[1] - right[1] * forward[0];
  const vx = point[0] - pos[0];
  const vy = point[1] - pos[1];
  const vz = point[2] - pos[2];
  const z = vx * forward[0] + vy * forward[1] + vz * forward[2];
  const tan = Math.tan((OVERVIEW_CAMERA.fov * Math.PI) / 360);
  const ndcX = ((vx * right[0] + vy * right[1] + vz * right[2]) / z) / (tan * aspect);
  const ndcY = ((vx * ux + vy * uy + vz * uz) / z) / tan;
  return { z, ndcX, ndcY };
}
{
  const aspects = [1.6, 16 / 9];
  const marks = [
    ...FLOW.map((step) => [step.place.x, 2, step.place.z]),
    [STOCKER.place.x, 3, STOCKER.place.z],
    [PLANT_FLOOR.minX, 0, PLANT_FLOOR.minZ],
    [PLANT_FLOOR.maxX, 0, PLANT_FLOOR.minZ],
    [PLANT_FLOOR.minX, 0, PLANT_FLOOR.maxZ],
    [PLANT_FLOOR.maxX, 0, PLANT_FLOOR.maxZ],
  ];
  const framed = aspects.every((aspect) => marks.every((point) => {
    const p = projectOverview(point, aspect);
    return p.z > 1 && Math.abs(p.ndcX) < 0.98 && Math.abs(p.ndcY) < 0.98;
  }));
  check("the default overview frames the stocker, every tool, and the cleanroom slab", framed);
}

function channel(hex, shift) {
  return (hex >> shift) & 255;
}
function luminance(hex) {
  const r = channel(hex, 16) / 255;
  const g = channel(hex, 8) / 255;
  const b = channel(hex, 0) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const OLD_LIGHT_CLEAR = 0xd7e2e8;
const OLD_LIGHT_FLOOR = 0xe7eef2;
const lightPalette = paletteOf("light");
const lightFloor = parseInt(lightPalette.floor.base.slice(1), 16);
check(
  "the default light clear is near white and brighter than the old gray",
  lightPalette.clear !== OLD_LIGHT_CLEAR &&
  luminance(lightPalette.clear) > luminance(OLD_LIGHT_CLEAR) + 0.06 &&
  channel(lightPalette.clear, 16) >= 0xf0 &&
  channel(lightPalette.clear, 8) >= 0xf0 &&
  channel(lightPalette.clear, 0) >= 0xf0 &&
  Math.abs(channel(lightPalette.clear, 0) - channel(lightPalette.clear, 16)) <= 12
);
check(
  "the default light floor is whiter than the old cool gray slab",
  lightPalette.floor.base !== "#e7eef2" &&
  luminance(lightFloor) > luminance(OLD_LIGHT_FLOOR) &&
  channel(lightFloor, 16) >= 0xf2 &&
  channel(lightFloor, 0) <= channel(lightFloor, 8) + 2
);
check(
  "the default light fog is lighter and starts farther out",
  lightPalette.fogNear > 200 &&
  lightPalette.fogFar > lightPalette.fogNear + 150 &&
  luminance(lightPalette.fog) > luminance(OLD_LIGHT_CLEAR) + 0.05
);
check("the default light exposure is brighter than the old 1.0", lightPalette.exposure > 1.05 && lightPalette.exposure < 1.4);
const themeWalk = new WalkController();
const themeEntered = themeWalk.enter();
check(
  "theme switching leaves walk enter and the aisle spawn intact",
  themeWalk.active === true && themeEntered.x === WALK_SPAWN.x && themeEntered.z === WALK_SPAWN.z && !themeWalk.blocked(themeEntered.x, themeEntered.z)
);
const themeLeft = themeWalk.exit();
check("theme switching leaves walk exit intact", themeWalk.active === false && themeLeft.mode === "overview" && themeLeft.controls === true);

function memStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
  };
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall acceptance checks passed");
