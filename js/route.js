/**
 * HBX-100 route contract (trainer v3).
 *
 * One short route. Five process stations. Genealogy, MES-style status, the
 * 3D morph state, the electronic warehouse, and the overhead crane all read
 * this module — do not add a process station, and do not keep a second
 * state machine beside it.
 *
 * Morphology commits only when that station's process finishes with no open
 * hold:
 *   bank → issued → bonded → singulated → wos → packed
 *
 * A hold keeps the lot on its station. `blocksMorph` is the first morphology
 * that must not be committed while the hold is open (every later morphology
 * is blocked with it). The same hold locks the carrier at that tool and
 * refuses an overhead-crane delivery to any other process station.
 *
 * The stocker at the head of the aisle is a facility, not a sixth station.
 * Zones, inventory status, crane modes, and the dock each station requires
 * before its process may start are declared below.
 *
 * Refinements vs the v1 seventeen-step walk, recorded so the fields stay
 * explicit:
 * - Station 1's traveling carrier code is FOUP. The die-bank waffle trays are
 *   part of the tool, and both are on screen. The contract carrier is
 *   "FOUP and die-bank tray".
 * - Station 2's "substrate/wafer" is the target interposer wafer in the FOUP.
 *   The package substrate arrives at WoS in the magazine.
 * - Dice carrier code is FRAME (dicing frame and tape). There is no hold
 *   unique to dice.
 * - Bond-offset rework retries HB-21. This route has no plasma station.
 * - Warpage retries WoS. Balls are not part of this station.
 * - Underfill void is on ball / FT / pack (station 5), not a separate
 *   underfill station. Rework retries BPK-05.
 * - The lot record still tracks 12 sites. The 3D hero shows one stack plus
 *   three sibling units so singulation reads at camera distance.
 */

export const MORPHS = ["bank", "issued", "bonded", "singulated", "wos", "packed"];

/** Process-beat fraction at which a planned hold freezes the station. */
export const HOLD_AT = 0.42;

export const STATIONS = [
  {
    id: "diebank",
    stage: "incoming",
    tool: "DBK-02",
    recipe: "KGD-ISSUE-01",
    kind: "diebank",
    duration: 3.2,
    place: { x: -34, z: -18, face: 1, bay: "incoming" },
    carrier: "FOUP",
    morphIn: "bank",
    morphOut: "issued",
    contract: {
      name: "Incoming / KGD die bank",
      carrier: "FOUP and die-bank tray",
      in: "Incoming source wafers and bare KGD still in the bank",
      changes: "Inspect and issue KGD. No stack yet.",
      out: "Issued KGD ready for bond",
      hold: "KGD shortage — no dies are issued; the product must not enter the bonded-stack morphology",
    },
  },
  {
    id: "hbond",
    stage: "cow",
    tool: "HB-21",
    recipe: "HBOND-COW-02",
    kind: "bonder",
    duration: 3.4,
    place: { x: -6, z: -18, face: 1, bay: "cow" },
    carrier: "FOUP",
    morphIn: "issued",
    morphOut: "bonded",
    contract: {
      name: "CoW hybrid bond",
      carrier: "FOUP plus the target interposer wafer",
      in: "Issued KGD and the target wafer",
      changes: "Hybrid-bond interface. A stacked die appears on the wafer (CoW).",
      out: "Bonded stack with a visible bond plane",
      hold: "Bond offset — show misalignment and do not proceed to the diced morphology",
    },
  },
  {
    id: "dice",
    stage: "dice",
    tool: "DIC-81",
    recipe: "DICE-COW-01",
    kind: "dicer",
    duration: 3.4,
    place: { x: -34, z: 18, face: -1, bay: "dice" },
    carrier: "FRAME",
    morphIn: "bonded",
    morphOut: "singulated",
    contract: {
      name: "Dice",
      carrier: "Bonded wafer on a dicing frame and tape",
      in: "Bonded CoW wafer",
      changes: "Singulation. The wafer becomes individual stacks.",
      out: "Singulated CoW units",
      hold: null,
    },
  },
  {
    id: "wos",
    stage: "wos",
    tool: "WOS-04",
    recipe: "WOS-ATTACH-01",
    kind: "wos",
    duration: 3.3,
    place: { x: 0, z: 18, face: -1, bay: "wos" },
    carrier: "MAG",
    morphIn: "singulated",
    morphOut: "wos",
    contract: {
      name: "WoS",
      carrier: "Substrate magazine",
      in: "Singulated CoW units",
      changes: "Attach the stack onto the package substrate (WoS assembly).",
      out: "CoW-on-substrate assembly",
      hold: "Warpage — the assembly stays at this station; no ball array appears",
    },
  },
  {
    id: "ballpack",
    stage: "pack",
    tool: "BPK-05",
    recipe: "BALL-FT-PACK-01",
    kind: "ballpack",
    duration: 3.6,
    place: { x: 28, z: 18, face: -1, bay: "pack" },
    carrier: "TRAY",
    morphIn: "wos",
    morphOut: "packed",
    contract: {
      name: "Ball / FT / pack",
      carrier: "JEDEC tray",
      in: "WoS assembly",
      changes: "Ball/bump array appears, then the unit is tested and placed in the tray.",
      out: "Bumped, tested, packed unit",
      hold: "Underfill void — do not complete the bumped/packed morphology",
    },
  },
];

