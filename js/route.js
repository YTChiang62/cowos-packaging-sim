/**
 * HBX-100 route contract (trainer v4).
 *
 * One flow, five process bays, twenty-one operations. Genealogy, MES-style
 * status, the 3D morph state, recipes, the electronic warehouse, and the
 * overhead crane all read this module. Do not keep a second state machine.
 *
 * Morphology commits only when the operation that owns that morph finishes
 * with no open hold:
 *   bank → issued → bonded → thinned → singulated → wos → underfilled → balled → packed
 *
 * A hold freezes morphology at HOLD_AT of that operation and refuses an
 * overhead-crane delivery to any other process tool. The carrier stays at
 * the tool that detected the hold, or it may return to the stocker.
 *
 * The stocker at the head of the aisle is a facility, not a sixth bay.
 *
 * v4 relative to v3:
 * - The five stations are an ordered FLOW. Bays stay incoming, CoW, dice,
 *   WoS, and ball / final test / pack.
 * - PLS-11 is on this route. Plasma is a real tool.
 * - Bond-offset is detected at MET-23 (overlay), not at the bonder. Rework
 *   returns to HB-21, then anneal, then overlay. Thinned and singulated
 *   morphs stay uncommitted while the hold is open.
 * - Underfill void originates at UF-05. Rework retries underfill. The cured
 *   fillet (underfilled) is committed at CUR-06 only if the hold is clear.
 * - Warpage originates at MET-07. Balls stay off. Rework returns to WOS-04,
 *   then underfill, cure, and warpage.
 * - KGD shortage is still a die-bank issue refusal. The crane must not claim
 *   a KGD tray that was never issued.
 * - FRAME is presented at mount (job-out from the CoW side). It is not a
 *   warehouse zone. It stays the lot carrier until the WoS-side tray
 *   presentation. The empty frame then sits at the WoS unit port.
 * - The substrate magazine is issued before subbake, not at diebank.
 * - The lot record still tracks 12 sites. The 3D hero shows one stack plus
 *   three sibling units so singulation reads at camera distance.
 */

import { FLOW_ID, RECIPES, recipeById } from "./recipes.js";

export { FLOW_ID, RECIPES, recipeById };

export const MORPHS = [
  "bank",
  "issued",
  "bonded",
  "thinned",
  "singulated",
  "wos",
  "underfilled",
  "balled",
  "packed",
];

/** Process-beat fraction at which a planned hold freezes the operation. */
export const HOLD_AT = 0.42;

export const BAY_IDS = ["incoming", "cow", "dice", "wos", "pack"];

const NORTH_Z = -17.15;
const SOUTH_Z = 17.15;

function north(x, bay) {
  return { x, z: NORTH_Z, face: 1, bay };
}
function south(x, bay) {
  return { x, z: SOUTH_Z, face: -1, bay };
}

function op(spec) {
  return {
    duration: spec.duration,
    contract: {
      name: spec.name,
      carrier: spec.carrierText,
      in: spec.cin,
      changes: spec.changes,
      out: spec.cout,
      hold: spec.holdText,
    },
    id: spec.id,
    bay: spec.place.bay,
    stage: spec.place.bay,
    tool: spec.tool,
    recipe: spec.recipe,
    kind: spec.kind,
    duration: spec.duration,
    place: spec.place,
    carrier: spec.carrier,
    morphIn: spec.morphIn,
    morphOut: spec.morphOut,
  };
}

