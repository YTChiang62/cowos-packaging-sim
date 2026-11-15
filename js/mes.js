export const BEATS = ["prepare", "transport", "job-in", "process", "job-out", "track-out"];

export const STAGES = [
  { id: "incoming", color: "#d3925a" },
  { id: "cow", color: "#3ee0c0" },
  { id: "dice", color: "#8aa0ff" },
  { id: "wos", color: "#e0a15a" },
  { id: "test", color: "#5ee0c8" },
  { id: "pack", color: "#d7c4a0" },
];

export const STEPS = [
  { id: "recv", stage: "incoming", tool: "INB-01", recipe: "IPW-RECV-01", carrier: "FOUP", process: 1.6, kind: "dock" },
  { id: "kit", stage: "incoming", tool: "DBK-02", recipe: "KIT-HBX100", carrier: "FOUP", process: 1.8, kind: "bank" },
  { id: "plasma", stage: "cow", tool: "PLM-11", recipe: "PLASMA-COW-A", carrier: "FOUP", process: 1.7, kind: "plasma" },
  { id: "hbond", stage: "cow", tool: "HB-21", recipe: "HBOND-DTW-02", carrier: "FOUP", process: 2.4, kind: "bonder" },
  { id: "axi", stage: "cow", tool: "AXI-31", recipe: "AXI-COW-01", carrier: "FOUP", process: 1.6, kind: "inspect" },
  { id: "cuf", stage: "cow", tool: "CUF-41", recipe: "CUF-COW-02", carrier: "FOUP", process: 2.0, kind: "dispense" },
  { id: "mold", stage: "cow", tool: "MOL-51", recipe: "MOLD-WL-01", carrier: "FOUP", process: 2.0, kind: "mold" },
  { id: "grind", stage: "grind", tool: "GRD-61", recipe: "GRIND-RV-01", carrier: "FOUP", process: 1.8, kind: "grind" },
  { id: "cowtest", stage: "grind", tool: "CWT-71", recipe: "TEST-COW-B", carrier: "FOUP", process: 1.8, kind: "tester" },
  { id: "dice", stage: "dice", tool: "DIC-81", recipe: "DICE-COW-01", carrier: "TRAY", process: 2.2, kind: "dicer" },
  { id: "fc", stage: "wos", tool: "FC-91", recipe: "FC-WOS-02", carrier: "TRAY", process: 2.2, kind: "flipchip", also: "MAG" },
  { id: "uf", stage: "wos", tool: "UF-92", recipe: "UF-WOS-01", carrier: "TRAY", process: 1.8, kind: "dispense" },
  { id: "lid", stage: "wos", tool: "LID-93", recipe: "LID-TIM-01", carrier: "TRAY", process: 1.6, kind: "lid" },
  { id: "ball", stage: "wos", tool: "BGA-94", recipe: "BALL-WOS-01", carrier: "TRAY", process: 1.8, kind: "ball" },
  { id: "csam", stage: "wos", tool: "SAM-95", recipe: "CSAM-01", carrier: "TRAY", process: 1.6, kind: "inspect" },
  { id: "ft", stage: "test", tool: "FTS-A1", recipe: "FT-HBX100", carrier: "TRAY", process: 2.0, kind: "tester" },
  { id: "mark", stage: "test", tool: "MRK-A2", recipe: "MARK-01", carrier: "TRAY", process: 1.3, kind: "mark" },
  { id: "pack", stage: "pack", tool: "PAK-A3", recipe: "PACK-SHIP", carrier: "REEL", process: 1.6, kind: "pack" },
];

export const TOOLS = STEPS.map((s) => ({
  id: s.tool,
  stepId: s.id,
  stage: s.stage,
  kind: s.kind,
  recipe: s.recipe,
}));

