/**
 * HBX-100-COW-WOS recipes. One object per operation.
 * Parameters are fictional training values, not a production recipe card.
 * `name` is the English label; the UI translates `p_<id>`.
 */

export const FLOW_ID = "HBX-100-COW-WOS";

function p(id, name, value, unit) {
  return { id, name, value, unit };
}

export const RECIPES = {
  "IQC-INSP-01": {
    id: "IQC-INSP-01",
    flow: FLOW_ID,
    op: "iqc",
    tool: "IQC-11",
    params: [
      p("sample", "Sample size", 5, "pcs"),
      p("program", "Inspect program", "HBX-IQC-A", ""),
      p("accept", "Accept criteria", "0 fail", ""),
    ],
  },
  "KGD-ISSUE-01": {
    id: "KGD-ISSUE-01",
    flow: FLOW_ID,
    op: "diebank",
    tool: "DBK-02",
    params: [
      p("qty", "Issue qty", 12, "die"),
      p("map", "Tray map", "HBX-WFL-4", ""),
      p("fifo", "FIFO rule", "FIFO", ""),
    ],
  },
  "PLASMA-COW-01": {
    id: "PLASMA-COW-01",
    flow: FLOW_ID,
    op: "plasma",
    tool: "PLS-11",
    params: [
      p("gas", "Gas", "Ar/H2", ""),
      p("power", "Power", 280, "W"),
      p("time", "Time", 45, "s"),
      p("pressure", "Pressure", 80, "mTorr"),
    ],
  },
  "HBOND-COW-02": {
    id: "HBOND-COW-02",
    flow: FLOW_ID,
    op: "hbond",
    tool: "HB-21",
    params: [
      p("force", "Bond force", 40, "N"),
      p("temp", "Bond temp", 250, "°C"),
      p("align", "Align tolerance", 0.5, "µm"),
      p("dwell", "Dwell", 8, "s"),
    ],
  },
  "ANNEAL-COW-01": {
    id: "ANNEAL-COW-01",
    flow: FLOW_ID,
    op: "anneal",
    tool: "ANN-22",
    params: [
      p("temp", "Temp", 300, "°C"),
      p("time", "Time", 30, "min"),
      p("atmosphere", "Atmosphere", "N2", ""),
    ],
  },
  "MET-OVL-01": {
    id: "MET-OVL-01",
    flow: FLOW_ID,
    op: "overlay",
    tool: "MET-23",
    params: [
      p("limit", "Overlay limit", 1.0, "µm"),
      p("sites", "Sample sites", 9, "site"),
      p("wave", "Wavelength", 633, "nm"),
    ],
  },
  "BG-COW-01": {
    id: "BG-COW-01",
    flow: FLOW_ID,
    op: "backgrind",
    tool: "BG-24",
    params: [
      p("thick", "Target thickness", 80, "µm"),
      p("rpm", "Spindle speed", 1800, "rpm"),
      p("feed", "Feed", 0.4, "µm/s"),
    ],
  },
  "MOUNT-01": {
    id: "MOUNT-01",
    flow: FLOW_ID,
    op: "mount",
    tool: "MNT-80",
    params: [
      p("tape", "Tape type", "UV-dicing", ""),
      p("temp", "Mount temp", 60, "°C"),
      p("frame", "Frame", 300, "mm"),
    ],
  },
  "DICE-COW-01": {
    id: "DICE-COW-01",
    flow: FLOW_ID,
    op: "dice",
    tool: "DIC-81",
    params: [
      p("blade", "Blade", "NBC-ZH05", ""),
      p("feed", "Feed", 40, "mm/s"),
      p("street", "Street width", 80, "µm"),
    ],
  },
  "AOI-DICE-01": {
    id: "AOI-DICE-01",
    flow: FLOW_ID,
    op: "diceaoi",
    tool: "AOI-82",
    params: [
      p("program", "Inspect program", "HBX-DICE-AOI", ""),
      p("chip", "Chipping limit", 15, "µm"),
      p("mag", "Magnification", 20, "×"),
    ],
  },
  "BAKE-SUB-01": {
    id: "BAKE-SUB-01",
    flow: FLOW_ID,
    op: "subbake",
    tool: "BAK-03",
    params: [
      p("temp", "Temp", 125, "°C"),
      p("time", "Time", 4, "h"),
      p("atmosphere", "Atmosphere", "N2", ""),
    ],
  },
  "WOS-ATTACH-01": {
    id: "WOS-ATTACH-01",
    flow: FLOW_ID,
    op: "wos",
    tool: "WOS-04",
    params: [
      p("force", "Attach force", 8, "N"),
      p("temp", "Attach temp", 280, "°C"),
      p("place", "Placement accuracy", 5, "µm"),
    ],
  },
  "UF-DISP-01": {
    id: "UF-DISP-01",
    flow: FLOW_ID,
    op: "underfill",
    tool: "UF-05",
    params: [
      p("volume", "Volume", 18, "mg"),
      p("pattern", "Pattern", "I-line", ""),
      p("visc", "Viscosity class", "UF-A", ""),
    ],
  },
  "UF-CURE-01": {
    id: "UF-CURE-01",
    flow: FLOW_ID,
    op: "ufcure",
    tool: "CUR-06",
    params: [
      p("profile", "Temp profile", "UF-RAMP-150", ""),
      p("time", "Time", 90, "min"),
      p("peak", "Peak temp", 150, "°C"),
    ],
  },
  "MET-WRP-01": {
    id: "MET-WRP-01",
    flow: FLOW_ID,
    op: "warpage",
    tool: "MET-07",
    params: [
      p("limit", "Warpage limit", 80, "µm"),
      p("sites", "Sample sites", 5, "site"),
      p("temp", "Temperature", 25, "°C"),
    ],
  },
  "BALL-ATT-01": {
    id: "BALL-ATT-01",
    flow: FLOW_ID,
    op: "ball",
    tool: "BGA-51",
    params: [
      p("alloy", "Ball alloy", "SAC305", ""),
      p("pitch", "Pitch", 0.4, "mm"),
      p("count", "Ball count", 36, "ea"),
    ],
  },
  "REFLOW-BGA-01": {
    id: "REFLOW-BGA-01",
    flow: FLOW_ID,
    op: "reflow",
    tool: "RFW-52",
    params: [
      p("peak", "Peak temp", 245, "°C"),
      p("profile", "Profile name", "SAC-245", ""),
      p("tal", "Time above liquidus", 60, "s"),
    ],
  },
  "FLUX-CLN-01": {
    id: "FLUX-CLN-01",
    flow: FLOW_ID,
    op: "fluxclean",
    tool: "CLN-53",
    params: [
      p("chem", "Chemistry", "DI/saponifier", ""),
      p("time", "Time", 8, "min"),
      p("temp", "Temp", 60, "°C"),
    ],
  },
  "FT-HBX-01": {
    id: "FT-HBX-01",
    flow: FLOW_ID,
    op: "ftest",
    tool: "TST-54",
    params: [
      p("program", "Test program", "FT-HBX100-A3", ""),
      p("temp", "Temp", 25, "°C"),
      p("sites", "Site count", 12, "site"),
    ],
  },
  "MARK-01": {
    id: "MARK-01",
    flow: FLOW_ID,
    op: "mark",
    tool: "MRK-55",
    params: [
      p("content", "Mark content", "HBX100", ""),
      p("template", "Template", "LASER-2L", ""),
      p("power", "Power", 8, "W"),
    ],
  },
  "PACK-TRAY-01": {
    id: "PACK-TRAY-01",
    flow: FLOW_ID,
    op: "pack",
    tool: "PCK-56",
    params: [
      p("tray", "Tray type", "JEDEC", ""),
      p("qty", "Pack qty", 12, "unit"),
      p("orient", "Orientation", "pin1-A1", ""),
    ],
  },
};

export function recipeById(id) {
  return RECIPES[id] || null;
}
