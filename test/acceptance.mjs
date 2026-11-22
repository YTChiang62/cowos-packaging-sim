/**
 * Contract and morphology checks that do not need WebGL.
 * Run: node --experimental-detect-module test/acceptance.mjs
 */
import { readFileSync } from "node:fs";
import { BEATS, Session } from "../js/mes.js";
import {
  DOCK_REQUIREMENTS,
  FLOW,
  FLOW_ID,
  HOLDS,
  OUTPUT_PRESENT,
  PORTS,
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
import { frame, motion, poseSkipToWos, posesEqual } from "../js/morph.js";
import {
  FACILITY_ROOMS,
  OVERVIEW_CAMERA,
  PERSON_RADIUS,
  PLANT_FLOOR,
  PLANT_WALLS,
  RETURN_AIR,
  ROOM_WALL_T,
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
import { productById } from "../js/catalog.js";
import {
  HUD_PANELS,
  HUD_STORAGE_KEY,
  applyPreset,
  defaultHudState,
  dragStartsOnChrome,
  hidePanel,
  movePanel,
  presetCamera,
  readHud,
  showPanel,
  toggleFocus,
  writeHud,
} from "../js/hud.js";
import { orderLots, orderMoves } from "../js/dispatch.js";
import { EQ_STATES, Equipment, eqBlocksStart } from "../js/equip.js";
import { buildKpi, buildKpiFromSession, shiftTarget } from "../js/kpi.js";
import { V13_COPY_KEYS } from "../js/v13-i18n.js";
import { buildYield, isFinalTest } from "../js/yield.js";
import { afterActionFigures, buildAfterAction, scenariosForProduct } from "../js/scenario.js";
import { V11_COPY_KEYS } from "../js/v11-i18n.js";
import { hasOwnCopy, t } from "../js/i18n.js";
import {
  LOAD_THRESHOLD,
  OPS_COPY_KEYS,
  OPS_LAYER_STORAGE_KEY,
  QUEUE_THRESHOLD,
  SEVERITY,
  buildCompanions,
  buildOpsSnapshot,
  defaultLayers,
  presentChip,
  readLayers,
  selectCompanion,
  visibleChips,
  writeLayers,
} from "../js/ops.js";
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

check("HBX-100 is 5 modules, 18 stages, and 86 steps", FLOW.length === 86 && new Set(FLOW.map((s) => s.module)).size === 5 && new Set(FLOW.map((s) => s.stage)).size === 18);
check(
  "every numbered template step is on the flow and three compound lines are split",
  FLOW_ID === "HBX-100-COWOS-S" &&
    ["1.1.1", "1.4.2", "1.4.3", "1.4.8", "2.1.3", "3.2.4", "3.2.7", "4.1.2", "4.2.3", "5.1.1", "5.3.5"].every((code) => FLOW.some((s) => s.code === code)) &&
    FLOW.filter((s) => s.code === "1.4.2").length === 2 &&
    FLOW.filter((s) => s.code === "1.4.3").length === 2 &&
    FLOW.filter((s) => s.code === "1.4.8").length === 2
);
check(
  "morph chain follows the template boundaries",
  MORPHS.join(",") === "bank,bumped,issued,bonded,cowfill,os,underfilled,balled,molded,marked,packed"
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

check("KGD issue starts bumped and ends with dice on one plane", (() => {
  const start = frame("s213", 0, 0);
  const done = frame("s213", 1, 0);
  const ys = done.hbms.map((h) => h.y);
  return start.dieOp < 0.05 && done.dieOp > 0.9 && done.wafer.op > 0.8 && Math.max(...ys) - Math.min(...ys) < 0.02;
})());
check("KGD shortage stays on the bumped interposer", posesEqual(frame("s213", 0.42, 1), frame("s213", 0, 0)) && frame("s213", 0.42, 1).dieOp < 0.05);

check("TCB starts from issued KGD", posesEqual(frame("s324", 0, 0), frame("s323", 1, 0)));
check("good TCB ends as a stack with a bond plane", (() => {
  const p = frame("s324", 1, 0);
  const ys = p.hbms.map((h) => h.y);
  return p.bond.op > 0.9 && p.bond.s > 0.9 && ys[3] - ys[0] > 0.2 && Math.abs(p.stack.x) < 0.02 && p.sub.op < 0.05;
})());
check("bond offset at shift metrology shows misalignment and does not underfill", (() => {
  const p = frame("s327", 0.42, 1);
  return p.stack.x > 0.3 && p.bond.op > 0.8 && p.ring > 0.8 && p.sub.op < 0.05 && p.fillet < 0.05 && p.wafer.op > 0.8;
})());
check("bond-offset head is down on the die", motion("s327", 0.42, 1).head.y < 1.15);
check("bump height commits a bumped interposer before KGD issue", frame("s149", 1, 0).dieOp < 0.05 && frame("s149", 1, 0).bond.op > 0.8 && frame("s149", 0, 0).bond.op < 0.05);

check("CoW underfill void does not finish the fillet", (() => {
  const p = frame("s332", 0.42, 1);
  return p.voidS > 0.8 && p.fillet < 0.35 && p.sub.op < 0.05 && p.balls < 0.05;
})());
check("CoW cure shows a fillet before the substrate appears", frame("s334", 1, 0).fillet > 0.6 && frame("s334", 1, 0).sub.op < 0.05);
check("attach seats the reconstructed wafer on a flat substrate", (() => {
  const p = frame("s412", 1, 0);
  return p.sub.op > 0.9 && p.sub.warp < 0.05 && p.balls < 0.05 && p.wafer.op > 0.5;
})());
check("second cure commits a filled fillet without balls", frame("s422", 1, 0).fillet > 0.95 && frame("s422", 1, 0).filletCure > 0.95 && frame("s422", 1, 0).balls < 0.05);
check("warpage shows a bent substrate and no ball array", (() => {
  const p = frame("s423", 0.42, 1);
  return p.sub.op > 0.8 && p.sub.warp > 0.8 && p.balls < 0.05 && p.fillet > 0.8;
})());
check("ball attach grows balls and does not pack the tray", (() => {
  const p = frame("s431", 1, 0);
  return p.balls > 0.95 && p.trayOp < 0.05 && p.mark < 0.05 && p.mold < 0.05;
})());
check("mold then laser mark changes the stack", frame("s511", 1, 0).mold > 0.9 && frame("s513", 0, 0).mark < 0.05 && frame("s513", 1, 0).mark > 0.9);
check("tape and reel seats the marked unit", (() => {
  const p = frame("s534", 1, 0);
  return p.balls > 0.95 && p.trayOp > 0.95 && p.mark > 0.9 && p.mold > 0.9;
})());
check("the dicer head still travels for KGD singulation", motion("s224", 0.08, 0).blade.x < motion("s224", 0.32, 0).blade.x);

check("bumped commits at bump metrology", opThatCommits("bumped").id === "s149");
check("issued commits at KGD issue", opThatCommits("issued").id === "s213");
check("bonded commits at TCB", opThatCommits("bonded").id === "s324");
check("cowfill commits at the CoW cure", opThatCommits("cowfill").id === "s334");
check("os commits at wafer attach", opThatCommits("os").id === "s412");
check("underfilled commits at the second cure", opThatCommits("underfilled").id === "s422");
check("balled commits at ball attach", opThatCommits("balled").id === "s431");
check("molded commits at compression mold", opThatCommits("molded").id === "s511");
check("marked commits at laser mark", opThatCommits("marked").id === "s513");
check("packed commits at tape and reel", opThatCommits("packed").id === "s534");

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
  while (session.status !== "DONE" && guard < 400) {
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

function runUntil(session, pred, guardMax = 400) {
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
check("a clear lot is still inside the flow when the last op is queued", seq.step().id === "s535" && seq.morph === "packed");

const good = new Session({ intensity: "none", role: "MFG" });
const goodTrace = walk(good, () => {
  throw new Error("good lot should not hold");
});
check("good lot reaches packed", good.status === "DONE" && good.morph === "packed");
const goodMorphs = goodTrace.map((s) => s.morph);
check(
  "good lot commits the template morph boundaries",
  ["bumped", "issued", "bonded", "cowfill", "os", "underfilled", "balled", "molded", "marked"].every((m) => goodMorphs.includes(m)) &&
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
  while (session.hold?.id !== id && session.status !== "DONE" && guard < 400) {
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
    const nextTool = { overlay: "FUR-33", void: "FUR-33", warpage: "BGA-45" }[id];
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
while ((!rework.hold || rework.hold.id !== "overlay") && g2 < 400) {
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
  "bond-offset rework returns to TCB and does not underfill",
  rework.step().id === "s324" &&
    rework.step().tool === "TCB-32" &&
    morphRank(rework.morph) < morphRank("cowfill")
);

const voidRework = new Session({ intensity: "many", role: "PE" });
runUntil(voidRework, (s) => s.hold?.id === "void");
check("void hold is on capillary underfill", voidRework.hold?.id === "void" && voidRework.step().id === "s332");
const morphAtVoid = voidRework.morph;
voidRework.resolve("rework");
check(
  "underfill rework stays on the dispense tool and does not commit the cure",
  voidRework.step().id === "s332" && voidRework.step().tool === "FLX-31" && voidRework.morph === morphAtVoid && voidRework.morph !== "cowfill"
);

const warpRework = new Session({ intensity: "many", role: "PE" });
runUntil(warpRework, (s) => s.hold?.id === "warpage");
check("warpage hold is on MET-43", warpRework.hold?.id === "warpage" && warpRework.step().tool === "MET-43");
warpRework.resolve("rework");
check("warpage rework returns to attach", warpRework.step().id === "s412" && warpRework.morph !== "balled");

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
runUntil(beforeBake, (s) => s.step().id === "s231" && s.beatIndex === 0 && !s.busy);
check(
  "substrate magazines stay in SUB until substrate IQC",
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
  while (!short.hold && short.status !== "DONE" && guard < 80) {
    guard += 1;
    if (!short.busy) short.advance();
    pump(short);
  }
}
check("KGD shortage hold opens from the warehouse at probe issue", short.hold?.id === "kgd" && short.step().id === "s213" && short.morph === "bumped");
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
check("probe cannot process without that issue", !short.facility.readyForProcess("s213"));
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
  dock.awaitingTransport && dock.morph === "bank" && dock.processProgress === 0 && !dock.facility.readyForProcess("s111")
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
  dock.facility.readyForProcess("s111") && dock.morph === "bank" && dock.processProgress === 0 && dock.beatIndex >= 2
);

const mismatch = new Session({ intensity: "none" });
const spare = mismatch.facility.wh.get("INT-B2");
const spareLoc = spare.location;
const refused = mismatch.facility.requestMove({ carrierId: spare.id, to: "BAK-26" });
check("a FOUP is refused at the substrate bake port", refused.ok === false && refused.reason === "type_mismatch");
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
  "overlay hold is holding the lot carrier at MET-34",
  blocked.hold?.id === "overlay" && String(heldCarrier.location).endsWith("MET-34") && heldCarrier.status === "locked"
);
const toGrind = blocked.facility.requestMove({ carrierId: heldCarrier.id, to: "FUR-33" });
check("an open hold refuses delivery to the reflow oven", toGrind.ok === false && toGrind.reason === "hold_blocks_delivery");
check("the refused hold move left the carrier locked at MET-34", heldCarrier.location.endsWith("MET-34") && heldCarrier.status === "locked");
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
const called = divert.facility.requestMove({ carrierId: "INT-B2", to: "TCB-32" });
check("a matching FOUP call to the bonder is accepted", called.ok === true);
{
  let n = 0;
  while (!divert.facility.amhs.vehicles.some((v) => v.carrying === "INT-B2" && v.state === "travel") && n < 4000) {
    divert.tick(0.2);
    n += 1;
  }
}
check("that FOUP is in transit on a vehicle", divert.facility.wh.get("INT-B2").status === "transit");
divert.facility.onHold("s213");
{
  let n = 0;
  while (!String(divert.facility.wh.get("INT-B2").location).startsWith("bin:") && n < 4000) {
    divert.tick(0.25);
    const loc = divert.facility.wh.get("INT-B2").location;
    if (loc === "tool:TCB-32" || loc === "port:TCB-32") throw new Error(`docked despite hold: ${loc}`);
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

const bonder = toolSolid(FLOW.find((s) => s.tool === "TCB-32").place, "TCB-32");
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
walker.z = bonder.az + (bonder.az > 0 ? -1 : 1) * (PERSON_RADIUS + 0.35);
check("proximity inspect selects the TCB bonder", walker.updateInspect() === "TCB-32");
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
  bayPlinths: ["m1", "m2", "m3", "m4", "m5"].map((id) => ({ id, material: { color: fakeColor() } })),
  floorPaint: null,
  repaintFloor(palette) { this.floorPaint = palette.floor.base; },
  tools: new Map([["TCB-32", themeTool]]),
};

const placeSnap = JSON.stringify(FLOW.map((s) => [s.tool, s.id, s.recipe, s.place.x, s.place.z, s.place.face]));
const recipeSnap = JSON.stringify(Object.keys(RECIPES));
applyTheme(themePlant, "light", themeStore);
check("applyTheme selects light and stores it", themePlant.themeId === "light" && themeStore.getItem(THEME_STORAGE_KEY) === "light");
check("applyTheme writes the light clear color and exposure", themePlant.renderer.clear === themePlant.palette.clear && themePlant.renderer.toneMappingExposure === themePlant.palette.exposure);
check("applyTheme writes fog and the floor base", themePlant.scene.fog.color.hex === themePlant.palette.fog && themePlant.scene.fog.near === themePlant.palette.fogNear && themePlant.floorPaint === themePlant.palette.floor.base);
check("applyTheme writes hemisphere intensity and bay tint", themePlant.lights.hemi.intensity === themePlant.palette.hemi.intensity && themePlant.bayPlinths[0].material.color.hex === themePlant.palette.bays.m1);
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
  dark.bays.m1 === 0x3a2a1c && dark.bays.m2 === 0x102824 && dark.bays.m3 === 0x1a1a30 && dark.bays.m4 === 0x2a2214 && dark.bays.m5 === 0x262018 &&
  themePlant.bayPlinths.every((entry) => entry.material.color.hex === dark.bays[entry.id])
);

check("switching theme does not move tools or change the flow", JSON.stringify(FLOW.map((s) => [s.tool, s.id, s.recipe, s.place.x, s.place.z, s.place.face])) === placeSnap);
check("switching theme does not change recipe ids", JSON.stringify(Object.keys(RECIPES)) === recipeSnap);

const footprint = buildSolids().filter((solid) => solid.kind === "tool");
check("equipment footprints are the shared tool solids", footprint.length === 34);
check("tool visual scale stays 1.55", TOOL_VISUAL_SCALE === 1.55);
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

check(
  "crane labels stay 自動派車 / 手動叫車 / 暫停",
  t("zh-TW", "modeAuto") === "自動派車" &&
    t("zh-TW", "modeManual") === "手動叫車" &&
    t("zh-TW", "modePause") === "暫停" &&
    t("zh-CN", "modeAuto") === "自动派车" &&
    t("zh-CN", "modeManual") === "手动叫车" &&
    t("zh-CN", "modePause") === "暂停" &&
    t("en", "modeAuto") === "Auto dispatch" &&
    t("en", "modeManual") === "Manual call" &&
    t("en", "modePause") === "Pause"
);
check(
  "facility room labels exist in zh-TW, zh-CN, and English",
  t("zh-TW", "room_ahu") === "空調機房" &&
    t("zh-TW", "room_return") === "回風夾道" &&
    t("zh-TW", "room_gowning") === "更衣室" &&
    t("zh-TW", "room_duty") === "值班室" &&
    t("zh-CN", "room_ahu") === "空调机房" &&
    t("zh-CN", "room_return") === "回风夹道" &&
    t("zh-CN", "room_gowning") === "更衣室" &&
    t("zh-CN", "room_duty") === "值班室" &&
    t("en", "room_ahu") === "AHU" &&
    t("en", "room_return") === "Return air" &&
    t("en", "room_gowning") === "Gowning" &&
    t("en", "room_duty") === "Duty room"
);

function rectCovers(outer, inner) {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minZ >= outer.minZ && inner.maxZ <= outer.maxZ;
}
function rectsOverlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}
const wallRect = {
  minX: PLANT_WALLS.west,
  maxX: PLANT_WALLS.east,
  minZ: PLANT_WALLS.north,
  maxZ: PLANT_WALLS.south,
};
check("the floor slab contains the glass envelope", rectCovers(PLANT_FLOOR, wallRect));
check(
  "the envelope contains the stocker and every tool",
  wallRect.minX < STOCKER.place.x - 3 &&
    wallRect.maxX > 42 &&
    FLOW.every((step) => step.place.x > wallRect.minX && step.place.x < wallRect.maxX && step.place.z > wallRect.minZ && step.place.z < wallRect.maxZ)
);
{
  let roomsInside = true;
  let hitsProcess = false;
  const equipment = buildSolids().filter((solid) => solid.kind === "tool" || solid.kind === "stocker");
  for (const room of [...FACILITY_ROOMS, ...RETURN_AIR]) {
    if (!rectCovers(wallRect, room) || !rectCovers(PLANT_FLOOR, room)) roomsInside = false;
    for (const solid of equipment) {
      if (rectsOverlap(room, solid)) hitsProcess = true;
    }
  }
  check("return-air bands and perimeter rooms sit inside the cleanroom", roomsInside);
  check("return-air bands and perimeter rooms do not overlap tools or the stocker", hitsProcess === false);
}
check(
  "new rooms do not cover a rail node",
  RAIL_NODES.every((node) => ![...FACILITY_ROOMS, ...RETURN_AIR].some((room) =>
    node.x > room.minX && node.x < room.maxX && node.z > room.minZ && node.z < room.maxZ
  ))
);
{
  const shell = buildSolids();
  const stock = stockerSolid();
  const spawnClear = !blockedAt(WALK_SPAWN.x, WALK_SPAWN.z, shell) && WALK_SPAWN.x > stock.maxX;
  const inRoom = [...FACILITY_ROOMS, ...RETURN_AIR].some((room) =>
    WALK_SPAWN.x > room.minX && WALK_SPAWN.x < room.maxX && WALK_SPAWN.z > room.minZ && WALK_SPAWN.z < room.maxZ
  );
  check("the aisle spawn stays east of the stocker and outside the new rooms", spawnClear && inRoom === false);
  let aisleClear = true;
  for (let x = -44; x <= 40; x += 2) {
    if (blockedAt(x, 0, shell) || blockedAt(x, 2.2, shell) || blockedAt(x, -2.2, shell)) aisleClear = false;
  }
  check("the main aisle stays walkable after the new envelope", aisleClear);
  let closed = true;
  for (const room of FACILITY_ROOMS) {
    if (room.kind !== "ahu" && room.kind !== "duty") continue;
    const cx = (room.minX + room.maxX) / 2;
    const cz = (room.minZ + room.maxZ) / 2;
    if (!blockedAt(cx, cz, shell)) closed = false;
  }
  for (const band of RETURN_AIR) {
    const cx = (band.minX + band.maxX) / 2;
    const cz = (band.minZ + band.maxZ) / 2;
    if (!blockedAt(cx, cz, shell)) closed = false;
  }
  check("AHU rooms, the duty room, and the return-air bands are not walk-through", closed);
}
{
  const gown = FACILITY_ROOMS.find((room) => room.id === "gowning");
  const visitor = new WalkController();
  const gz = (gown.minZ + gown.maxZ) / 2;
  visitor.x = gown.maxX + PERSON_RADIUS + 0.15;
  visitor.z = gz;
  const approachOpen = !visitor.blocked(visitor.x, visitor.z);
  const into = visitor.tryMove(-(PERSON_RADIUS + 1.2), 0);
  const inside = into.moved === true && visitor.x < gown.maxX - ROOM_WALL_T && !visitor.blocked(visitor.x, visitor.z);
  const out = visitor.tryMove(2.4, 0);
  check(
    "gowning can be entered from the aisle and left through the same door",
    approachOpen && inside && out.moved === true && visitor.x > gown.maxX && !visitor.blocked(visitor.x, visitor.z)
  );
  const ahu = FACILITY_ROOMS.find((room) => room.id === "ahu-w");
  visitor.x = ahu.maxX + PERSON_RADIUS + 0.2;
  visitor.z = (ahu.minZ + ahu.maxZ) / 2;
  const before = visitor.x;
  const intoAhu = visitor.tryMove(-(PERSON_RADIUS + 0.9), 0);
  check(
    "the trainee cannot enter an AHU room",
    !visitor.blocked(before, visitor.z) && intoAhu.blocked === true && visitor.x > ahu.maxX && visitor.x === before
  );
  const northBand = RETURN_AIR.find((band) => band.id === "return-n");
  visitor.x = 0;
  visitor.z = northBand.maxZ + PERSON_RADIUS + 0.2;
  const beforeZ = visitor.z;
  const intoAir = visitor.tryMove(0, -(PERSON_RADIUS + 0.9));
  check(
    "the trainee cannot walk into a return-air corridor",
    !visitor.blocked(visitor.x, beforeZ) && intoAir.blocked === true && visitor.z > northBand.maxZ
  );
}
{
  const aspects = [1.6, 16 / 9];
  const parks = [
    { x: -36.75, z: -18, w: 16, d: 12 },
    { x: -12, z: -18, w: 32, d: 12 },
    { x: -34, z: 18, w: 18, d: 12 },
    { x: -8, z: 18, w: 32, d: 12 },
    { x: 24.5, z: 18, w: 32, d: 12 },
  ];
  const marks = [
    ...parks.flatMap((bay) => [
      [bay.x, 0.4, bay.z],
      [bay.x - bay.w / 2, 4.6, bay.z - bay.d / 2],
      [bay.x + bay.w / 2, 4.6, bay.z + bay.d / 2],
    ]),
    ...[...FACILITY_ROOMS, ...RETURN_AIR].flatMap((room) => [
      [(room.minX + room.maxX) / 2, 0.4, (room.minZ + room.maxZ) / 2],
      [room.minX, 4.2, room.minZ],
      [room.maxX, 4.2, room.maxZ],
    ]),
  ];
  const framed = aspects.every((aspect) => marks.every((point) => {
    const p = projectOverview(point, aspect);
    return p.z > 1 && Math.abs(p.ndcX) < 0.98 && Math.abs(p.ndcY) < 0.98;
  }));
  check("the default overview frames the five parks and the perimeter rooms", framed);
}
{
  const lightBays = paletteOf("light").bays;
  const ids = ["m1", "m2", "m3", "m4", "m5"];
  const chroma = (hex) => {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  };
  check(
    "light process parks are five distinct color blocks",
    new Set(ids.map((id) => lightBays[id])).size === 5 && ids.every((id) => chroma(lightBays[id]) > 0.28)
  );
}

function memStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
  };
}

check(
  "route and recipes carry the template instead of a frozen hash",
  FLOW.length === 86 && Object.keys(RECIPES).length === 86
);

check(
  "default ops layers are load, alarm, and queue",
  defaultLayers().load === true &&
    defaultLayers().alarm === true &&
    defaultLayers().queue === true &&
    defaultLayers().current === false
);
{
  const store = memStore();
  const saved = writeLayers({ load: false, alarm: true, queue: false, current: true, extra: true }, store);
  const read = readLayers(store);
  check(
    "ops layer selection persists",
    saved.load === false && saved.current === true && read.alarm === true && read.queue === false && store.getItem(OPS_LAYER_STORAGE_KEY)
  );
  check("a broken ops layer payload falls back to the default", readLayers(memStore({ [OPS_LAYER_STORAGE_KEY]: "nope" })).load === true);
  check("a missing ops layer store uses the default", readLayers(null).queue === true && readLayers(null).current === false);
}

const quiet = buildOpsSnapshot({
  intensity: "none",
  stepIndex: 0,
  status: "QUEUE",
  busy: false,
  craneMode: "AUTO",
  kgdShortage: false,
  elapsed: 0,
});
check(
  "an ops snapshot covers five parks and the shared tools",
  quiet.bays.length === 5 && quiet.tools.length === 34 && quiet.chips.length === 39
);
{
  const rooms = new Set([...FACILITY_ROOMS, ...RETURN_AIR].map((room) => room.id));
  check("facility rooms and return air do not get process chips", quiet.chips.every((chip) => !rooms.has(chip.id)));
}
check(
  "utilization and queue depth are integers in range",
  quiet.tools.every((tool) => Number.isInteger(tool.util) && tool.util >= 0 && tool.util <= 100 && Number.isInteger(tool.queue) && tool.queue >= 0)
);

const same = buildOpsSnapshot({ intensity: "few", stepIndex: 0, kgdShortage: true, elapsed: 0.4 });
const later = buildOpsSnapshot({ intensity: "few", stepIndex: 0, kgdShortage: true, elapsed: 7 });
const early = buildOpsSnapshot({ intensity: "few", stepIndex: 0, kgdShortage: true, elapsed: 0 });
check("the same time bucket does not move the snapshot", JSON.stringify(early.tools) === JSON.stringify(same.tools));
check("a later time bucket can nudge utilization", early.tools.some((tool, i) => tool.util !== later.tools[i].util));
check("a later bucket keeps the same queues", early.tools.every((tool, i) => tool.queue === later.tools[i].queue));

const kgd = new Session({ intensity: "few" });
const kgdSnap = buildOpsSnapshot(kgd);
const dbk = kgdSnap.tools.find((tool) => tool.id === "PRB-22");
const prep = kgdSnap.bays.find((bay) => bay.id === "m2");
check(
  "a KGD shortage is a material queue at the probe and prep park",
  dbk.material === true && dbk.queue >= QUEUE_THRESHOLD && prep.queueSum >= dbk.queue && prep.id === "m2"
);
check("a KGD shortage does not alarm an unrelated tool", kgdSnap.tools.every((tool) => tool.alarm === false));
check(
  "a KGD shortage is the bottleneck and names the probe",
  kgdSnap.bottleneck.kind === "material" &&
    kgdSnap.bottleneck.tool === "PRB-22" &&
    kgdSnap.bottleneck.adviceKey === "opsAdvice_kgd" &&
    kgdSnap.bottleneck.severity === SEVERITY.queue
);

const pausedLine = new Session({ intensity: "none" });
pausedLine.facility.setMode("PAUSE");
const pauseSnap = buildOpsSnapshot(pausedLine);
check(
  "crane pause is the bottleneck when nothing else is hotter",
  pauseSnap.bottleneck.kind === "pause" &&
    pauseSnap.bottleneck.adviceKey === "opsAdvice_pause" &&
    pauseSnap.bottleneck.severity === SEVERITY.pause &&
    pauseSnap.craneMode === "PAUSE"
);
check("crane pause does not invent a process-tool alarm", pauseSnap.tools.every((tool) => tool.alarm === false) && pauseSnap.bays.every((bay) => bay.alarmCount === 0));

const longQueue = buildOpsSnapshot({
  intensity: "many",
  stepIndex: 0,
  status: "QUEUE",
  busy: false,
  craneMode: "AUTO",
  kgdShortage: false,
  elapsed: 0,
});
const hbond = longQueue.tools.find((tool) => tool.id === "TCB-32");
const otherQueues = longQueue.tools.filter((tool) => tool.id !== "TCB-32").map((tool) => tool.queue);
check(
  "the longest queue is TCB",
  hbond.queue >= QUEUE_THRESHOLD &&
    hbond.queue > Math.max(...otherQueues) &&
    longQueue.bottleneck.kind === "queue" &&
    longQueue.bottleneck.tool === "TCB-32" &&
    longQueue.bottleneck.adviceKey === "opsAdvice_queue_tcb"
);
const queuePaused = buildOpsSnapshot({
  intensity: "many",
  stepIndex: 0,
  craneMode: "PAUSE",
  kgdShortage: false,
  elapsed: 0,
});
check("the longest queue outranks crane pause", queuePaused.bottleneck.kind === "queue" && queuePaused.bottleneck.severity > SEVERITY.pause);

const heldQueue = buildOpsSnapshot({
  intensity: "many",
  stepIndex: 0,
  status: "HOLD",
  hold: { id: "overlay", stationId: "s327" },
  craneMode: "AUTO",
  kgdShortage: false,
  elapsed: 0,
});
const met23 = heldQueue.tools.find((tool) => tool.id === "MET-34");
const cowBay = heldQueue.bays.find((bay) => bay.id === "m3");
check(
  "an open hold outranks a longer queue",
  heldQueue.tools.find((tool) => tool.id === "TCB-32").queue > met23.queue &&
    heldQueue.bottleneck.kind === "hold" &&
    heldQueue.bottleneck.tool === "MET-34" &&
    heldQueue.bottleneck.adviceKey === "opsAdvice_hold_overlay" &&
    heldQueue.bottleneck.severity === SEVERITY.hold
);
check(
  "an open hold alarms that tool and its bay only",
  met23.alarm === true &&
    met23.alarmReason === "overlay" &&
    cowBay.alarmCount === 1 &&
    heldQueue.tools.every((tool) => tool.alarm === (tool.id === "MET-34"))
);
check(
  "overlay advice names the metrology tool",
  t("zh-TW", heldQueue.bottleneck.adviceKey, { tool: heldQueue.bottleneck.tool }).includes("MET-34") &&
    t("en", heldQueue.bottleneck.adviceKey, { tool: "MET-34" }).includes("MET-34")
);

const hot = buildOpsSnapshot({
  intensity: "none",
  stepIndex: 3,
  stepId: "hbond",
  tool: "TCB-32",
  status: "RUN",
  busy: true,
  dockedTool: "TCB-32",
  craneMode: "PAUSE",
  kgdShortage: false,
  elapsed: 0,
});
const hotTool = hot.tools.find((tool) => tool.id === "TCB-32");
const hotBay = hot.bays.find((bay) => bay.id === "m3");
check(
  "a busy hero tool is elevated and outranks crane pause",
  hotTool.busy === true &&
    hotTool.util >= 90 &&
    hotTool.util >= LOAD_THRESHOLD &&
    hotBay.load >= 60 &&
    hot.bays.every((bay) => bay.id === "m3" || bay.load < hotBay.load) &&
    hot.bottleneck.kind === "load" &&
    hot.bottleneck.tool === "TCB-32"
);

function catchProcess(session, stepId) {
  const processBeat = BEATS.indexOf("process");
  let guard = 0;
  while (guard < 400000) {
    guard += 1;
    if (session.status === "DONE") return false;
    if (session.hold) {
      const action = session.hold.id === "kgd" ? "wait" : "release";
      const res = session.resolve(action);
      if (!res.ok) return false;
      if (session.hold?.waiting) pump(session);
      continue;
    }
    if (session.step().id === stepId && session.busy && session.beatIndex === processBeat && session.processProgress > 0.05) {
      return true;
    }
    if (!session.busy && !session.awaitingTransport) session.advance();
    session.tick(0.05);
  }
  return false;
}

const liveHero = new Session({ intensity: "none" });
check("the hero lot can be caught on the bonder", catchProcess(liveHero, "s324") === true);
const liveSnap = buildOpsSnapshot(liveHero);
const liveTool = liveSnap.tools.find((tool) => tool.id === liveHero.step().tool);
const liveBay = liveSnap.bays.find((bay) => bay.id === liveTool.bay);
check(
  "the tool processing the hero lot is busy and its bay load is elevated",
  liveHero.step().tool === "TCB-32" &&
    liveTool.busy === true &&
    liveTool.util >= 85 &&
    liveBay.load >= 60 &&
    liveSnap.bays.every((bay) => bay.id === liveBay.id || bay.load < liveBay.load)
);

const warp = new Session({ intensity: "many", role: "PE" });
runUntil(warp, (s) => s.hold?.id === "warpage");
const warpSnap = buildOpsSnapshot(warp);
const warpTool = warpSnap.tools.find((tool) => tool.id === "MET-43");
const warpBay = warpSnap.bays.find((bay) => bay.id === "m4");
check(
  "a warpage hold alarms MET-43 and the oS park",
  warp.hold?.id === "warpage" &&
    warpTool.alarm === true &&
    warpTool.alarmReason === "warpage" &&
    warpBay.alarmCount === 1 &&
    warpSnap.bottleneck.kind === "hold" &&
    warpSnap.bottleneck.tool === "MET-43" &&
    warpSnap.bottleneck.adviceKey === "opsAdvice_hold_warpage"
);
check("the warpage hold does not alarm a different tool", warpSnap.tools.every((tool) => tool.alarm === (tool.id === "MET-43")));
check("clearing the warpage hold removes that alarm", warp.resolve("release").ok === true && warp.hold == null);
const cleared = buildOpsSnapshot(warp);
check(
  "the cleared hold is gone from the tool and the bay",
  cleared.tools.every((tool) => tool.alarm === false) && cleared.bays.every((bay) => bay.alarmCount === 0) && cleared.holdId == null
);

const loadOnly = { load: true, alarm: false, queue: false, current: false };
const alarmOnly = { load: false, alarm: true, queue: false, current: false };
const queueOnly = { load: false, alarm: false, queue: true, current: false };
const currentOnly = { load: false, alarm: false, queue: false, current: true };
const diceChip = longQueue.chips.find((chip) => chip.id === "UF-42");
const markChip = longQueue.chips.find((chip) => chip.id === "MRK-53");
const incomingChip = longQueue.chips.find((chip) => chip.kind === "bay" && chip.id === "m1");
const hbondChip = longQueue.chips.find((chip) => chip.id === "TCB-32");
check("the load layer keeps every park chip", visibleChips(longQueue, loadOnly).filter((chip) => chip.kind === "bay").length === 5);
check("the load layer hides an idle tool that only has a short queue", presentChip(diceChip, loadOnly).visible === false && diceChip.queue > 0 && diceChip.loadVisible === false);
check("the load layer still shows a busy tool", presentChip(hbondChip, loadOnly).visible === true && presentChip(hbondChip, loadOnly).load === true && presentChip(hbondChip, loadOnly).queue === false);
check("the queue layer shows the long queue and hides an empty one", presentChip(hbondChip, queueOnly).visible === true && presentChip(hbondChip, queueOnly).queue === true && presentChip(markChip, queueOnly).visible === false);
check("the alarm layer hides a park with no alarm", presentChip(incomingChip, alarmOnly).visible === false);
const alarmChips = visibleChips(heldQueue, alarmOnly);
check(
  "the alarm layer shows only the held tool and its park",
  alarmChips.length === 2 &&
    alarmChips.some((chip) => chip.id === "MET-34") &&
    alarmChips.some((chip) => chip.kind === "bay" && chip.id === "m3")
);
const heroChip = quiet.chips.find((chip) => chip.id === "MET-11");
check("the current layer shows the hero tool without turning the others on", presentChip(heroChip, currentOnly).visible === true && presentChip(heroChip, currentOnly).current === true && presentChip(markChip, currentOnly).visible === false);

for (const lang of ["zh-TW", "zh-CN", "en"]) {
  for (const key of OPS_COPY_KEYS) {
    check(`${lang} has ops copy ${key}`, hasOwnCopy(lang, key));
  }
}
check(
  "zh-TW crane labels stay 自動派車 / 手動叫車 / 暫停",
  t("zh-TW", "modeAuto") === "自動派車" && t("zh-TW", "modeManual") === "手動叫車" && t("zh-TW", "modePause") === "暫停"
);
check(
  "zh-CN crane labels stay 自动派车 / 手动叫车 / 暂停",
  t("zh-CN", "modeAuto") === "自动派车" && t("zh-CN", "modeManual") === "手动叫车" && t("zh-CN", "modePause") === "暂停"
);
check(
  "English crane labels stay Auto dispatch / Manual call / Pause",
  t("en", "modeAuto") === "Auto dispatch" && t("en", "modeManual") === "Manual call" && t("en", "modePause") === "Pause"
);

const hbx100 = productById("HBX-100");
check("HBX-100 spine is the template flow and recipe table", hbx100.flow === FLOW && hbx100.recipes === RECIPES && hbx100.flowId === "HBX-100-COWOS-S");
check("HBX-100 holds and morphs stay on the route contract", hbx100.holds === HOLDS && hbx100.morphs.join(",") === MORPHS.join(","));
check("HBX-100 does not replace dock rules", hbx100.rules == null && OUTPUT_PRESENT.s412.type === "TRAY");

const hbx240 = productById("HBX-240");
check("HBX-240 keeps the template tool order", hbx240.flow.map((s) => `${s.id}:${s.tool}`).join(",") === FLOW.map((s) => `${s.id}:${s.tool}`).join(","));
check("HBX-240 has its own flow id and recipe table", hbx240.flowId === "HBX-240-COWOS-S" && hbx240.recipes !== RECIPES && hbx240.flow !== FLOW);
check("HBX-240 reuses the HBX-100 dock rules", hbx240.rules.docks === DOCK_REQUIREMENTS && hbx240.rules.output === OUTPUT_PRESENT);
check(
  "HBX-240 issues more KGD and tightens shift and warpage",
  hbx240.recipes["R-s213-240"].params.find((p) => p.id === "qty").value === 16 &&
    hbx240.recipes["R-s327-240"].params.find((p) => p.id === "limit").value === 1 &&
    hbx240.recipes["R-s423-240"].params.find((p) => p.id === "limit").value === 80
);
check(
  "HBX-240 ball map, final test, and mark differ from HBX-100",
  hbx240.recipes["R-s431-240"].params.find((p) => p.id === "count").value === 64 &&
    hbx240.recipes["R-s532-240"].params.find((p) => p.id === "program").value === "FT-HBX240-B7" &&
    hbx240.recipes["R-s513-240"].params.find((p) => p.id === "content").value === "HBX240" &&
    RECIPES["R-s513"].params.find((p) => p.id === "content").value === "HBX100"
);
{
  const lot = new Session({ productId: "HBX-240", intensity: "none" });
  check(
    "HBX-240 warehouse still stocks INT DBK SUB FG and issues a larger KGD tray",
    lot.facility.wh.carriers.some((c) => c.zone === "INT") &&
      lot.facility.wh.carriers.find((c) => c.sku === "kgd").qty === 16
  );
}

const s12 = productById("HBX-S12");
const skippedTools = s12.skippedTools;
check("HBX-S12 is a shorter substrate route", s12.flow.length >= 16 && s12.flow.length < 40 && s12.flowId === "HBX-S12-SUB");
check(
  "HBX-S12 skips interposer fab and CoW",
  s12.flow.every((step) => step.module !== "m1" && step.module !== "m3") &&
    skippedTools.includes("TCB-32") &&
    skippedTools.includes("DRI-15") &&
    skippedTools.every((tool) => !s12.flow.some((step) => step.tool === tool))
);
check(
  "HBX-S12 morphs skip the interposer and CoW stack",
  s12.morphs.join(",") === "bank,issued,os,underfilled,balled,molded,marked,packed" &&
    s12.flow[0].morphIn === "bank" &&
    s12.flow.at(-1).morphOut === "packed"
);
check(
  "HBX-S12 has no FRAME and does not issue an interposer",
  !JSON.stringify(s12.rules.docks).includes("INT") &&
    !JSON.stringify(s12.rules.output).includes("FRAME") &&
    !Object.values(s12.rules.docks).flat().some((req) => req.zone === "INT" || req.type === "FOUP")
);
check("HBX-S12 does not change the shared probe port", PORTS["PRB-22"].accept.includes("FOUP"));
check(
  "S12 attach starts from issued dice, not a singulated wafer",
  poseSkipToWos(0).frameOp < 0.05 && poseSkipToWos(1).frameOp < 0.05 && poseSkipToWos(1).sub.op > 0.9 && poseSkipToWos(1).wafer.op < 0.05
);

function visitedTools(session) {
  const tools = new Set();
  for (const move of session.facility.moves) {
    const port = String(move.to);
    for (const step of FLOW) {
      if (port === step.tool || port.startsWith(`${step.tool}:`)) tools.add(step.tool);
    }
  }
  return tools;
}

{
  const undecided = new Session({ intensity: "none", awaitChoice: true });
  check("a new lot waits for auto or step", undecided.runChoice == null && undecided.advance() === false && undecided.stepIndex === 0 && !undecided.busy);
  const stepped = new Session({ intensity: "none", awaitChoice: true });
  check("step choice leaves auto-run off", stepped.chooseRun("step") === true && stepped.auto === false && stepped.runChoice === "step");
  check("step advance starts the current operation", stepped.advance() === true);
  pump(stepped);
  check(
    "step mode waits after one operation",
    stepped.stepIndex === 1 && stepped.beatIndex === 0 && stepped.busy === false && stepped.auto === false && stepped.status !== "DONE"
  );
  const auto = new Session({ productId: "HBX-S12", intensity: "none", awaitChoice: true });
  check("auto choice turns on the existing auto-run", auto.chooseRun("auto") === true && auto.auto === true);
  pump(auto);
  check("auto-run walks the selected flow to ship", auto.status === "DONE" && auto.step().id === "s535" && auto.morph === "packed");
  const seen = visitedTools(auto);
  check("HBX-S12 crane does not visit skipped CoW or dice tools", skippedTools.every((tool) => !seen.has(tool)));
  check(
    "HBX-S12 leaves INT stocked and never creates a FRAME",
    auto.facility.wh.carriers.filter((c) => c.zone === "INT").every((c) => String(c.location).startsWith("bin:INT") && c.status === "stock") &&
      auto.facility.wh.carriers.every((c) => c.type !== "FRAME")
  );
  const morphs = [];
  const walkS12 = new Session({ productId: "HBX-S12", intensity: "none" });
  while (walkS12.status !== "DONE") {
    walkS12.advance();
    pump(walkS12);
    morphs.push(walkS12.morph);
  }
  check(
    "HBX-S12 never commits bonded, thinned, or singulated",
    morphs.every((morph) => !["bonded", "thinned", "singulated"].includes(morph)) && morphs.at(-1) === "packed"
  );
}

{
  const fresh = defaultHudState();
  check(
    "large left and right docks start tucked",
    fresh.panels["lot-dock"].hidden === true && fresh.panels["facility-dock"].hidden === true && fresh.focus === false
  );
  const hidden = hidePanel(fresh, "theme-dock");
  const moved = movePanel(hidden, "cam-dock", 48, 96);
  const store = memStore();
  writeHud(moved, store);
  const loaded = readHud(store);
  check("hud hidden state and position persist", store.getItem(HUD_STORAGE_KEY) && loaded.panels["theme-dock"].hidden === true && loaded.panels["cam-dock"].x === 48 && loaded.panels["cam-dock"].y === 96);
  const restored = showPanel(loaded, "theme-dock");
  check("a hidden panel can be restored", restored.panels["theme-dock"].hidden === false && restored.panels["cam-dock"].x === 48);
  const focused = toggleFocus(restored);
  check(
    "focus mode clears the large docks",
    focused.focus === true && HUD_PANELS.filter((panel) => panel.large).every((panel) => focused.panels[panel.id].hidden === true)
  );
  const back = toggleFocus(focused);
  check("leaving focus restores the previous large docks", back.focus === false && back.panels["theme-dock"].hidden === false && back.panels["lot-dock"].hidden === true && back.panels["stage-rail"].hidden === false);
  const canvas = { id: "view", nodeName: "CANVAS", closest: () => null };
  const grip = { closest: (sel) => (String(sel).includes("hud-grip") ? {} : null) };
  check("hud drag starts on panel chrome, not the walk canvas", dragStartsOnChrome(grip) === true && dragStartsOnChrome(canvas) === false);
  const before = buildSolids().length;
  readHud(memStore({ [HUD_STORAGE_KEY]: store.getItem(HUD_STORAGE_KEY) }));
  check("hud chrome does not add walk solids", buildSolids().length === before && buildSolids().every((solid) => solid.kind !== "hud"));
}
check("an empty hud store uses the tucked default", readHud(memStore()).panels["lot-dock"].hidden === true);
check("a broken hud store falls back instead of throwing", readHud(memStore({ [HUD_STORAGE_KEY]: "{" })).panels["facility-dock"].hidden === true);
{
  const opsHud = defaultHudState();
  const tucked = hidePanel(hidePanel(opsHud, "ops-card"), "ops-layers");
  check(
    "ops card and factory layers can be hidden and restored",
    tucked.panels["ops-card"].hidden === true &&
      tucked.panels["ops-layers"].hidden === true &&
      showPanel(showPanel(tucked, "ops-card"), "ops-layers").panels["ops-layers"].hidden === false
  );
}

{
  const quietKpi = buildKpi({
    stepIndex: 0,
    flowLength: 21,
    status: "QUEUE",
    elapsed: 1,
    intensity: "none",
    craneMode: "AUTO",
    tools: quiet.tools,
  });
  const quietSame = buildKpi({
    stepIndex: 0,
    flowLength: 21,
    status: "QUEUE",
    elapsed: 5,
    intensity: "none",
    craneMode: "AUTO",
    tools: quiet.tools,
  });
  const quietLater = buildKpi({
    stepIndex: 0,
    flowLength: 21,
    status: "QUEUE",
    elapsed: 8,
    intensity: "none",
    craneMode: "AUTO",
    tools: quiet.tools,
  });
  check(
    "kpi values stay inside one elapsed bucket",
    quietKpi.bucket === quietSame.bucket &&
      quietKpi.cycleMin === quietSame.cycleMin &&
      quietKpi.throughput === quietSame.throughput &&
      quietKpi.availability === quietSame.availability
  );
  check("a later kpi bucket can move cycle time", quietLater.bucket > quietKpi.bucket && quietLater.cycleMin > quietKpi.cycleMin);
  const steppedKpi = buildKpi({
    stepIndex: 4,
    flowLength: 21,
    status: "RUN",
    elapsed: 0,
    intensity: "none",
    craneMode: "AUTO",
    tools: [],
  });
  const startKpi = buildKpi({
    stepIndex: 0,
    flowLength: 21,
    status: "QUEUE",
    elapsed: 0,
    intensity: "none",
    craneMode: "AUTO",
    tools: [],
  });
  check("cycle time follows the hero step", steppedKpi.cycleMin === startKpi.cycleMin + 72);
  const clearLine = buildOpsSnapshot({
    intensity: "none",
    stepIndex: 5,
    tool: "MET-34",
    stepId: "overlay",
    status: "RUN",
    busy: true,
    craneMode: "AUTO",
    elapsed: 1,
  });
  const heldLine = buildOpsSnapshot({
    intensity: "none",
    stepIndex: 5,
    tool: "MET-34",
    stepId: "overlay",
    status: "HOLD",
    hold: { id: "overlay", stationId: "s327" },
    craneMode: "AUTO",
    elapsed: 1,
  });
  const clearKpi = buildKpi({
    stepIndex: 5,
    flowLength: 21,
    status: "RUN",
    elapsed: 1,
    intensity: "none",
    craneMode: "AUTO",
    tools: clearLine.tools,
  });
  const holdKpi = buildKpi({
    stepIndex: 5,
    flowLength: 21,
    status: "HOLD",
    hold: { id: "overlay" },
    elapsed: 1,
    intensity: "none",
    craneMode: "AUTO",
    tools: heldLine.tools,
  });
  const pauseKpi = buildKpi({
    stepIndex: 5,
    flowLength: 21,
    status: "RUN",
    elapsed: 1,
    intensity: "none",
    craneMode: "PAUSE",
    tools: clearLine.tools,
  });
  check(
    "an open hold lowers availability and throughput and adds hold dwell",
    holdKpi.availability < clearKpi.availability &&
      holdKpi.throughput < clearKpi.throughput &&
      holdKpi.cycleMin === clearKpi.cycleMin + 6
  );
  check(
    "a crane pause lowers availability and throughput without inventing a new cycle",
    pauseKpi.availability < clearKpi.availability &&
      pauseKpi.throughput < clearKpi.throughput &&
      pauseKpi.cycleMin === clearKpi.cycleMin
  );
  const heroKpi = new Session({ scenario: "first", intensity: "none" });
  const heroBefore = buildKpiFromSession(heroKpi, 2);
  heroKpi.facility.setMode("PAUSE");
  const heroPaused = buildKpiFromSession(heroKpi, 2);
  check(
    "kpi from the hero session follows a crane pause",
    heroPaused.availability < heroBefore.availability && heroPaused.throughput < heroBefore.throughput
  );
}

{
  const fewMates = buildCompanions({ intensity: "few", stepIndex: 0, elapsed: 0, craneMode: "AUTO" });
  const manyMates = buildCompanions({ intensity: "many", stepIndex: 0, elapsed: 0, craneMode: "AUTO" });
  const noneMates = buildCompanions({ intensity: "none", stepIndex: 0, elapsed: 0, craneMode: "AUTO" });
  check(
    "companion lots stay between 2 and 4",
    fewMates.length === 2 && noneMates.length === 2 && manyMates.length === 4 &&
      [fewMates, manyMates, noneMates].every((list) => list.length >= 2 && list.length <= 4)
  );
  const picked = selectCompanion(manyMates, manyMates[1].id);
  check("a companion lot can be selected", picked?.id === manyMates[1].id && picked.tool === manyMates[1].tool && selectCompanion(manyMates, "missing") == null);
  const earlyMates = buildCompanions({ intensity: "few", stepIndex: 1, elapsed: 1 });
  const sameMates = buildCompanions({ intensity: "few", stepIndex: 1, elapsed: 5 });
  check(
    "companion placement stays put inside one time bucket",
    earlyMates.map((lot) => `${lot.id}:${lot.tool}`).join(",") === sameMates.map((lot) => `${lot.id}:${lot.tool}`).join(",")
  );
  const queued = buildOpsSnapshot({ intensity: "few", stepIndex: 0, elapsed: 0, craneMode: "AUTO" });
  check(
    "companion lots sit on tools the ops snapshot already marks",
    queued.companions.every((lot) => {
      const tool = queued.tools.find((item) => item.id === lot.tool);
      return !!tool && lot.moving === false && (tool.queue > 0 || tool.busy || lot.pose === "dock");
    })
  );
  const heldMates = buildOpsSnapshot({
    intensity: "many",
    stepIndex: 5,
    tool: "MET-34",
    stepId: "overlay",
    status: "HOLD",
    hold: { id: "overlay", stationId: "s327" },
    craneMode: "AUTO",
    elapsed: 0,
  });
  const overlayIndex = heldMates.tools.find((tool) => tool.id === "MET-34").index;
  check(
    "companions do not pass an open hold",
    heldMates.tools.find((tool) => tool.id === "MET-34").alarm === true &&
      heldMates.companions.length === 4 &&
      heldMates.companions.every((lot) => lot.index <= overlayIndex && lot.moving === false)
  );
  const pausedMates = buildCompanions({ intensity: "few", stepIndex: 0, craneMode: "PAUSE", elapsed: 0 });
  check("a crane pause does not send companion lots moving", pausedMates.every((lot) => lot.moving === false));
}

{
  const hbx = scenariosForProduct(productById("HBX-100"));
  const s12opts = scenariosForProduct(productById("HBX-S12"));
  check(
    "HBX-100 offers the five training scenarios",
    hbx.join(",") === "first,kgd,overlay,warpage,pause"
  );
  check(
    "HBX-S12 hides bond offset and keeps the scenarios it can run",
    !s12opts.includes("overlay") &&
      s12opts.includes("first") &&
      s12opts.includes("kgd") &&
      s12opts.includes("warpage") &&
      s12opts.includes("pause")
  );
  const ignored = new Session({ productId: "HBX-S12", scenario: "overlay", intensity: "none" });
  check("an inapplicable bond-offset scenario does not open that hold", ignored.scenario == null && ignored.hold == null && ignored.stepIndex === 0);
  const first = new Session({ scenario: "first", intensity: "many" });
  check(
    "first-lot scenario starts clean with auto dispatch",
    first.hold == null &&
      first.plannedHolds.size === 0 &&
      first.facility.mode === "AUTO" &&
      first.stepIndex === 0 &&
      first.facility.wh.carriers.filter((c) => c.sku === "kgd").every((c) => c.status === "stock" && c.qty > 0)
  );
  const claims = first.facility.amhs.claimCount;
  buildCompanions(first);
  check("companion lots do not claim the hero crane", first.facility.amhs.claimCount === claims);
  const kgdStart = new Session({ scenario: "kgd", intensity: "none" });
  check(
    "KGD scenario starts on a locked die bank",
    kgdStart.hold?.id === "kgd" &&
      kgdStart.step().id === "s213" &&
      kgdStart.step().tool === "PRB-22" &&
      kgdStart.morph === "bumped" &&
      kgdStart.facility.wh.carriers.filter((c) => c.sku === "kgd").every((c) => c.status === "locked" || !(c.qty > 0))
  );
  const bondStart = new Session({ scenario: "overlay", intensity: "none", role: "PE" });
  check(
    "bond-offset scenario starts held at MET-34",
    bondStart.hold?.id === "overlay" &&
      bondStart.step().tool === "MET-34" &&
      bondStart.morph === "bonded" &&
      bondStart.facility.holdTool === "MET-34" &&
      bondStart.facility.agreementErrors().length === 0
  );
  check("bond-offset scenario uses the existing hold actions", bondStart.resolve("release").ok === true && bondStart.hold == null);
  const bondReview = buildAfterAction(bondStart, buildKpiFromSession(bondStart, 6));
  check(
    "a resolved scenario hold is what the after-action reports",
    bondReview.guidanceKey === "aarDid_overlay" &&
      bondReview.holds === 1 &&
      afterActionFigures(bondReview).length === 3
  );
  const warpStart = new Session({ scenario: "warpage", intensity: "none" });
  check(
    "warpage scenario starts held at MET-43",
    warpStart.hold?.id === "warpage" && warpStart.step().tool === "MET-43" && warpStart.facility.holdTool === "MET-43"
  );
  const pauseStart = new Session({ scenario: "pause", intensity: "none" });
  const pauseView = buildOpsSnapshot(pauseStart);
  check(
    "crane-pause scenario starts paused and does not alarm a process tool",
    pauseStart.facility.mode === "PAUSE" &&
      pauseStart.hold == null &&
      pauseStart.stepIndex === 0 &&
      pauseStart.plannedHolds.size === 0 &&
      pauseView.bottleneck.kind === "pause" &&
      pauseView.craneMode === "PAUSE" &&
      pauseView.tools.every((tool) => tool.alarm === false)
  );
  const finished = new Session({ productId: "HBX-S12", scenario: "first", intensity: "none" });
  finished.chooseRun("auto");
  pump(finished);
  const review = buildAfterAction(finished, buildKpiFromSession(finished, 40));
  const figures = afterActionFigures(review);
  check(
    "after-action appears when the lot completes",
    finished.status === "DONE" &&
      review.happenedKey === "aarHappened_first" &&
      review.guidanceKey === "aarShould_first" &&
      figures.length === 3 &&
      figures.map((item) => item.key).join(",") === "aarCycle,aarHolds,aarAvail"
  );
  check(
    "after-action copy exists in all three languages",
    ["zh-TW", "zh-CN", "en"].every((lang) => t(lang, review.happenedKey) !== review.happenedKey && t(lang, figures[0].key, { n: figures[0].n }).includes(String(figures[0].n)))
  );
  const s12Test = (finished.lot.tests || []).find((row) => row.stepId === "s533" || row.tool === "ATE-58");
  check(
    "HBX-S12 still records final-test yield after skipping M1 and M3",
    finished.flow.every((step) => step.module !== "m1" && step.module !== "m3") &&
      !!s12Test &&
      s12Test.pass + s12Test.downgrade + s12Test.fail === finished.lot.totalSites &&
      s12Test.yieldPct > 0
  );
}

{
  const follow = applyPreset(defaultHudState(), "follow");
  check(
    "follow preset shows the lot dock, tool dock, and compact kpi",
    follow.preset === "follow" &&
      follow.panels["lot-dock"].hidden === false &&
      follow.panels["tool-dock"].hidden === false &&
      follow.panels["kpi-card"].hidden === false &&
      follow.panels["ops-card"].hidden === false &&
      follow.panels["facility-dock"].hidden === true &&
      follow.panels["ops-layers"].hidden === true
  );
  const walkPreset = applyPreset(follow, "walk");
  check(
    "walk preset tucks the large docks and does not enter walk",
    walkPreset.preset === "walk" &&
      presetCamera("walk") === "keep" &&
      walkPreset.panels["lot-dock"].hidden === true &&
      walkPreset.panels["facility-dock"].hidden === true &&
      walkPreset.panels["tool-dock"].hidden === true &&
      walkPreset.panels["kpi-card"].hidden === true &&
      walkPreset.panels["ops-card"].hidden === true &&
      walkPreset.panels["stage-rail"].hidden === true
  );
  const overview = applyPreset(walkPreset, "overview");
  check(
    "overview preset keeps the tucked docks and shows kpi, ops, and layers",
    overview.preset === "overview" &&
      presetCamera("overview") === "overview" &&
      presetCamera("follow") === "lot" &&
      overview.panels["lot-dock"].hidden === true &&
      overview.panels["facility-dock"].hidden === true &&
      overview.panels["kpi-card"].hidden === false &&
      overview.panels["ops-card"].hidden === false &&
      overview.panels["ops-layers"].hidden === false
  );
  const presetStore = memStore();
  writeHud(follow, presetStore);
  const loadedPreset = readHud(presetStore);
  check(
    "the last hud preset persists in the hud store",
    loadedPreset.preset === "follow" && loadedPreset.panels["lot-dock"].hidden === false && presetStore.getItem(HUD_STORAGE_KEY)
  );
  const solidsBefore = buildSolids().length;
  applyPreset(defaultHudState(), "walk");
  check("a hud preset does not add a walk solid", buildSolids().length === solidsBefore && buildSolids().every((solid) => solid.kind !== "hud"));
}

for (const lang of ["zh-TW", "zh-CN", "en"]) {
  for (const key of V11_COPY_KEYS) {
    check(`${lang} has v11 copy ${key}`, hasOwnCopy(lang, key));
  }
}
check(
  "preset names stay 廠長總覽 / 跟批作業 / 步行巡線",
  t("zh-TW", "presetOverview") === "廠長總覽" &&
    t("zh-TW", "presetFollow") === "跟批作業" &&
    t("zh-TW", "presetWalk") === "步行巡線" &&
    t("zh-CN", "presetOverview") === "厂长总览" &&
    t("zh-CN", "presetFollow") === "跟批作业" &&
    t("zh-CN", "presetWalk") === "步行巡线" &&
    t("en", "presetOverview") === "Plant overview" &&
    t("en", "presetFollow") === "Follow lot" &&
    t("en", "presetWalk") === "Walk"
);
check(
  "scenario names keep 键合偏移 and 翘曲 in simplified Chinese",
  t("zh-CN", "scenario_overlay") === "键合偏移" &&
    t("zh-CN", "scenario_warpage") === "翘曲" &&
    t("zh-TW", "scenario_overlay") === "鍵合偏移" &&
    t("en", "scenario_overlay") === "Bond offset"
);
{
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const uiSrc = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  const freshCopy = ["../js/v11-i18n.js", "../js/i18n.js", "../js/main.js", "../index.html"]
    .map((rel) => readFileSync(new URL(rel, import.meta.url), "utf8"))
    .join("\n");
  check(
    "the shift card, presets, scenarios, and after-action are on the page",
    page.includes('id="kpi-card"') &&
      page.includes('id="preset-dock"') &&
      page.includes('data-preset="overview"') &&
      page.includes('data-preset="follow"') &&
      page.includes('data-preset="walk"') &&
      page.includes('id="scenario-row"') &&
      page.includes('id="aar-happened"') &&
      page.includes('id="aar-stats"')
  );
  check("completion builds the after-action from the existing done sheet", uiSrc.includes("buildAfterAction") && uiSrc.includes("afterActionFigures"));
  check("crane labels were not rewritten", !freshCopy.includes("手勘"));
}

{
  check("the v12 process contract is still 5/18/86 on HBX-100-COWOS-S", FLOW.length === 86 && FLOW_ID === "HBX-100-COWOS-S" && new Set(FLOW.map((step) => step.module)).size === 5 && new Set(FLOW.map((step) => step.stage)).size === 18);
  const s12 = productById("HBX-S12");
  check("HBX-S12 still skips M1 and M3 and still has final test", s12.flow.every((step) => step.module !== "m1" && step.module !== "m3") && s12.flow.some((step) => step.id === "s532") && s12.flow.some((step) => step.id === "s533"));
  check(
    "crane labels are still 自動派車 / 手動叫車 / 暫停",
    t("zh-TW", "modeAuto") === "自動派車" && t("zh-TW", "modeManual") === "手動叫車" && t("zh-TW", "modePause") === "暫停" &&
      t("zh-CN", "modeAuto") === "自动派车" && t("en", "modeAuto") === "Auto dispatch"
  );
  check(
    "the six equipment states are named in zh-Hant, zh-CN, and English",
    EQ_STATES.join(",") === "RUN,IDLE,ASSIST,DOWN,PM,QUAL" &&
      ["運行", "待機", "輔助", "當機", "保養", "驗證"].every((word, i) => t("zh-TW", "eq_" + EQ_STATES[i]) === word) &&
      ["运行", "待机", "辅助", "当机", "保养", "验证"].every((word, i) => t("zh-CN", "eq_" + EQ_STATES[i]) === word) &&
      ["RUN", "IDLE", "ASSIST", "DOWN", "PM", "QUAL"].every((word, i) => t("en", "eq_" + EQ_STATES[i]) === word)
  );
  for (const lang of ["zh-TW", "zh-CN", "en"]) {
    for (const key of V13_COPY_KEYS) check(`${lang} has v13 copy ${key}`, hasOwnCopy(lang, key));
  }
  const floor = new Equipment(null);
  const sample = floor.ids[0];
  check("every shared tool has one of the six states", floor.ids.length === 34 && Object.values(floor.view(0)).every((state) => EQ_STATES.includes(state)));
  for (const state of ["IDLE", "ASSIST", "DOWN", "PM", "QUAL"]) {
    floor.force(sample, state);
    check(`a tool can be forced to ${state}`, floor.stateOf(sample, 0) === state);
  }
  floor.force(sample, "IDLE");
  check("RUN is the state while that idle tool is processing", floor.stateOf(sample, 0, { running: true }) === "RUN");
  check("DOWN, PM, and QUAL block a process start", ["DOWN", "PM", "QUAL"].every((state) => eqBlocksStart(state)) && !eqBlocksStart("IDLE") && !eqBlocksStart("RUN") && !eqBlocksStart("ASSIST"));
  check("a crane-pause scenario does not take process tools down", Object.values(new Equipment("pause").view(30)).every((state) => state === "IDLE"));

  function reachProcess(session) {
    session.setMode("beat");
    const processBeat = BEATS.indexOf("process");
    let guard = 0;
    while (guard < 4000) {
      guard += 1;
      if (session.beatIndex === processBeat && !session.busy && !session.hold && session.facility.readyForProcess(session.step().id)) return true;
      if (!session.busy && !session.awaitingTransport && !session.hold) session.advance();
      session.tick(0.25);
    }
    return false;
  }

  for (const state of ["DOWN", "PM", "QUAL"]) {
    const session = new Session({ intensity: "none" });
    check(`${state} setup reaches the first process beat`, reachProcess(session));
    const tool = session.step().tool;
    session.equip.force(tool, state);
    session.advance();
    check(`${state} does not start the process`, session.processProgress === 0 && session.beatIndex === BEATS.indexOf("process"));
    session.tick(1);
    check(`${state} stays queued instead of processing`, session.processProgress === 0 && session.status === "QUEUE" && session.busy === false);
  }

  const assist = new Session({ intensity: "none" });
  check("assist setup reaches the first process beat", reachProcess(assist));
  const assistTool = assist.step().tool;
  assist.equip.force(assistTool, "ASSIST");
  assist.advance();
  assist.tick(1);
  check("ASSIST does not continue until it is cleared", assist.processProgress === 0 && assist.busy === false);
  check("clearing assist lets the process start", assist.clearAssist(assistTool).ok === true && assist.eqState(assistTool) !== "ASSIST");
  assist.advance();
  {
    let n = 0;
    while (assist.processProgress <= 0 && assist.beatIndex === BEATS.indexOf("process") && n < 20) {
      assist.tick(0.05);
      n += 1;
    }
  }
  check("the cleared tool is processing", assist.processProgress > 0 || assist.beatIndex > BEATS.indexOf("process"));

  const holdWords = {
    "zh-TW": ["圍堵", "重工", "報廢", "放行"],
    "zh-CN": ["围堵", "重工", "报废", "放行"],
    en: ["Contain", "Rework", "Scrap", "Release"],
  };
  for (const [lang, words] of Object.entries(holdWords)) {
    check(
      `${lang} names containment and the three dispositions`,
      [t(lang, "dispContain"), t(lang, "dispRework"), t(lang, "dispScrap"), t(lang, "dispRelease")].join(",") === words.join(",")
    );
  }
  check(
    "rework targets are unchanged",
    HOLDS.overlay.actions.find((action) => action.id === "rework").backTo === "s324" &&
      HOLDS.void.actions.find((action) => action.id === "rework").backTo === "s332" &&
      HOLDS.warpage.actions.find((action) => action.id === "rework").backTo === "s412"
  );
  for (const id of ["kgd", "overlay", "void", "warpage"]) {
    const ids = HOLDS[id].actions.map((action) => action.id);
    check(`${id} can be reworked, scrapped, or released`, ids.includes("rework") && ids.includes("scrap") && ids.includes("release"));
  }

  const contained = new Session({ intensity: "many", role: "PE" });
  runUntil(contained, (session) => session.hold?.id === "overlay");
  check(
    "an open hold starts in containment and is not processed",
    contained.hold?.phase === "contain" && contained.status === "HOLD" && contained.busy === false && contained.processProgress < 1
  );
  check("confirming containment keeps the lot held", contained.resolve("contain").ok === true && contained.hold?.phase === "disposition" && contained.status === "HOLD");
  contained.resolve("rework");
  check("rework after containment still returns to TCB", contained.step().id === "s324" && contained.holdsResolved.at(-1)?.action === "rework" && contained.holdsResolved.at(-1)?.contained === true);

  const scrapped = new Session({ intensity: "many", role: "PE" });
  runUntil(scrapped, (session) => session.hold?.id === "void");
  scrapped.resolve("contain");
  scrapped.resolve("scrap");
  const scrapReview = buildAfterAction(scrapped, buildKpiFromSession(scrapped, 4));
  check(
    "scrap ends the lot and does not pack it as good",
    scrapped.status === "SCRAP" &&
      scrapped.lot.outcome === "scrap" &&
      scrapped.lot.packedAsGood === false &&
      scrapped.lot.goodSites === 0 &&
      scrapped.morph !== "packed" &&
      !scrapped.lot.notes.includes("packed") &&
      scrapReview.choices.some((row) => row.action === "scrap" && row.contained === true)
  );
  scrapped.advance();
  scrapped.tick(1);
  check("a scrapped lot does not continue into pack", scrapped.status === "SCRAP" && scrapped.morph !== "packed" && scrapped.step().id === "s332");

  const released = new Session({ intensity: "many", role: "PE" });
  runUntil(released, (session) => session.hold?.id === "warpage");
  released.resolve("contain");
  check("release after containment clears the hold and records the choice", released.resolve("release").ok === true && released.hold == null && released.holdsResolved.some((row) => row.action === "release" && row.contained === true));
  const releaseReview = buildAfterAction(released, buildKpiFromSession(released, 3));
  check("the review keeps the release choice", releaseReview.choices.some((row) => row.id === "warpage" && row.action === "release" && row.contained === true) && afterActionFigures(releaseReview).length === 3);

  const tested = (good.lot.tests || []).filter((row) => isFinalTest({ id: row.stepId, tool: row.tool }));
  check(
    "the good lot keeps a final-test yield and bins",
    tested.length >= 1 &&
      tested.every((row) => row.pass + row.downgrade + row.fail === good.lot.totalSites && row.yieldPct >= 0 && row.yieldPct <= 100 && row.bins && row.grade)
  );
  const sampleYield = buildYield({ id: "APX-TEST", totalSites: 12 }, { id: "s533", tool: "ATE-58" });
  check("yield bins add up to the lot sites", sampleYield.pass + sampleYield.downgrade + sampleYield.fail === 12);

  const fifo = [
    { id: "A", arrival: 0, hot: false },
    { id: "B", arrival: 1, hot: false },
    { id: "H", arrival: 2, hot: true },
  ];
  check("FIFO keeps arrival order", orderLots(fifo, "FIFO").map((lot) => lot.id).join(",") === "A,B,H");
  check("a hot lot jumps the queue only while that rule is on", orderLots(fifo, "HOT").map((lot) => lot.id).join(",") === "H,A,B");
  const moves = [
    { id: "m1", seq: 1, lotId: "A" },
    { id: "m2", seq: 2, lotId: "H" },
  ];
  check("FIFO leaves the crane queue in arrival order", orderMoves(moves, "FIFO", ["H"]).map((move) => move.id).join(",") === "m1,m2");
  check("a hot lot jumps a busy crane queue", orderMoves(moves, "HOT", ["H"]).map((move) => move.id).join(",") === "m2,m1");
  const dispatch = new Session({ intensity: "none" });
  check("dispatch defaults to FIFO", dispatch.dispatchRule === "FIFO" && dispatch.facility.amhs.dispatchRule === "FIFO");
  dispatch.toggleHot(dispatch.lot.id);
  dispatch.setDispatch("HOT");
  check("the hero lot can be marked hot and the rule switches", dispatch.dispatchRule === "HOT" && dispatch.isHot(dispatch.lot.id) && dispatch.facility.amhs.dispatchRule === "HOT");
  dispatch.setDispatch("FIFO");
  check("switching back restores FIFO and keeps the mark", dispatch.dispatchRule === "FIFO" && dispatch.isHot(dispatch.lot.id));

  const targetFirst = shiftTarget({ productId: "HBX-100", scenario: "first" });
  const targetKgd = shiftTarget({ productId: "HBX-100", scenario: "kgd" });
  const shiftKpi = buildKpi({
    stepIndex: 1,
    flowLength: 86,
    status: "RUN",
    elapsed: 2,
    intensity: "few",
    craneMode: "AUTO",
    tools: [],
    productId: "HBX-100",
    scenario: "first",
  });
  check(
    "the shift card has a target and an actual output",
    targetFirst !== targetKgd &&
      shiftKpi.targetOut === targetFirst &&
      shiftKpi.actualOut === shiftKpi.throughput &&
      Number.isFinite(shiftKpi.actualOut)
  );
  check(
    "target versus actual is on the shift card",
    readFileSync(new URL("../index.html", import.meta.url), "utf8").includes('id="kpi-target"') &&
      readFileSync(new URL("../js/ui.js", import.meta.url), "utf8").includes("kpiTargetActual")
  );
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall acceptance checks passed");
