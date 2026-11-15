/**
 * Frozen HBX-100 route contract (trainer v2).
 *
 * One short route. Five stations. Genealogy, MES-style status, and the 3D
 * morph state all read this table — do not add a station here.
 *
 * Morphology commits only when that station's process finishes with no open
 * hold:
 *   bank → issued → bonded → singulated → wos → packed
 *
 * A hold keeps the lot on its station. `blocksMorph` is the first morphology
 * that must not be committed while the hold is open (every later morphology
 * is blocked with it).
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
  return errors;
}