const HOLD_DEFS = {
  kgd: {
    stepId: "kit",
    radio: "radioKgdEE",
    actions: [
      { id: "wait", label: "hold_kgd_wait", hint: "hold_kgd_wait_s", role: null },
      { id: "partial", label: "hold_kgd_partial", hint: "hold_kgd_partial_s", role: "PE" },
    ],
  },
  overlay: {
    stepId: "hbond",
    radio: "radioOverlayPE",
    actions: [
      { id: "rework", label: "hold_overlay_rework", hint: "hold_overlay_rework_s", role: null, backTo: "plasma" },
      { id: "scrap", label: "hold_overlay_scrap", hint: "hold_overlay_scrap_s", role: null, scrap: 2 },
      { id: "release", label: "hold_overlay_release", hint: "hold_overlay_release_s", role: "PE" },
    ],
  },
  void: {
    stepId: "cuf",
    radio: "radioVoidMFG",
    actions: [
      { id: "rework", label: "hold_void_rework", hint: "hold_void_rework_s", role: null, backTo: "cuf" },
      { id: "scrap", label: "hold_void_scrap", hint: "hold_void_scrap_s", role: null, scrap: 1 },
      { id: "release", label: "hold_void_release", hint: "hold_void_release_s", role: "PE" },
    ],
  },
  warpage: {
    stepId: "fc",
    radio: "radioWarpPE",
    actions: [
      { id: "bake", label: "hold_warpage_bake", hint: "hold_warpage_bake_s", role: null },
      { id: "scrap", label: "hold_warpage_scrap", hint: "hold_warpage_scrap_s", role: null, newSubstrate: true },
      { id: "release", label: "hold_warpage_release", hint: "hold_warpage_release_s", role: "PE" },
    ],
  },
};

function planHolds(intensity) {
  if (intensity === "none") return [];
  if (intensity === "few") return ["kgd", "void"];
  return ["kgd", "overlay", "void", "warpage"];
}

function pad(n, w = 4) {
  return String(n).padStart(w, "0");
}

function makeLot() {
  const n = 100 + Math.floor(Math.random() * 8900);
  const w = 20 + Math.floor(Math.random() * 80);
  const logic = 4000 + Math.floor(Math.random() * 5000);
  const hbmBase = 7000 + Math.floor(Math.random() * 2000);
  const sub = 300 + Math.floor(Math.random() * 600);
  return {
    id: `APX2602-${pad(n)}`,
    product: "HBX-100",
    wafer: `IPW-2602-${pad(w, 3)}`,
    logic: `LGC-KGD-${logic}`,
    hbm: [0, 1, 2, 3].map((i) => `HBM-${hbmBase}-${pad(i + 1, 2)}`),
    substrate: `OSB-88-${pad(sub, 3)}`,
    unit: `HBX100-2602-${pad(n)}`,
    kitIssued: false,
    cowDone: false,
    diced: false,
    mounted: false,
    packed: false,
    totalSites: 12,
    goodSites: 12,
    scrap: 0,
    history: [],
    notes: [],
  };
}

export class Session {
  constructor({ intensity = "few", role = "MFG" } = {}) {
    this.intensity = intensity;
    this.role = role;
    this.speed = 1;
    this.auto = false;
    this.mode = "station";
    this.stepIndex = 0;
    this.beatIndex = 0;
    this.status = "QUEUE";
    this.busy = false;
    this.hold = null;
    this.holdsResolved = [];
    this.plannedHolds = new Set(planHolds(intensity));
    this.firedHolds = new Set();
    this.lot = makeLot();
    this.listeners = new Map();
    this._acc = 0;
    this._goal = 0;
    this._awaitingTransport = false;
    this._chain = false;
    this._holdResume = false;
    this.processProgress = 0;
  }

  on(evt, fn) {
    const arr = this.listeners.get(evt) || [];
    arr.push(fn);
    this.listeners.set(evt, arr);
    return () => {
      this.listeners.set(evt, (this.listeners.get(evt) || []).filter((f) => f !== fn));
    };
  }

  emit(evt, payload) {
    (this.listeners.get(evt) || []).forEach((fn) => fn(payload));
  }

  step() {
    return STEPS[this.stepIndex] || STEPS[STEPS.length - 1];
  }

  snapshot() {
    return {
      lot: this.lot,
      step: this.step(),
      stepIndex: this.stepIndex,
      beat: BEATS[this.beatIndex],
      beatIndex: this.beatIndex,
      status: this.status,
      busy: this.busy,
      auto: this.auto,
      mode: this.mode,
      speed: this.speed,
      role: this.role,
      hold: this.hold,
      processProgress: this.processProgress,
      holdsResolved: this.holdsResolved.slice(),
    };
  }

  change() {
    this.emit("change", this.snapshot());
  }

  setRole(role) {
    this.role = role;
    this.change();
  }

  setMode(mode) {
    this.mode = mode;
    this.change();
  }

  setSpeed(speed) {
    this.speed = speed;
    this.change();
  }

  setAuto(on) {
    if (this.status === "DONE") return;
    this.auto = on;
    if (on && !this.busy && !this.hold) this.advance();
    this.change();
  }

  advance() {
    if (this.status === "DONE") {
      this.emit("toast", { key: "alreadyDone" });
      return false;
    }
    if (this.hold) {
      this.emit("toast", { key: "onHold" });
      return false;
    }
    if (this.busy) return false;
    this._chain = this.mode === "station" || this.auto;
    this._startBeat();
    return true;
  }