export const HOLDS = {
  kgd: {
    id: "kgd",
    stationId: "diebank",
    variant: "shortage",
    blocksMorph: "issued",
    radio: "radioKgdEE",
    actions: [
      { id: "wait", label: "hold_kgd_wait", hint: "hold_kgd_wait_s", role: null },
      { id: "partial", label: "hold_kgd_partial", hint: "hold_kgd_partial_s", role: "PE" },
    ],
  },
  overlay: {
    id: "overlay",
    stationId: "hbond",
    variant: "offset",
    blocksMorph: "singulated",
    radio: "radioOverlayPE",
    actions: [
      { id: "rework", label: "hold_overlay_rework", hint: "hold_overlay_rework_s", role: null, backTo: "hbond" },
      { id: "scrap", label: "hold_overlay_scrap", hint: "hold_overlay_scrap_s", role: null, scrap: 2 },
      { id: "release", label: "hold_overlay_release", hint: "hold_overlay_release_s", role: "PE" },
    ],
  },
  warpage: {
    id: "warpage",
    stationId: "wos",
    variant: "warp",
    blocksMorph: "packed",
    radio: "radioWarpPE",
    actions: [
      { id: "bake", label: "hold_warpage_bake", hint: "hold_warpage_bake_s", role: null },
      { id: "scrap", label: "hold_warpage_scrap", hint: "hold_warpage_scrap_s", role: null, newSubstrate: true },
      { id: "release", label: "hold_warpage_release", hint: "hold_warpage_release_s", role: "PE" },
    ],
  },
  void: {
    id: "void",
    stationId: "ballpack",
    variant: "void",
    blocksMorph: "packed",
    radio: "radioVoidMFG",
    actions: [
      { id: "rework", label: "hold_void_rework", hint: "hold_void_rework_s", role: null, backTo: "ballpack" },
      { id: "scrap", label: "hold_void_scrap", hint: "hold_void_scrap_s", role: null, scrap: 1 },
      { id: "release", label: "hold_void_release", hint: "hold_void_release_s", role: "PE" },
    ],
  },
};

const CONTRACT_FIELDS = ["name", "carrier", "in", "changes", "out", "hold"];

/** Traveling-carrier codes the crane is allowed to couple. */
export const CARRIER_TYPES = ["FOUP", "TRAY", "FRAME", "MAG"];

/** Inventory status. Location is separate: bin / io / transit / port / tool. */
export const INV_STATUS = ["stock", "reserved", "transit", "locked"];

/**
 * One stocker, four zones. Bins are the shelf slots drawn in 3D.
 * DBK holds KGD trays, INT interposer FOUPs, SUB substrate magazines,
 * FG finished JEDEC trays.
 */
