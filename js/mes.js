import { committedMorphOf, productById } from "./catalog.js";
import { Facility } from "./facility.js";
import { scenarioApplies } from "./scenario.js";
import {
  HOLD_AT,
  PUTAWAY,
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

function makeLot(product) {
  const n = 100 + Math.floor(Math.random() * 8900);
  const w = 20 + Math.floor(Math.random() * 80);
  const logic = 4000 + Math.floor(Math.random() * 5000);
  const hbmBase = 7000 + Math.floor(Math.random() * 2000);
  const sub = 300 + Math.floor(Math.random() * 600);
  const sites = product?.sites || 12;
  const hbmCount = product?.hbmCount ?? 4;
  const sku = (product?.id || "HBX-100").replace("-", "");
  return {
    id: `APX2602-${pad(n)}`,
    product: product?.id || "HBX-100",
    flowId: product?.flowId || "HBX-100-COW-WOS",
    wafer: product?.id === "HBX-S12" ? `KGD-2602-${pad(w, 3)}` : `IPW-2602-${pad(w, 3)}`,
    logic: `LGC-KGD-${logic}`,
    hbm: Array.from({ length: hbmCount }, (_, i) => `HBM-${hbmBase}-${pad(i + 1, 2)}`),
    substrate: `OSB-88-${pad(sub, 3)}`,
    unit: `${sku}-2602-${pad(n)}`,
    totalSites: sites,
    goodSites: sites,
    scrap: 0,
    notes: [],
  };
}

export class Session {
  constructor({ intensity = "few", role = "MFG", productId = "HBX-100", awaitChoice = false, scenario = null } = {}) {
    this.product = productById(productId) || productById("HBX-100");
    this.flow = this.product.flow;
    this.intensity = intensity;
    this.role = role;
    this.speed = 1;
    this.auto = false;
    this.mode = "station";
    this.runChoice = awaitChoice ? null : "step";
    this.stepIndex = 0;
    this.beatIndex = 0;
    this.status = "QUEUE";
    this.busy = false;
    this.hold = null;
    this.holdsResolved = [];
    this.scenario = scenarioApplies(this.product, scenario) ? scenario : null;
    const baseHolds = planHolds(intensity).filter((id) => this.product.holds[id]);
    let planned = new Set(baseHolds);
    if (this.scenario === "first" || this.scenario === "pause") planned = new Set();
    if (this.scenario === "kgd") planned = new Set(["kgd"]);
    if (this.scenario === "overlay") planned = new Set(["overlay"]);
    if (this.scenario === "warpage") planned = new Set(["warpage"]);
    this.plannedHolds = planned;
    this.firedHolds = new Set();
    this.lot = makeLot(this.product);
    this.facility = new Facility({
      lot: this.lot,
      kgdLocked: this.plannedHolds.has("kgd"),
      mode: this.scenario === "pause" ? "PAUSE" : "AUTO",
      rules: this.product.rules,
      kgdQty: this.product.kgdQty,
    });
    this._putawayStarted = false;
    this.listeners = new Map();
    this._acc = 0;
    this._goal = 0;
    this._awaitingTransport = false;
    this._chain = false;
    this.processProgress = 0;
    if (this.scenario === "kgd") this._seedKgdHold();
    if (this.scenario === "overlay" || this.scenario === "warpage") this._seedScenarioHold(this.scenario);
  }

  /**
   * Park the lot on diebank with the warehouse already refusing KGD.
   * Uses the same approach refusal the live line uses.
   */
  _seedKgdHold() {
    const idx = this.flow.findIndex((step) => step.id === "diebank");
    if (idx < 0) return;
    this.stepIndex = idx;
    this.beatIndex = BEATS.indexOf("transport");
    const approach = this.facility.beginApproach("diebank");
    if (!approach.ok && approach.hold === "kgd") {
      this.firedHolds.add("diebank");
      this._openHold("kgd");
    }
  }

  /**
   * Walk the existing session until the named hold opens.
   * runChoice is restored so a catalog lot can still ask auto vs step.
   */
  _seedScenarioHold(id) {
    if (!this.flow.some((step) => step.id === id)) return;
    const restore = this.runChoice;
    this.runChoice = "step";
    this.auto = false;
    let guard = 0;
    while (guard < 200000 && this.hold?.id !== id && this.status !== "DONE") {
      guard += 1;
      if (this.hold) break;
      if (!this.busy && !this._awaitingTransport) {
        if (!this.advance()) break;
      }
      this.tick(0.5);
    }
    this.auto = false;
    this.runChoice = restore;
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
    return this.flow[Math.min(this.stepIndex, this.flow.length - 1)];
  }

  get morph() {
    if (this.product.id === "HBX-100") {
      return committedMorph(this.stepIndex, this.beatIndex, !!this.hold, PROCESS_BEAT);
    }
    return committedMorphOf(this.flow, this.stepIndex, this.beatIndex, !!this.hold, PROCESS_BEAT);
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
    const holds = this.product.holds;
    const id = Object.keys(holds).find(
      (hid) => holds[hid].stationId === step.id && this.plannedHolds.has(hid)
    );
    return id ? holds[id] : null;
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
      runChoice: this.runChoice,
      productId: this.product.id,
      speed: this.speed,
      role: this.role,
      hold: this.hold,
      morph: this.morph,
      processProgress: this.processProgress,
      holdsResolved: this.holdsResolved.slice(),
      facility: this.facility.snapshot(),
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

  chooseRun(mode) {
    if (mode !== "auto" && mode !== "step") return false;
    if (this.status === "DONE") return false;
    this.runChoice = mode;
    if (mode === "auto") this.setAuto(true);
    else {
      this.auto = false;
      this.change();
    }
    return true;
  }

  setAuto(on) {
    if (this.status === "DONE" || this.runChoice == null) return;
    this.auto = on;
    if (on && this.facility.mode !== "PAUSE") this.facility.setMode("AUTO");
    if (on && !this.busy && !this.hold) this.advance();
    this.change();
  }

  advance() {
    if (this.runChoice == null) {
      this.emit("toast", { key: "needRunChoice" });
      return false;
    }
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
      const approach = this.facility.beginApproach(step.id);
      if (!approach.ok) {
        if (approach.hold === "kgd") {
          this.firedHolds.add(step.id);
          this._openHold("kgd");
          return;
        }
        this.busy = false;
        this._chain = false;
        this.status = "QUEUE";
        this.emit("toast", { key: "moveRefused", vars: { reason: approach.reason || "refused" } });
        this.change();
        return;
      }
      this._awaitingTransport = true;
      this._acc = 0;
      this._goal = 0;
      this.change();
      this.emit("transport", { to: step, carrier: this.travelCarrier() });
      return;
    }

    if (beat === "process" && !this.facility.readyForProcess(step.id)) {
      this.busy = false;
      this._chain = false;
      this.emit("toast", { key: "needDock" });
      this.change();
      return;
    }

    if (beat === "track-out" && step.id === PUTAWAY.stationId && !this._putawayStarted) {
      this._putawayStarted = true;
      const putaway = this.facility.beginPutaway();
      if (!putaway.done) {
        this._awaitingTransport = true;
        this._acc = 0;
        this._goal = 0;
        this.change();
        this.emit("transport", { to: step, carrier: "TRAY", putaway: true });
        return;
      }
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
    if (!this.facility.approachDone()) return;
    this.facility.consumeApproach();
    this._awaitingTransport = false;
    this._finishBeat();
  }

  tick(dt) {
    const scaled = dt * this.speed;
    this.facility.tick(scaled);
    if (this._awaitingTransport && this.facility.approachDone()) this.transportDone();
    if (this.hold && this.hold.waiting) {
      this._acc += scaled;
      if (this._acc >= this._goal) {
        this.hold.waiting = false;
        this._clearHold("wait");
      }
      return;
    }
    if (!this.busy || this._awaitingTransport || this.hold) return;
    this._acc += scaled;
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
    const def = this.product.holds[id];
    this.facility.onHold(def.stationId);
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
      const back = this.flow.findIndex((s) => s.id === action.backTo);
      const stationId = this.hold.stationId;
      this.holdsResolved.push({ id: this.hold.id, action: "rework" });
      this.facility.onHoldCleared({ action: "rework", stationId, qty: this.lot.goodSites });
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
      const stationId = this.hold.stationId;
      this.holdsResolved.push({ id: this.hold.id, action: "bake" });
      this.facility.onHoldCleared({ action: "bake", stationId, qty: this.lot.goodSites });
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
    const id = this.hold.id;
    const stationId = this.hold.stationId;
    this.holdsResolved.push({ id, action });
    this.hold = null;
    if (id === "kgd" && BEATS[this.beatIndex] === "transport") {
      this.facility.onHoldCleared({ action, stationId, qty: this.lot.goodSites });
      const approach = this.facility.beginApproach("diebank");
      if (!approach.ok) {
        this.firedHolds.add("diebank");
        this._openHold("kgd");
        return;
      }
      this.status = "RUN";
      this.busy = true;
      this._chain = this.mode === "station" || this.auto;
      this._awaitingTransport = true;
      this._acc = 0;
      this._goal = 0;
      this.change();
      this.emit("resolved", { action, resume: true });
      return;
    }
    this.facility.onHoldCleared({ action, stationId, qty: this.lot.goodSites });
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
      if (this.stepIndex >= this.flow.length - 1) {
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
    this.facility.presentOutput(step.id);
    if (step.id === "diebank") lot.notes.push("kgd-issued");
    if (step.id === "hbond") lot.notes.push("cow-bonded");
    if (step.id === "backgrind") lot.notes.push("thinned");
    if (step.id === "dice") lot.notes.push("singulated");
    if (step.id === "wos") lot.notes.push("wos-seated");
    if (step.id === "ufcure") lot.notes.push("underfilled");
    if (step.id === "ball") lot.notes.push("balled");
    if (step.id === "pack") lot.notes.push("packed");
  }

  /** Carrier model while the lot is moving into this station. */
  travelCarrier() {
    if (this.stepIndex <= 0) return this.flow[0].carrier;
    return this.flow[this.stepIndex - 1].carrier;
  }

  /** Carrier the contract shows for the station the lot is actually on. */
  displayCarrier() {
    const idx = this.beatIndex <= 1 && this.stepIndex > 0 ? this.stepIndex - 1 : this.stepIndex;
    return this.flow[idx].carrier;
  }

  carrierStation() {
    const idx = this.beatIndex <= 1 && this.stepIndex > 0 ? this.stepIndex - 1 : this.stepIndex;
    return this.flow[idx];
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