/** Ordered HBX-100 operations. This is the only process spine. */
export const FLOW = [
  op({
    id: "iqc",
    tool: "IQC-11",
    recipe: "IQC-INSP-01",
    kind: "inspect",
    duration: 2.8,
    place: north(-40, "incoming"),
    carrier: "FOUP",
    morphIn: "bank",
    morphOut: "bank",
    name: "Incoming inspection",
    carrierText: "Interposer FOUP",
    cin: "Interposer wafer still in the bank, KGD still in DBK",
    changes: "Inspect the interposer wafer. Sample plan covers KGD. No issue of dies, no stack.",
    cout: "FOUP released to the die bank. Morphology stays bank.",
    holdText: null,
  }),
  op({
    id: "diebank",
    tool: "DBK-02",
    recipe: "KGD-ISSUE-01",
    kind: "diebank",
    duration: 3.2,
    place: north(-33.5, "incoming"),
    carrier: "FOUP",
    morphIn: "bank",
    morphOut: "issued",
    name: "Die-bank issue",
    carrierText: "FOUP and die-bank tray",
    cin: "Inspected interposer FOUP and bare KGD still in DBK",
    changes: "Issue KGD onto the lot. Dies stay on one plane. No stack yet.",
    cout: "Issued KGD, ready for plasma and bond",
    holdText: "KGD shortage — warehouse refuses the issue; the crane must not claim a tray that was never issued",
  }),
  op({
    id: "plasma",
    tool: "PLS-11",
    recipe: "PLASMA-COW-01",
    kind: "plasma",
    duration: 2.8,
    place: north(-24, "cow"),
    carrier: "FOUP",
    morphIn: "issued",
    morphOut: "issued",
    name: "Plasma / surface activation",
    carrierText: "FOUP",
    cin: "Issued KGD and the interposer wafer",
    changes: "Plasma activates the bond surfaces. Morphology stays issued.",
    cout: "Activated wafer, still unbonded",
    holdText: null,
  }),
  op({
    id: "hbond",
    tool: "HB-21",
    recipe: "HBOND-COW-02",
    kind: "bonder",
    duration: 3.4,
    place: north(-18, "cow"),
    carrier: "FOUP",
    morphIn: "issued",
    morphOut: "bonded",
    name: "Hybrid bond",
    carrierText: "FOUP plus the target interposer wafer",
    cin: "Activated KGD and the target wafer",
    changes: "Hybrid-bond interface. A stacked die appears on the wafer (CoW).",
    cout: "Bonded stack with a visible bond plane",
    holdText: null,
  }),
  op({
    id: "anneal",
    tool: "ANN-22",
    recipe: "ANNEAL-COW-01",
    kind: "oven",
    duration: 3.0,
    place: north(-12, "cow"),
    carrier: "FOUP",
    morphIn: "bonded",
    morphOut: "bonded",
    name: "Post-bond anneal",
    carrierText: "FOUP",
    cin: "Bonded CoW wafer",
    changes: "Anneal. The bond plane may read more clearly. Morphology stays bonded.",
    cout: "Annealed CoW stack",
    holdText: null,
  }),
  op({
    id: "overlay",
    tool: "MET-23",
    recipe: "MET-OVL-01",
    kind: "metrology",
    duration: 2.8,
    place: north(-6, "cow"),
    carrier: "FOUP",
    morphIn: "bonded",
    morphOut: "bonded",
    name: "Overlay / bond metrology",
    carrierText: "FOUP",
    cin: "Annealed CoW wafer",
    changes: "Measure bond overlay. An offset hold freezes the lot here.",
    cout: "Overlay-accepted CoW wafer",
    holdText: "Bond offset — show the offset stack; do not commit thinned or singulated; do not deliver to backgrind",
  }),
  op({
    id: "backgrind",
    tool: "BG-24",
    recipe: "BG-COW-01",
    kind: "grinder",
    duration: 3.2,
    place: north(0, "cow"),
    carrier: "FOUP",
    morphIn: "bonded",
    morphOut: "thinned",
    name: "Backgrind",
    carrierText: "FOUP",
    cin: "Overlay-accepted CoW wafer",
    changes: "Grind the stack thinner.",
    cout: "Thinned CoW wafer",
    holdText: null,
  }),
  op({
    id: "mount",
    tool: "MNT-80",
    recipe: "MOUNT-01",
    kind: "mounter",
    duration: 2.8,
    place: south(-40, "dice"),
    carrier: "FRAME",
    morphIn: "thinned",
    morphOut: "thinned",
    name: "Tape mount",
    carrierText: "Dicing frame and tape",
    cin: "Thinned CoW wafer in a FOUP",
    changes: "Mount onto a dicing frame. The FOUP returns to INT. FRAME is not a warehouse zone.",
    cout: "Thinned wafer on a FRAME",
    holdText: null,
  }),
  op({
    id: "dice",
    tool: "DIC-81",
    recipe: "DICE-COW-01",
    kind: "dicer",
    duration: 3.4,
    place: south(-34, "dice"),
    carrier: "FRAME",
    morphIn: "thinned",
    morphOut: "singulated",
    name: "Dice",
    carrierText: "Dicing frame and tape",
    cin: "Thinned CoW wafer on a frame",
    changes: "Singulation. The wafer becomes individual stacks.",
    cout: "Singulated CoW units on the frame",
    holdText: null,
  }),
  op({
    id: "diceaoi",
    tool: "AOI-82",
    recipe: "AOI-DICE-01",
    kind: "inspect",
    duration: 2.6,
    place: south(-28, "dice"),
    carrier: "FRAME",
    morphIn: "singulated",
    morphOut: "singulated",
    name: "Post-dice inspection",
    carrierText: "Dicing frame",
    cin: "Singulated CoW units",
    changes: "Inspect chipping. Morphology stays singulated.",
    cout: "Inspected singulated units",
    holdText: null,
  }),
  op({
    id: "subbake",
    tool: "BAK-03",
    recipe: "BAKE-SUB-01",
    kind: "oven",
    duration: 3.0,
    place: south(-20, "wos"),
    carrier: "MAG",
    morphIn: "singulated",
    morphOut: "singulated",
    name: "Substrate pre-bake",
    carrierText: "Substrate magazine",
    cin: "Singulated units waiting on the frame; substrate still in SUB",
    changes: "Issue and bake the substrate magazine. Units stay singulated until attach.",
    cout: "Baked substrate magazine, ready for WoS",
    holdText: null,
  }),
  op({
    id: "wos",
    tool: "WOS-04",
    recipe: "WOS-ATTACH-01",
    kind: "wos",
    duration: 3.3,
    place: south(-14, "wos"),
    carrier: "TRAY",
    morphIn: "singulated",
    morphOut: "wos",
    name: "WoS attach",
    carrierText: "Substrate magazine, then a JEDEC tray",
    cin: "Singulated CoW on a frame and the baked substrate",
    changes: "TCB attach onto the package substrate. Tray is presented here; the magazine returns to SUB.",
    cout: "CoW-on-substrate assembly on a tray",
    holdText: null,
  }),
  op({
    id: "underfill",
    tool: "UF-05",
    recipe: "UF-DISP-01",
    kind: "dispense",
    duration: 3.0,
    place: south(-8, "wos"),
    carrier: "TRAY",
    morphIn: "wos",
    morphOut: "wos",
    name: "Underfill dispense",
    carrierText: "JEDEC tray",
    cin: "WoS assembly",
    changes: "Dispense underfill. A void hold freezes the lot before the fillet is complete.",
    cout: "Wet fillet, not yet cured",
    holdText: "Underfill void — do not complete a filled fillet, do not commit later morphs, do not deliver to cure",
  }),
  op({
    id: "ufcure",
    tool: "CUR-06",
    recipe: "UF-CURE-01",
    kind: "oven",
    duration: 2.8,
    place: south(-2, "wos"),
    carrier: "TRAY",
    morphIn: "wos",
    morphOut: "underfilled",
    name: "Underfill cure",
    carrierText: "JEDEC tray",
    cin: "Dispensed underfill",
    changes: "Cure. The fillet reads as cured when no void hold is open.",
    cout: "Cured underfill",
    holdText: null,
  }),
  op({
    id: "warpage",
    tool: "MET-07",
    recipe: "MET-WRP-01",
    kind: "metrology",
    duration: 2.6,
    place: south(4, "wos"),
    carrier: "TRAY",
    morphIn: "underfilled",
    morphOut: "underfilled",
    name: "Warpage metrology",
    carrierText: "JEDEC tray",
    cin: "Cured WoS assembly",
    changes: "Measure warpage. A hold here keeps balls from appearing.",
    cout: "Warpage-accepted assembly",
    holdText: "Warpage — balls must not appear; do not deliver to ball attach",
  }),
  op({
    id: "ball",
    tool: "BGA-51",
    recipe: "BALL-ATT-01",
    kind: "ball",
    duration: 3.2,
    place: south(12, "pack"),
    carrier: "TRAY",
    morphIn: "underfilled",
    morphOut: "balled",
    name: "Ball attach",
    carrierText: "JEDEC tray",
    cin: "Warpage-accepted assembly",
    changes: "Ball array appears.",
    cout: "Balled unit",
    holdText: null,
  }),
  op({
    id: "reflow",
    tool: "RFW-52",
    recipe: "REFLOW-BGA-01",
    kind: "oven",
    duration: 3.0,
    place: south(17, "pack"),
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
    name: "Ball reflow",
    carrierText: "JEDEC tray",
    cin: "Attached balls",
    changes: "Reflow the ball alloy. Morphology stays balled.",
    cout: "Reflowed balls",
    holdText: null,
  }),
  op({
    id: "fluxclean",
    tool: "CLN-53",
    recipe: "FLUX-CLN-01",
    kind: "clean",
    duration: 2.8,
    place: south(22, "pack"),
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
    name: "Flux clean",
    carrierText: "JEDEC tray",
    cin: "Reflowed unit",
    changes: "Clean flux. Morphology stays balled.",
    cout: "Cleaned unit",
    holdText: null,
  }),
  op({
    id: "ftest",
    tool: "TST-54",
    recipe: "FT-HBX-01",
    kind: "handler",
    duration: 3.4,
    place: south(27, "pack"),
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
    name: "Final test",
    carrierText: "JEDEC tray",
    cin: "Cleaned balled unit",
    changes: "Final test on 12 sites. Morphology stays balled.",
    cout: "Tested unit",
    holdText: null,
  }),
  op({
    id: "mark",
    tool: "MRK-55",
    recipe: "MARK-01",
    kind: "marker",
    duration: 2.6,
    place: south(32, "pack"),
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "balled",
    name: "Laser mark",
    carrierText: "JEDEC tray",
    cin: "Tested unit",
    changes: "Laser-mark a readable ID on the unit.",
    cout: "Marked unit",
    holdText: null,
  }),
  op({
    id: "pack",
    tool: "PCK-56",
    recipe: "PACK-TRAY-01",
    kind: "packer",
    duration: 3.2,
    place: south(37, "pack"),
    carrier: "TRAY",
    morphIn: "balled",
    morphOut: "packed",
    name: "Pack",
    carrierText: "JEDEC tray",
    cin: "Marked unit",
    changes: "Seat the unit in the JEDEC tray.",
    cout: "Packed tray, put away to FG",
    holdText: null,
  }),
];