export const ZONES = [
  { id: "DBK", carrier: "TRAY", sku: "kgd", bins: ["A1", "A2", "A3"] },
  { id: "INT", carrier: "FOUP", sku: "interposer", bins: ["B1", "B2", "B3"] },
  { id: "SUB", carrier: "MAG", sku: "substrate", bins: ["C1", "C2", "C3"] },
  { id: "FG", carrier: "TRAY", sku: "finished", bins: ["D1", "D2", "D3"] },
];

export const STOCKER = { id: "stocker", place: { x: -49.2, z: 0 } };

export const OHT_MODES = ["AUTO", "MANUAL", "PAUSE"];
export const VEHICLE_STATES = ["idle", "goto_pick", "hoist_pick", "travel", "hoist_drop", "paused"];
export const VEHICLE_IDS = ["OHT-1", "OHT-2"];

/** Training-range timings (seconds). Travel legs stay inside 3.2–4.8 s. */
export const LEG = {
  travelMin: 3.2,
  travelMax: 4.8,
  travelSpeed: 24,
  hoist: 1.8,
  handoff: 0.95,
  stacker: 2.3,
};

export const RAIL_Y = 6.25;

/**
 * One-way ceiling loop. Warehouse I/O ports share the west leg.
 * North leg: DBK-02 then HB-21. South leg runs back past BPK, WoS, and dice.
 * A vehicle may pass another load port with the hoist up; it descends only
 * at the port it was assigned.
 */
export const RAIL_NODES = [
  { id: "ioDBK", x: -46, z: -2.4 },
  { id: "ioINT", x: -46, z: -0.8 },
  { id: "ioSUB", x: -46, z: 0.8 },
  { id: "ioFG", x: -46, z: 2.4 },
  { id: "westN", x: -46, z: -15.6 },
  { id: "DBK-02", x: -34, z: -15.6 },
  { id: "HB-21", x: -6, z: -15.6 },
  { id: "eastN", x: 42, z: -15.6 },
  { id: "eastS", x: 42, z: 15.6 },
  { id: "BPK-05", x: 28, z: 15.6 },
  { id: "WOS-04", x: 0, z: 15.6 },
  { id: "DIC-81", x: -34, z: 15.6 },
  { id: "westS", x: -46, z: 15.6 },
];

/** Local +Z of a tool's load port. World Z follows the station face. */
export const LOAD_LOCAL_Z = 2.4;

/**
 * Where a crane may drop a carrier, and which types that port accepts.
 * A mismatch is refused. `DBK-02:tray` is the die-bank shelf port; the
 * traveling FOUP uses `DBK-02`. WoS takes a magazine on `WOS-04` and the
 * singulated frame on `WOS-04:unit`.
 */
export const PORTS = {
  "io:DBK": { accept: ["TRAY"], rail: "ioDBK", zone: "DBK", kind: "io" },
  "io:INT": { accept: ["FOUP"], rail: "ioINT", zone: "INT", kind: "io" },
  "io:SUB": { accept: ["MAG"], rail: "ioSUB", zone: "SUB", kind: "io" },
  "io:FG": { accept: ["TRAY"], rail: "ioFG", zone: "FG", kind: "io" },
  "DBK-02": { accept: ["FOUP"], rail: "DBK-02", tool: "DBK-02", stationId: "diebank", kind: "load" },
  "DBK-02:tray": { accept: ["TRAY"], rail: "DBK-02", tool: "DBK-02", stationId: "diebank", kind: "load" },
  "HB-21": { accept: ["FOUP"], rail: "HB-21", tool: "HB-21", stationId: "hbond", kind: "load" },
  "DIC-81": { accept: ["FRAME"], rail: "DIC-81", tool: "DIC-81", stationId: "dice", kind: "load" },
  "WOS-04": { accept: ["MAG"], rail: "WOS-04", tool: "WOS-04", stationId: "wos", kind: "load" },
  "WOS-04:unit": { accept: ["FRAME"], rail: "WOS-04", tool: "WOS-04", stationId: "wos", kind: "load" },
  "WOS-04:out": { accept: ["TRAY"], rail: "WOS-04", tool: "WOS-04", stationId: "wos", kind: "load" },
  "BPK-05": { accept: ["TRAY"], rail: "BPK-05", tool: "BPK-05", stationId: "ballpack", kind: "load" },
};