  prevBeat() {
    if (this.busy || this.hold || this.status === "DONE") return false;
    if (this.mode !== "beat") return false;
    if (this.beatIndex <= 0 && this.stepIndex <= 0) return false;
    if (this.beatIndex > 0) this.beatIndex -= 1;
    else {
      this.stepIndex -= 1;
      this.beatIndex = 0;
    }
    this.status = this.beatIndex === 0 ? "QUEUE" : "RUN";
    this.change();
    return true;
  }

  _startBeat() {
    const beat = BEATS[this.beatIndex];
    const step = this.step();
    this.busy = true;
    this.status = "RUN";
    this.processProgress = 0;

    if (beat === "transport") {
      this._awaitingTransport = true;
      this._acc = 0;
      this._goal = 0;
      this.change();
      this.emit("transport", {
        fromIndex: Math.max(0, this.stepIndex - (this.beatIndex === 1 ? 1 : 0)),
        to: step,
        carrier: this.displayCarrier(),
      });
      return;
    }

    const durations = {
      prepare: 0.55,
      "job-in": 0.45,
      process: step.process,
      "job-out": 0.4,
      "track-out": 0.4,
    };
    this._acc = 0;
    this._goal = durations[beat] || 0.5;
    this.change();
    this.emit("beat", { beat, step });
  }

  transportDone() {
    if (!this._awaitingTransport) return;
    this._awaitingTransport = false;
    this._finishBeat();
  }

  tick(dt) {
    if (this.hold && this.hold.waiting) {
      this._acc += dt * this.speed;
      if (this._acc >= this._goal) {
        this.hold.waiting = false;
        this._clearHold("wait");
      }
      return;
    }
    if (!this.busy || this._awaitingTransport || this.hold) return;
    this._acc += dt * this.speed;
    const beat = BEATS[this.beatIndex];
    if (beat === "process") {
      this.processProgress = Math.min(1, this._acc / this._goal);
      this.emit("progress", this.processProgress);
      if (!this.firedHolds.has(this.step().id) && this.processProgress >= 0.42) {
        const hid = Object.keys(HOLD_DEFS).find(
          (id) => HOLD_DEFS[id].stepId === this.step().id && this.plannedHolds.has(id)
        );
        if (hid) {
          this.firedHolds.add(this.step().id);
          this._openHold(hid);
          return;
        }
      }
    }
    if (this._acc >= this._goal) this._finishBeat();
  }

  _openHold(id) {
    const def = HOLD_DEFS[id];
    this.hold = { id, ...def, waiting: false };
    this.busy = false;
    this.auto = false;
    this._chain = false;
    this.status = "HOLD";
    this.change();
    this.emit("hold", this.hold);
    this.emit("radio", def.radio);
  }

  resolve(actionId) {
    if (!this.hold) return { ok: false };
    const action = this.hold.actions.find((a) => a.id === actionId);
    if (!action) return { ok: false };
    if (action.role && this.role !== action.role) {
      this.emit("toast", { key: "needPE" });
      return { ok: false, needPE: true };
    }

    if (action.id === "wait") {
      this.hold.waiting = true;
      this._acc = 0;
      this._goal = 2.2;
      this.emit("toast", { key: "waitingMaterial" });
      this.change();
      return { ok: true, pending: true };
    }

    if (action.id === "partial") {
      this.lot.goodSites = Math.max(8, this.lot.goodSites - 3);
      this.lot.notes.push("partial-kit");
      this.lot.kitIssued = true;
      this._clearHold("partial");
      this.emit("toast", { key: "toastScrap", vars: { n: 3 } });
      return { ok: true };
    }

    if (action.id === "rework") {
      const back = STEPS.findIndex((s) => s.id === action.backTo);
      this.holdsResolved.push({ id: this.hold.id, action: "rework" });
      this.hold = null;
      this.status = "QUEUE";
      this.stepIndex = back >= 0 ? back : this.stepIndex;
      this.beatIndex = 0;
      this.busy = false;
      this._chain = false;
      const nameKey = `step_${this.step().id}`;
      this.emit("toast", { key: "toastRework", vars: { step: nameKey } });
      this.change();
      this.emit("resolved", { rework: true });
      return { ok: true };
    }

    if (action.id === "scrap") {
      if (action.newSubstrate) {
        const sub = 300 + Math.floor(Math.random() * 600);
        this.lot.substrate = `OSB-88-${pad(sub, 3)}`;
        this.lot.notes.push("substrate-replaced");
      } else {
        const n = action.scrap || 1;
        this.lot.scrap += n;
        this.lot.goodSites = Math.max(0, this.lot.goodSites - n);
        this.emit("toast", { key: "toastScrap", vars: { n } });
      }
      this._clearHold("scrap");
      return { ok: true };
    }

    if (action.id === "bake") {
      this.holdsResolved.push({ id: this.hold.id, action: "bake" });
      this.hold = null;
      this.status = "QUEUE";
      this.beatIndex = 0;
      this.busy = false;
      this._chain = false;
      this.lot.notes.push("bake-flatten");
      this.emit("toast", { key: "bakeHold" });
      this.change();
      this.emit("resolved", { bake: true });
      return { ok: true };
    }

    if (action.id === "release") {
      this.lot.notes.push(`pe-release:${this.hold.id}`);
      this.emit("toast", { key: "toastRelease" });
      this._clearHold("release");
      return { ok: true };
    }

    return { ok: false };
  }