/** @deprecated name kept so callers can keep saying "station". The spine is FLOW. */
export const STATIONS = FLOW;

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
    stationId: "overlay",
    variant: "offset",
    blocksMorph: "thinned",
    radio: "radioOverlayPE",
    actions: [
      { id: "rework", label: "hold_overlay_rework", hint: "hold_overlay_rework_s", role: null, backTo: "hbond" },
      { id: "scrap", label: "hold_overlay_scrap", hint: "hold_overlay_scrap_s", role: null, scrap: 2 },
      { id: "release", label: "hold_overlay_release", hint: "hold_overlay_release_s", role: "PE" },
    ],
  },
  warpage: {
    id: "warpage",
    stationId: "warpage",
    variant: "warp",
    blocksMorph: "balled",
    radio: "radioWarpPE",
    actions: [
      { id: "rework", label: "hold_warpage_rework", hint: "hold_warpage_rework_s", role: null, backTo: "wos" },
      { id: "bake", label: "hold_warpage_bake", hint: "hold_warpage_bake_s", role: null },
      { id: "scrap", label: "hold_warpage_scrap", hint: "hold_warpage_scrap_s", role: null, newSubstrate: true },
      { id: "release", label: "hold_warpage_release", hint: "hold_warpage_release_s", role: "PE" },
    ],
  },
  void: {
    id: "void",
    stationId: "underfill",
    variant: "void",
    blocksMorph: "underfilled",
    radio: "radioVoidMFG",
    actions: [
      { id: "rework", label: "hold_void_rework", hint: "hold_void_rework_s", role: null, backTo: "underfill" },
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
 * FG finished JEDEC trays. FRAME is not a zone.
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
 * One-way ceiling loop. North leg runs east from the stocker past incoming
 * and CoW. South leg runs west past pack, WoS, and dice. A vehicle may pass
 * a load port with the hoist up; it descends only at the assigned port.
 */
export const RAIL_NODES = [
  { id: "ioDBK", x: -46, z: -2.4 },
  { id: "ioINT", x: -46, z: -0.8 },
  { id: "ioSUB", x: -46, z: 0.8 },
  { id: "ioFG", x: -46, z: 2.4 },
  { id: "westN", x: -46, z: -15.6 },
  { id: "IQC-11", x: -40, z: -15.6 },
  { id: "DBK-02", x: -33.5, z: -15.6 },
  { id: "PLS-11", x: -24, z: -15.6 },
  { id: "HB-21", x: -18, z: -15.6 },
  { id: "ANN-22", x: -12, z: -15.6 },
  { id: "MET-23", x: -6, z: -15.6 },
  { id: "BG-24", x: 0, z: -15.6 },
  { id: "eastN", x: 42, z: -15.6 },
  { id: "eastS", x: 42, z: 15.6 },
  { id: "PCK-56", x: 37, z: 15.6 },
  { id: "MRK-55", x: 32, z: 15.6 },
  { id: "TST-54", x: 27, z: 15.6 },
  { id: "CLN-53", x: 22, z: 15.6 },
  { id: "RFW-52", x: 17, z: 15.6 },
  { id: "BGA-51", x: 12, z: 15.6 },
  { id: "MET-07", x: 4, z: 15.6 },
  { id: "CUR-06", x: -2, z: 15.6 },
  { id: "UF-05", x: -8, z: 15.6 },
  { id: "WOS-04", x: -14, z: 15.6 },
  { id: "BAK-03", x: -20, z: 15.6 },
  { id: "AOI-82", x: -28, z: 15.6 },
  { id: "DIC-81", x: -34, z: 15.6 },
  { id: "MNT-80", x: -40, z: 15.6 },
  { id: "westS", x: -46, z: 15.6 },
];

/** Local +Z of a tool's load port. World Z follows the station face. */
export const LOAD_LOCAL_Z = 1.55;

/**
 * Where a crane may drop a carrier, and which types that port accepts.
 * A mismatch is refused. Extra ports on one tool share that tool's rail node.
 */
export const PORTS = {
  "io:DBK": { accept: ["TRAY"], rail: "ioDBK", zone: "DBK", kind: "io" },
  "io:INT": { accept: ["FOUP"], rail: "ioINT", zone: "INT", kind: "io" },
  "io:SUB": { accept: ["MAG"], rail: "ioSUB", zone: "SUB", kind: "io" },
  "io:FG": { accept: ["TRAY"], rail: "ioFG", zone: "FG", kind: "io" },
  "IQC-11": { accept: ["FOUP"], rail: "IQC-11", tool: "IQC-11", stationId: "iqc", kind: "load" },
  "DBK-02": { accept: ["FOUP"], rail: "DBK-02", tool: "DBK-02", stationId: "diebank", kind: "load" },
  "DBK-02:tray": { accept: ["TRAY"], rail: "DBK-02", tool: "DBK-02", stationId: "diebank", kind: "load" },
  "PLS-11": { accept: ["FOUP"], rail: "PLS-11", tool: "PLS-11", stationId: "plasma", kind: "load" },
  "HB-21": { accept: ["FOUP"], rail: "HB-21", tool: "HB-21", stationId: "hbond", kind: "load" },
  "ANN-22": { accept: ["FOUP"], rail: "ANN-22", tool: "ANN-22", stationId: "anneal", kind: "load" },
  "MET-23": { accept: ["FOUP"], rail: "MET-23", tool: "MET-23", stationId: "overlay", kind: "load" },
  "BG-24": { accept: ["FOUP"], rail: "BG-24", tool: "BG-24", stationId: "backgrind", kind: "load" },
  "MNT-80": { accept: ["FOUP", "FRAME"], rail: "MNT-80", tool: "MNT-80", stationId: "mount", kind: "load" },
  "DIC-81": { accept: ["FRAME"], rail: "DIC-81", tool: "DIC-81", stationId: "dice", kind: "load" },
  "AOI-82": { accept: ["FRAME"], rail: "AOI-82", tool: "AOI-82", stationId: "diceaoi", kind: "load" },
  "BAK-03": { accept: ["MAG"], rail: "BAK-03", tool: "BAK-03", stationId: "subbake", kind: "load" },
  "WOS-04": { accept: ["MAG"], rail: "WOS-04", tool: "WOS-04", stationId: "wos", kind: "load" },
  "WOS-04:unit": { accept: ["FRAME"], rail: "WOS-04", tool: "WOS-04", stationId: "wos", kind: "load" },
  "WOS-04:out": { accept: ["TRAY"], rail: "WOS-04", tool: "WOS-04", stationId: "wos", kind: "load" },
  "UF-05": { accept: ["TRAY"], rail: "UF-05", tool: "UF-05", stationId: "underfill", kind: "load" },
  "CUR-06": { accept: ["TRAY"], rail: "CUR-06", tool: "CUR-06", stationId: "ufcure", kind: "load" },
  "MET-07": { accept: ["TRAY"], rail: "MET-07", tool: "MET-07", stationId: "warpage", kind: "load" },
  "BGA-51": { accept: ["TRAY"], rail: "BGA-51", tool: "BGA-51", stationId: "ball", kind: "load" },
  "RFW-52": { accept: ["TRAY"], rail: "RFW-52", tool: "RFW-52", stationId: "reflow", kind: "load" },
  "CLN-53": { accept: ["TRAY"], rail: "CLN-53", tool: "CLN-53", stationId: "fluxclean", kind: "load" },
  "TST-54": { accept: ["TRAY"], rail: "TST-54", tool: "TST-54", stationId: "ftest", kind: "load" },
  "MRK-55": { accept: ["TRAY"], rail: "MRK-55", tool: "MRK-55", stationId: "mark", kind: "load" },
  "PCK-56": { accept: ["TRAY"], rail: "PCK-56", tool: "PCK-56", stationId: "pack", kind: "load" },
};

/**
 * Carriers that must be handed off before that operation's process or morph
 * may start. `unlessLot` / `onlyLot` skip a requirement when a rework is
 * already traveling on a later carrier (the tray, after WoS).
 */
export const DOCK_REQUIREMENTS = {
  iqc: [
    { port: "IQC-11", type: "FOUP", role: "issue", zone: "INT", sku: "interposer", becomesLot: true },
  ],
  diebank: [
    { port: "DBK-02:tray", type: "TRAY", role: "issue", zone: "DBK", sku: "kgd" },
    { port: "DBK-02", type: "FOUP", role: "travel" },
  ],
  plasma: [{ port: "PLS-11", type: "FOUP", role: "travel" }],
  hbond: [{ port: "HB-21", type: "FOUP", role: "travel" }],
  anneal: [{ port: "ANN-22", type: "FOUP", role: "travel" }],
  overlay: [{ port: "MET-23", type: "FOUP", role: "travel" }],
  backgrind: [{ port: "BG-24", type: "FOUP", role: "travel" }],
  mount: [{ port: "MNT-80", type: "FOUP", role: "travel" }],
  dice: [{ port: "DIC-81", type: "FRAME", role: "travel" }],
  diceaoi: [{ port: "AOI-82", type: "FRAME", role: "travel" }],
  subbake: [
    { port: "BAK-03", type: "MAG", role: "issue", zone: "SUB", sku: "substrate" },
  ],
  wos: [
    { port: "WOS-04", type: "MAG", role: "follow", sku: "substrate", unlessLot: "TRAY" },
    { port: "WOS-04:unit", type: "FRAME", role: "travel", unlessLot: "TRAY" },
    { port: "WOS-04:out", type: "TRAY", role: "travel", onlyLot: "TRAY" },
  ],
  underfill: [{ port: "UF-05", type: "TRAY", role: "travel" }],
  ufcure: [{ port: "CUR-06", type: "TRAY", role: "travel" }],
  warpage: [{ port: "MET-07", type: "TRAY", role: "travel" }],
  ball: [{ port: "BGA-51", type: "TRAY", role: "travel" }],
  reflow: [{ port: "RFW-52", type: "TRAY", role: "travel" }],
  fluxclean: [{ port: "CLN-53", type: "TRAY", role: "travel" }],
  ftest: [{ port: "TST-54", type: "TRAY", role: "travel" }],
  mark: [{ port: "MRK-55", type: "TRAY", role: "travel" }],
  pack: [{ port: "PCK-56", type: "TRAY", role: "travel" }],
};

/** After pack, the finished JEDEC tray is put away to FG. */
export const PUTAWAY = { stationId: "pack", zone: "FG", port: "io:FG", type: "TRAY" };

/**
 * Job-out presentation. The traveling carrier waits at this port until a
 * crane picks it up. Mount converts the FOUP into a FRAME (FOUP returns to
 * INT). WoS converts the FRAME into a tray (magazine returns to SUB). The
 * empty frame is left at the WoS unit port; it is not a warehouse zone.
 */
export const OUTPUT_PRESENT = {
  iqc: { type: "FOUP", port: "IQC-11" },
  diebank: { type: "FOUP", port: "DBK-02", markKgd: true },
  plasma: { type: "FOUP", port: "PLS-11" },
  hbond: { type: "FOUP", port: "HB-21" },
  anneal: { type: "FOUP", port: "ANN-22" },
  overlay: { type: "FOUP", port: "MET-23" },
  backgrind: { type: "FOUP", port: "BG-24" },
  mount: {
    type: "FRAME",
    port: "MNT-80",
    convertFrom: "FOUP",
    returnZone: "INT",
    newSku: "cow",
    idPrefix: "FR-",
  },
  dice: { type: "FRAME", port: "DIC-81" },
  diceaoi: { type: "FRAME", port: "AOI-82" },
  subbake: { type: "MAG", port: "BAK-03", keepLot: true, sku: "substrate" },
  wos: {
    type: "TRAY",
    port: "WOS-04:out",
    convertFrom: "FRAME",
    returnSku: "substrate",
    returnZone: "SUB",
    retireFrame: true,
    framePort: "WOS-04:unit",
    newSku: "wip-tray",
    idPrefix: "JD-",
  },
  underfill: { type: "TRAY", port: "UF-05" },
  ufcure: { type: "TRAY", port: "CUR-06" },
  warpage: { type: "TRAY", port: "MET-07" },
  ball: { type: "TRAY", port: "BGA-51" },
  reflow: { type: "TRAY", port: "RFW-52" },
  fluxclean: { type: "TRAY", port: "CLN-53" },
  ftest: { type: "TRAY", port: "TST-54" },
  mark: { type: "TRAY", port: "MRK-55" },
  pack: { type: "TRAY", port: "PCK-56", sku: "finished" },
};

export function portAccepts(portId, type) {
  const port = PORTS[portId];
  return !!(port && port.accept.includes(type));
}

export function returnZoneFor(carrier) {
  if (!carrier) return null;
  if (carrier.type === "FRAME") return null;
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
  return FLOW.find((s) => s.id === id) || null;
}

export function stationByTool(tool) {
  return FLOW.find((s) => s.tool === tool) || null;
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
 * An open hold never commits the operation it froze, and therefore never
 * commits a later morph either.
 */
export function committedMorph(stepIndex, beatIndex, holdOpen, processBeatIndex) {
  let morph = FLOW[0].morphIn;
  for (let i = 0; i < FLOW.length; i++) {
    const passed = stepIndex > i || (stepIndex === i && beatIndex > processBeatIndex && !holdOpen);
    if (!passed) break;
    morph = FLOW[i].morphOut;
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

/** The operation that first commits `morph` (morphIn !== morphOut). */
export function opThatCommits(morph) {
  return FLOW.find((s) => s.morphOut === morph && s.morphIn !== s.morphOut) || null;
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
  if (hold?.id === "overlay") {
    rows.push({ key: "gen_bond", value: "gen_bond_offset" });
  } else if (rank >= morphRank("bonded")) {
    rows.push({ key: "gen_bond", value: `${lot.wafer}-COW` });
  }
  if (rank >= morphRank("thinned")) {
    rows.push({ key: "gen_thin", value: "gen_thin_ok" });
  }
  if (rank >= morphRank("singulated")) {
    rows.push({ key: "gen_chip", value: `${lot.unit}-COW` });
  }
  if (rank >= morphRank("wos")) {
    const sub = hold?.id === "warpage" ? `${lot.substrate} · HOLD` : lot.substrate;
    rows.push({ key: "gen_sub", value: sub });
    rows.push({ key: "gen_asm", value: `${lot.unit}-WOS` });
  }
  if (rank >= morphRank("underfilled")) {
    rows.push({ key: "gen_uf", value: "gen_uf_ok" });
  } else if (hold?.id === "void") {
    rows.push({ key: "gen_uf", value: "gen_uf_void" });
  }
  if (rank >= morphRank("balled")) {
    rows.push({ key: "gen_ball", value: "gen_ball_ok" });
  } else if (hold?.id === "void") {
    rows.push({ key: "gen_ball", value: "gen_ball_void" });
  }
  if (rank >= morphRank("packed")) {
    rows.push({ key: "gen_unit", value: lot.unit });
  }
  return rows;
}

const FLOW_ORDER = [
  "iqc", "diebank", "plasma", "hbond", "anneal", "overlay", "backgrind",
  "mount", "dice", "diceaoi", "subbake", "wos", "underfill", "ufcure", "warpage",
  "ball", "reflow", "fluxclean", "ftest", "mark", "pack",
];

export function assertContract() {
  const errors = [];
  if (FLOW.length !== 21) errors.push(`expected 21 operations, got ${FLOW.length}`);
  if (FLOW.map((s) => s.id).join(",") !== FLOW_ORDER.join(",")) errors.push("flow order drifted");
  if (MORPHS.join(",") !== "bank,issued,bonded,thinned,singulated,wos,underfilled,balled,packed") {
    errors.push("morph list drifted");
  }
  const ids = new Set();
  const tools = new Set();
  const recipes = new Set();
  FLOW.forEach((s, i) => {
    if (!BAY_IDS.includes(s.bay)) errors.push(`${s.id} is not in the five bays`);
    if (ids.has(s.id)) errors.push(`duplicate operation ${s.id}`);
    ids.add(s.id);
    if (tools.has(s.tool)) errors.push(`duplicate tool ${s.tool}`);
    tools.add(s.tool);
    if (recipes.has(s.recipe)) errors.push(`duplicate recipe ${s.recipe}`);
    recipes.add(s.recipe);
    for (const f of CONTRACT_FIELDS) {
      if (!(f in s.contract)) errors.push(`${s.id} missing contract.${f}`);
    }
    if (s.duration < 2.6 || s.duration > 3.4) errors.push(`${s.id} duration ${s.duration} is outside 2.6–3.4 s`);
    if (i === 0 && s.morphIn !== "bank") errors.push("route must start at bank");
    if (i === FLOW.length - 1 && s.morphOut !== "packed") errors.push("route must end at packed");
    if (i > 0 && s.morphIn !== FLOW[i - 1].morphOut) {
      errors.push(`${s.id} morphIn ${s.morphIn} does not follow ${FLOW[i - 1].morphOut}`);
    }
    if (!MORPHS.includes(s.morphIn) || !MORPHS.includes(s.morphOut)) {
      errors.push(`${s.id} has a morph outside MORPHS`);
    }
    const recipe = recipeById(s.recipe);
    if (!recipe) errors.push(`${s.id} has no recipe object`);
    else {
      if (recipe.op !== s.id) errors.push(`${s.recipe} is not tied to ${s.id}`);
      if (recipe.tool !== s.tool) errors.push(`${s.recipe} is not tied to ${s.tool}`);
      if (recipe.flow !== FLOW_ID) errors.push(`${s.recipe} is not on ${FLOW_ID}`);
      if (!Array.isArray(recipe.params) || recipe.params.length < 3 || recipe.params.length > 6) {
        errors.push(`${s.recipe} needs 3–6 parameters`);
      } else {
        for (const param of recipe.params) {
          if (!param.name || param.value == null || !("unit" in param)) {
            errors.push(`${s.recipe} parameter is missing name, value, or unit`);
          }
        }
      }
    }
  });
  for (const morph of ["issued", "bonded", "thinned", "singulated", "wos", "underfilled", "balled", "packed"]) {
    if (!opThatCommits(morph)) errors.push(`no operation commits ${morph}`);
  }
  if (opThatCommits("issued")?.id !== "diebank") errors.push("issued must commit at diebank");
  if (opThatCommits("bonded")?.id !== "hbond") errors.push("bonded must commit at hbond");
  if (opThatCommits("thinned")?.id !== "backgrind") errors.push("thinned must commit at backgrind");
  if (opThatCommits("singulated")?.id !== "dice") errors.push("singulated must commit at dice");
  if (opThatCommits("wos")?.id !== "wos") errors.push("wos must commit at wos");
  if (opThatCommits("underfilled")?.id !== "ufcure") errors.push("underfilled must commit at ufcure");
  if (opThatCommits("balled")?.id !== "ball") errors.push("balled must commit at ball");
  if (opThatCommits("packed")?.id !== "pack") errors.push("packed must commit at pack");
  if (stationById("dice").contract.hold) errors.push("dice must not grow its own hold");
  if (stationById("iqc").contract.hold) errors.push("iqc must not grow its own hold");
  const expectHold = { kgd: "diebank", overlay: "overlay", void: "underfill", warpage: "warpage" };
  const expectBlock = { kgd: "issued", overlay: "thinned", void: "underfilled", warpage: "balled" };
  const expectRework = { overlay: "hbond", void: "underfill", warpage: "wos" };
  for (const [id, stationId] of Object.entries(expectHold)) {
    const hold = HOLDS[id];
    if (!hold) errors.push(`missing hold ${id}`);
    else {
      if (hold.stationId !== stationId) errors.push(`hold ${id} is not on ${stationId}`);
      if (hold.blocksMorph !== expectBlock[id]) errors.push(`hold ${id} blocks the wrong morph`);
      if (!MORPHS.includes(hold.blocksMorph)) errors.push(`hold ${id} blocks an unknown morph`);
    }
  }
  for (const [id, back] of Object.entries(expectRework)) {
    const action = HOLDS[id]?.actions.find((a) => a.id === "rework");
    if (action?.backTo !== back) errors.push(`hold ${id} rework must return to ${back}`);
  }
  const owned = new Set(Object.values(HOLDS).map((h) => h.stationId));
  for (const s of FLOW) {
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
  if (railIds.size !== RAIL_NODES.length) errors.push("duplicate rail node");
  for (const [id, port] of Object.entries(PORTS)) {
    if (!railIds.has(port.rail)) errors.push(`port ${id} has no rail node`);
    if (!port.accept?.length) errors.push(`port ${id} accepts nothing`);
  }
  for (const s of FLOW) {
    const reqs = DOCK_REQUIREMENTS[s.id];
    if (!reqs?.length) errors.push(`${s.id} has no dock requirement`);
    if (!OUTPUT_PRESENT[s.id]) errors.push(`${s.id} has no job-out presentation`);
    const xz = loadPortXZ(s);
    const node = RAIL_NODES.find((n) => n.id === s.tool);
    if (!node) errors.push(`${s.tool} is not on the rail`);
    else if (Math.hypot(node.x - xz.x, node.z - xz.z) > 0.2) {
      errors.push(`${s.tool} rail node is not on the load port`);
    }
    if (!PORTS[s.tool]) errors.push(`${s.tool} has no load port`);
  }
  const incomingZones = ["iqc", "diebank"].flatMap((id) =>
    (DOCK_REQUIREMENTS[id] || []).map((r) => r.zone).filter(Boolean)
  );
  if (incomingZones.includes("SUB")) errors.push("substrate must not be issued in the incoming bay");
  if (!DOCK_REQUIREMENTS.iqc.some((r) => r.zone === "INT" && r.type === "FOUP")) {
    errors.push("IQC must dock the interposer FOUP");
  }
  if (!DOCK_REQUIREMENTS.diebank.some((r) => r.zone === "DBK" && r.sku === "kgd")) {
    errors.push("diebank must issue KGD");
  }
  if (!DOCK_REQUIREMENTS.diebank.some((r) => r.type === "FOUP" && r.role === "travel")) {
    errors.push("diebank must receive the interposer FOUP");
  }
  if (!DOCK_REQUIREMENTS.subbake.some((r) => r.zone === "SUB" && r.type === "MAG")) {
    errors.push("substrate magazine must be issued before subbake");
  }
  if (DOCK_REQUIREMENTS.wos.some((r) => r.role === "issue")) {
    errors.push("substrate is issued at subbake, not again at WoS");
  }
  if (PUTAWAY.zone !== "FG" || PUTAWAY.type !== "TRAY" || PUTAWAY.stationId !== "pack") {
    errors.push("finished trays put away to FG after pack");
  }
  if (OUTPUT_PRESENT.mount.type !== "FRAME" || OUTPUT_PRESENT.mount.returnZone !== "INT") {
    errors.push("FRAME must be presented at mount, and the FOUP returns to INT");
  }
  if (OUTPUT_PRESENT.wos.type !== "TRAY") errors.push("WoS must present a tray");
  if (ZONES.some((z) => z.carrier === "FRAME")) errors.push("FRAME must not be a warehouse zone");
  return errors;
}