/**
 * Carriers that must be handed off at the tool before that station's
 * process animation or morph may start.
 * KGD + interposer before station 1. Substrate only before WoS.
 */
export const DOCK_REQUIREMENTS = {
  diebank: [
    { port: "DBK-02:tray", type: "TRAY", role: "issue", zone: "DBK", sku: "kgd" },
    { port: "DBK-02", type: "FOUP", role: "issue", zone: "INT", sku: "interposer", becomesLot: true },
  ],
  hbond: [
    { port: "HB-21", type: "FOUP", role: "travel" },
  ],
  dice: [
    { port: "DIC-81", type: "FRAME", role: "travel" },
  ],
  wos: [
    { port: "WOS-04", type: "MAG", role: "issue", zone: "SUB", sku: "substrate" },
    { port: "WOS-04:unit", type: "FRAME", role: "travel" },
  ],
  ballpack: [
    { port: "BPK-05", type: "TRAY", role: "travel" },
  ],
};

/** After pack, the finished JEDEC tray is put away to FG. */
export const PUTAWAY = { stationId: "ballpack", zone: "FG", port: "io:FG", type: "TRAY" };

/**
 * Job-out presentation. The lot's traveling carrier waits at this port
 * until a crane picks it up. Bond presents a FRAME (the FOUP returns to
 * INT). WoS presents a JEDEC tray (the magazine returns to SUB).
 */
export const OUTPUT_PRESENT = {
  diebank: { type: "FOUP", port: "DBK-02" },
  hbond: { type: "FRAME", port: "HB-21", returnZone: "INT" },
  dice: { type: "FRAME", port: "DIC-81" },
  wos: { type: "TRAY", port: "WOS-04:out", returnZone: "SUB" },
  ballpack: { type: "TRAY", port: "BPK-05", sku: "finished" },
};

export function portAccepts(portId, type) {
  const port = PORTS[portId];
  return !!(port && port.accept.includes(type));
}

export function returnZoneFor(carrier) {
  if (!carrier) return null;
  if (carrier.sku === "finished" || carrier.sku === "wip-tray") return "FG";
  if (carrier.type === "FOUP") return "INT";
  if (carrier.type === "MAG") return "SUB";
  if (carrier.type === "TRAY") return carrier.sku === "kgd" || carrier.sku === "kgd-issued" ? "DBK" : "FG";
  return null;
}

export function loadPortXZ(station) {
  const face = station.place.face > 0 ? 1 : -1;
  return {
    x: station.place.x,
    z: station.place.z + face * LOAD_LOCAL_Z,
  };
}

let _rail = null;
export function railPath() {
  if (_rail) return _rail;
  const segs = [];
  let acc = 0;
  for (let i = 0; i < RAIL_NODES.length; i++) {
    const a = RAIL_NODES[i];
    const b = RAIL_NODES[(i + 1) % RAIL_NODES.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segs.push({ a, b, start: acc, len });
    acc += len;
  }
  const at = {};
  segs.forEach((seg, i) => { at[RAIL_NODES[i].id] = seg.start; });
  _rail = { segs, length: acc, at };
  return _rail;
}

export function nodeS(nodeId) {
  const s = railPath().at[nodeId];
  if (s == null) throw new Error(`unknown rail node ${nodeId}`);
  return s;
}

export function forwardDistance(from, to) {
  const length = railPath().length;
  let d = to - from;
  if (d < 0) d += length;
  return d;
}

export function railPoint(s) {
  const rail = railPath();
  let u = s % rail.length;
  if (u < 0) u += rail.length;
  for (const seg of rail.segs) {
    if (u <= seg.start + seg.len + 1e-6) {
      const k = seg.len === 0 ? 0 : Math.min(1, Math.max(0, (u - seg.start) / seg.len));
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * k,
        y: RAIL_Y,
        z: seg.a.z + (seg.b.z - seg.a.z) * k,
      };
    }
  }
  return { x: RAIL_NODES[0].x, y: RAIL_Y, z: RAIL_NODES[0].z };
}