  _clearHold(action) {
    this.holdsResolved.push({ id: this.hold.id, action });
    this.hold = null;
    this.status = "RUN";
    this.busy = true;
    this._holdResume = true;
    this._chain = this.mode === "station";
    if (action === "wait") this.emit("toast", { key: "toastWait" });
    // Resume remaining process time
    this._acc = Math.max(this._acc, this._goal * 0.5);
    this.change();
    this.emit("resolved", { action });
  }

  _finishBeat() {
    const beat = BEATS[this.beatIndex];
    const step = this.step();

    if (beat === "job-in") {
      this.emit("seated", { tool: step.tool });
    }
    if (beat === "process") {
      this.processProgress = 1;
      this._applyProcessEffects(step);
    }
    if (beat === "track-out") {
      if (this.stepIndex >= STEPS.length - 1) {
        this.lot.packed = true;
        this.status = "DONE";
        this.busy = false;
        this.auto = false;
        this._chain = false;
        this.beatIndex = BEATS.length - 1;
        this.change();
        this.emit("complete", this.snapshot());
        return;
      }
      this.stepIndex += 1;
      this.beatIndex = 0;
      this.status = "QUEUE";
      this.busy = false;
      this.processProgress = 0;
      this.change();
      this.emit("tracked", this.snapshot());
      if (this.auto || this._chain) {
        this._chain = this.auto || this.mode === "station";
        // In station mode, stop at the next station unless auto
        if (this.auto) this.advance();
      }
      return;
    }

    this.beatIndex += 1;
    this.busy = false;
    this.change();
    if (this._chain || this.auto) this.advance();
  }

  _applyProcessEffects(step) {
    const lot = this.lot;
    if (step.id === "kit") lot.kitIssued = true;
    if (step.id === "cowtest") lot.cowDone = true;
    if (step.id === "dice") lot.diced = true;
    if (step.id === "fc") lot.mounted = true;
    if (step.id === "pack") lot.packed = true;
  }

  displayCarrier() {
    const step = this.step();
    if (this.beatIndex < 2 && this.stepIndex > 0) {
      return STEPS[this.stepIndex - 1].carrier;
    }
    // During later beats, show the destination carrier after process on dice/pack
    if ((step.id === "dice" || step.id === "pack") && this.beatIndex >= 4) return step.carrier;
    if (this.stepIndex === 0 && this.beatIndex < 3) return "FOUP";
    if (this.stepIndex > 0 && this.beatIndex < 4) return STEPS[this.stepIndex - 1].carrier === step.carrier
      ? step.carrier
      : STEPS[this.stepIndex - 1].carrier;
    return step.carrier;
  }

  genealogy() {
    const L = this.lot;
    const rows = [
      { key: "gen_interposer", value: `${L.wafer} · 12 sites` },
      { key: "gen_logic", value: L.kitIssued ? L.logic : "gen_pending" },
      { key: "gen_hbm", value: L.kitIssued ? L.hbm.join(" · ") : "gen_pending" },
    ];
    if (L.cowDone) rows.push({ key: "gen_cow", value: `${L.wafer}-COW` });
    if (L.diced) rows.push({ key: "gen_chip", value: `${L.unit}-COW` });
    if (L.mounted || this.stepIndex >= STEPS.findIndex((s) => s.id === "fc")) {
      rows.push({ key: "gen_sub", value: L.substrate });
    }
    if (L.mounted) rows.push({ key: "gen_unit", value: L.unit });
    return rows;
  }
}
