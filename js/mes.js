import {
  HOLD_AT,
  HOLDS,
  STATIONS,
  committedMorph,
  genealogyRows,
  morphIsBlocked,
  planHolds,
  stationById,
} from "./route.js";

export const BEATS = ["prepare", "transport", "job-in", "process", "job-out", "track-out"];

const PROCESS_BEAT = BEATS.indexOf("process");

/** Stations are the steps. Supporting MES beats stay on each station. */
export const STEPS = STATIONS;

export function pad(n, w = 4) {
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
    totalSites: 12,
    goodSites: 12,
    scrap: 0,
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
    return STATIONS[Math.min(this.stepIndex, STATIONS.length - 1)];
  }

  get morph() {
    return committedMorph(this.stepIndex, this.beatIndex, !!this.hold, PROCESS_BEAT);
  }

  get awaitingTransport() {
    return this._awaitingTransport;
  }

  /** Fault the 3D should play for the station that is about to process. */
  plannedFault() {
    return this.peekHold() ? 1 : 0;
  }

  peekHold() {
    const step = this.step();
    if (this.firedHolds.has(step.id)) return null;
    const id = Object.keys(HOLDS).find(
      (hid) => HOLDS[hid].stationId === step.id && this.plannedHolds.has(hid)
    );
    return id ? HOLDS[id] : null;
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
      morph: this.morph,
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
      this.emit("transport", { to: step, carrier: this.travelCarrier() });
      return;
    }

    const durations = {
      prepare: 0.45,
      "job-in": 0.55,
      process: step.duration,
      "job-out": 0.4,
      "track-out": 0.35,
    };
    this._acc = 0;
    this._goal = durations[beat] || 0.5;
    this.change();
    if (beat === "process") {
      const hold = this.peekHold();
      this.emit("process", { step, fault: hold ? 1 : 0, holdId: hold?.id || null });
    }
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
      const planned = this.peekHold();
      if (planned && this.processProgress >= HOLD_AT) {
        this.firedHolds.add(this.step().id);
        this._openHold(planned.id);
        return;
      }
    }
    if (this._acc >= this._goal) this._finishBeat();
  }

  _openHold(id) {
    const def = HOLDS[id];
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
      this._savedAcc = this._acc;
      this._savedGoal = this._goal;
      this._acc = 0;
      this._goal = 2.2;
      this.emit("toast", { key: "waitingMaterial" });
      this.change();
      return { ok: true, pending: true };
    }

    if (action.id === "partial") {
      this.lot.goodSites = Math.max(8, this.lot.goodSites - 3);
      this.lot.notes.push("partial-kit");
      this._clearHold("partial");
      this.emit("toast", { key: "toastScrap", vars: { n: 3 } });
      return { ok: true };
    }

    if (action.id === "rework") {
      const back = STATIONS.findIndex((s) => s.id === action.backTo);
      this.holdsResolved.push({ id: this.hold.id, action: "rework" });
      this.hold = null;
      this.status = "QUEUE";
      this.stepIndex = back >= 0 ? back : this.stepIndex;
      this.beatIndex = 0;
      this.busy = false;
      this._chain = false;
      this.processProgress = 0;
      this.emit("toast", { key: "toastRework", vars: { step: `step_${this.step().id}` } });
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
      this.processProgress = 0;
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
    this._chain = this.mode === "station";
    if (action === "wait") {
      this._acc = this._savedAcc ?? this._acc;
      this._goal = this._savedGoal ?? this.step().duration;
      this.emit("toast", { key: "toastWait" });
    }
    this.change();
    this.emit("resolved", { action, resume: true });
  }

  _finishBeat() {
    const beat = BEATS[this.beatIndex];
    const step = this.step();

    if (beat === "process") {
      this.processProgress = 1;
      this._applyProcessEffects(step);
    }
    if (beat === "track-out") {
      if (this.stepIndex >= STATIONS.length - 1) {
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
      if (this.auto) this.advance();
      return;
    }

    this.beatIndex += 1;
    this.busy = false;
    this.change();
    if (this._chain || this.auto) this.advance();
  }

  _applyProcessEffects(step) {
    const lot = this.lot;
    if (step.id === "diebank") lot.notes.push("kgd-issued");
    if (step.id === "hbond") lot.notes.push("cow-bonded");
    if (step.id === "dice") lot.notes.push("singulated");
    if (step.id === "wos") lot.notes.push("wos-seated");
    if (step.id === "ballpack") lot.notes.push("packed");
  }

  /** Carrier model while the lot is moving into this station. */
  travelCarrier() {
    if (this.stepIndex <= 0) return STATIONS[0].carrier;
    return STATIONS[this.stepIndex - 1].carrier;
  }

  /** Carrier the contract shows for the station the lot is actually on. */
  displayCarrier() {
    const idx = this.beatIndex <= 1 && this.stepIndex > 0 ? this.stepIndex - 1 : this.stepIndex;
    return STATIONS[idx].carrier;
  }

  carrierStation() {
    const idx = this.beatIndex <= 1 && this.stepIndex > 0 ? this.stepIndex - 1 : this.stepIndex;
    return STATIONS[idx];
  }

  genealogy() {
    return genealogyRows(this.lot, this.morph, this.hold);
  }

  /** Acceptance helper: committed morph must not be the hold's blocked morph. */
  holdBlocksCurrentMorph() {
    if (!this.hold) return false;
    return morphIsBlocked(this.morph, this.hold.blocksMorph);
  }
}

export { stationById };