export function travelDuration(distance) {
  if (distance < 0.3) return 0.7;
  return Math.min(LEG.travelMax, Math.max(LEG.travelMin, distance / LEG.travelSpeed));
}

export function stationById(id) {
  return STATIONS.find((s) => s.id === id) || null;
}

export function stationByTool(tool) {
  return STATIONS.find((s) => s.tool === tool) || null;
}

export function holdForStation(stationId) {
  return Object.values(HOLDS).find((h) => h.stationId === stationId) || null;
}

export function planHolds(intensity) {
  if (intensity === "none") return [];
  if (intensity === "few") return ["kgd", "void"];
  return ["kgd", "overlay", "warpage", "void"];
}

/**
 * Morphology committed by a finished process beat.
 * `processBeatIndex` is the MES "process" beat. A later beat on this
 * station, or any later station, means the out-morph is committed.
 * An open hold never commits the station it froze.
 */
export function committedMorph(stepIndex, beatIndex, holdOpen, processBeatIndex) {
  let morph = STATIONS[0].morphIn;
  for (let i = 0; i < STATIONS.length; i++) {
    const passed = stepIndex > i || (stepIndex === i && beatIndex > processBeatIndex && !holdOpen);
    if (!passed) break;
    morph = STATIONS[i].morphOut;
  }
  return morph;
}

export function morphRank(morph) {
  const i = MORPHS.indexOf(morph);
  return i < 0 ? -1 : i;
}

/** True when `morph` is the blocked morphology or anything after it. */
export function morphIsBlocked(morph, blocksMorph) {
  if (!blocksMorph) return false;
  return morphRank(morph) >= morphRank(blocksMorph);
}

export function genealogyRows(lot, morph, hold) {
  const rank = morphRank(morph);
  const rows = [{ key: "gen_source", value: `${lot.wafer} · 12 sites` }];
  if (rank >= morphRank("issued")) {
    rows.push({ key: "gen_logic", value: lot.logic });
    rows.push({ key: "gen_hbm", value: lot.hbm.join(" · ") });
  } else {
    rows.push({ key: "gen_logic", value: "gen_pending" });
    rows.push({ key: "gen_hbm", value: "gen_pending" });
  }
  if (rank >= morphRank("bonded")) {
    rows.push({ key: "gen_bond", value: `${lot.wafer}-COW` });
  } else if (hold?.id === "overlay") {
    rows.push({ key: "gen_bond", value: "gen_bond_offset" });
  }
  if (rank >= morphRank("singulated")) {
    rows.push({ key: "gen_chip", value: `${lot.unit}-COW` });
  }
  if (rank >= morphRank("wos")) {
    rows.push({ key: "gen_sub", value: lot.substrate });
    rows.push({ key: "gen_asm", value: `${lot.unit}-WOS` });
  } else if (hold?.id === "warpage") {
    rows.push({ key: "gen_sub", value: `${lot.substrate} · HOLD` });
  }
  if (rank >= morphRank("packed")) {
    rows.push({ key: "gen_ball", value: "gen_ball_ok" });
    rows.push({ key: "gen_unit", value: lot.unit });
  } else if (hold?.id === "void") {
    rows.push({ key: "gen_ball", value: "gen_ball_void" });
  }
  return rows;
}

export function assertContract() {
  const errors = [];
  if (STATIONS.length !== 5) errors.push(`expected 5 stations, got ${STATIONS.length}`);
  const ids = new Set();
  const tools = new Set();
  STATIONS.forEach((s, i) => {
    if (ids.has(s.id)) errors.push(`duplicate station ${s.id}`);
    ids.add(s.id);
    if (tools.has(s.tool)) errors.push(`duplicate tool ${s.tool}`);
    tools.add(s.tool);
    for (const f of CONTRACT_FIELDS) {
      if (!(f in s.contract)) errors.push(`${s.id} missing contract.${f}`);
    }
    if (i === 0 && s.morphIn !== "bank") errors.push("route must start at bank");
    if (i === STATIONS.length - 1 && s.morphOut !== "packed") errors.push("route must end at packed");
    if (i > 0 && s.morphIn !== STATIONS[i - 1].morphOut) {
      errors.push(`${s.id} morphIn ${s.morphIn} does not follow ${STATIONS[i - 1].morphOut}`);
    }
    if (!MORPHS.includes(s.morphIn) || !MORPHS.includes(s.morphOut)) {
      errors.push(`${s.id} has a morph outside MORPHS`);
    }
  });
  if (!STATIONS[2].contract.hold) {
    /* dice hold is intentionally empty */
  } else errors.push("dice must not grow its own hold");
  for (const hold of Object.values(HOLDS)) {
    const st = stationById(hold.stationId);
    if (!st) errors.push(`hold ${hold.id} points at unknown station`);
    else if (hold.stationId === "dice") errors.push("dice station must not own a hold");
    if (!MORPHS.includes(hold.blocksMorph)) errors.push(`hold ${hold.id} blocks an unknown morph`);
  }
  const owned = new Set(Object.values(HOLDS).map((h) => h.stationId));
  for (const s of STATIONS) {
    if (s.contract.hold && !owned.has(s.id)) errors.push(`${s.id} contract names a hold that is not wired`);
    if (!s.contract.hold && owned.has(s.id)) errors.push(`${s.id} has a hold the contract does not name`);
  }
  if (ZONES.map((z) => z.id).join(",") !== "DBK,INT,SUB,FG") errors.push("warehouse zones drifted");
  if (INV_STATUS.join(",") !== "stock,reserved,transit,locked") errors.push("inventory status drifted");
  if (OHT_MODES.join(",") !== "AUTO,MANUAL,PAUSE") errors.push("crane modes drifted");
  if (VEHICLE_STATES.join(",") !== "idle,goto_pick,hoist_pick,travel,hoist_drop,paused") {
    errors.push("vehicle states drifted");
  }
  if (VEHICLE_IDS.length !== 2) errors.push("expected two overhead vehicles");
  const railIds = new Set(RAIL_NODES.map((n) => n.id));
  for (const [id, port] of Object.entries(PORTS)) {
    if (!railIds.has(port.rail)) errors.push(`port ${id} has no rail node`);
    if (!port.accept?.length) errors.push(`port ${id} accepts nothing`);
  }
  for (const s of STATIONS) {
    const reqs = DOCK_REQUIREMENTS[s.id];
    if (!reqs?.length) errors.push(`${s.id} has no dock requirement`);
    if (!OUTPUT_PRESENT[s.id]) errors.push(`${s.id} has no job-out presentation`);
    const xz = loadPortXZ(s);
    const node = RAIL_NODES.find((n) => n.id === s.tool);
    if (!node) errors.push(`${s.tool} is not on the rail`);
    else if (Math.hypot(node.x - xz.x, node.z - xz.z) > 0.2) {
      errors.push(`${s.tool} rail node is not on the load port`);
    }
  }
  const dieReq = DOCK_REQUIREMENTS.diebank.map((r) => r.zone).sort().join(",");
  if (dieReq !== "DBK,INT") errors.push("station 1 must issue KGD and the interposer only");
  if (DOCK_REQUIREMENTS.diebank.some((r) => r.zone === "SUB")) errors.push("substrate must not be issued at station 1");
  if (!DOCK_REQUIREMENTS.wos.some((r) => r.zone === "SUB" && r.type === "MAG")) {
    errors.push("substrate magazine must be issued before WoS");
  }
  if (PUTAWAY.zone !== "FG" || PUTAWAY.type !== "TRAY" || PUTAWAY.stationId !== "ballpack") {
    errors.push("finished trays put away to FG after pack");
  }
  if (OUTPUT_PRESENT.hbond.type !== "FRAME" || OUTPUT_PRESENT.wos.type !== "TRAY") {
    errors.push("job-out carrier presentation drifted");
  }
  return errors;
}
