/**
 * Overhead crane / 天車.
 * Two vehicles, one-way rail, three operating modes.
 * Vehicle state is one of: idle, goto_pick, hoist_pick, travel, hoist_drop, paused.
 * A carrier becomes in-transit only when the hoist actually couples it.
 */
import { smooth } from "./morph.js";
import {
  LEG,
  PORTS,
  VEHICLE_IDS,
  forwardDistance,
  nodeS,
  portAccepts,
  railPath,
  railPoint,
  returnZoneFor,
  travelDuration,
} from "./route.js";

function hoistFromRaw(raw) {
  if (raw <= 0.5) return smooth(raw / 0.5);
  return 1 - smooth((raw - 0.5) / 0.5);
}

function advance(from, dist) {
  const length = railPath().length;
  let s = from + dist;
  while (s >= length) s -= length;
  while (s < 0) s += length;
  return s;
}

export class Amhs {
  constructor(warehouse, { accepts = portAccepts } = {}) {
    this.wh = warehouse;
    this.accepts = accepts;
    this.mode = "AUTO";
    this.queue = [];
    this.holdTool = null;
    this.claimCount = 0;
    this.vehicles = VEHICLE_IDS.map((id, index) => this._vehicle(id, index));
  }

  _vehicle(id, index) {
    const home = index === 0 ? nodeS("westN") : nodeS("eastN");
    return {
      id,
      state: "idle",
      history: ["idle"],
      progress: 0,
      raw: 0,
      s: home,
      home,
      onSiding: true,
      carrying: null,
      waiting: false,
      move: null,
      pauseAfterHoist: false,
      resumeState: null,
      legFrom: home,
      legTo: home,
      legDist: 0,
      legDur: 1,
      acc: 0,
      hoist: 0,
      coupled: false,
      abortDrop: false,
    };
  }

  setMode(mode) {
    if (!["AUTO", "MANUAL", "PAUSE"].includes(mode)) return { ok: false, reason: "bad_mode" };
    const prev = this.mode;
    this.mode = mode;
    if (mode === "PAUSE") this._latchPause();
    if (mode === "AUTO" && prev !== "AUTO") this.assignQueued();
    return { ok: true, mode };
  }

  /**
   * Queue or assign a move. `explicit` is a trainee call (manual 叫車).
   * AUTO assigns immediately. MANUAL assigns only explicit calls.
   * PAUSE never assigns.
   */
  request(move, { explicit = false } = {}) {
    const carrier = this.wh.get(move.carrierId);
    if (!carrier) return { ok: false, reason: "missing_carrier" };
    if (carrier.status === "transit") return { ok: false, reason: "in_transit" };
    if (!this.accepts(move.to, carrier.type)) {
      this._refuse(carrier, "type_mismatch", move.to);
      return { ok: false, reason: "type_mismatch" };
    }
    if (this._blockedDest(move.to)) {
      this._refuse(carrier, "hold_blocks_delivery", move.to);
      return { ok: false, reason: "hold_blocks_delivery" };
    }
    if (this.mode === "PAUSE" && explicit) {
      this._refuse(carrier, "paused", move.to);
      return { ok: false, reason: "paused" };
    }
    move.phase = "queued";
    if (!this.queue.includes(move)) this.queue.push(move);
    if (this.mode === "PAUSE") return { ok: true, queued: true, assigned: false, id: move.id };
    if (this.mode === "MANUAL" && !explicit) return { ok: true, queued: true, assigned: false, id: move.id };
    const assigned = this._assign(move);
    return { ok: true, queued: !assigned, assigned, id: move.id, reason: assigned ? null : "no_vehicle" };
  }

  dispatchQueued() {
    if (this.mode === "PAUSE") return { ok: false, reason: "paused" };
    const next = this.queue[0];
    if (!next) return { ok: false, reason: "empty" };
    const assigned = this._assign(next);
    return { ok: assigned, reason: assigned ? null : "no_vehicle", id: next.id };
  }

  assignQueued() {
    if (this.mode !== "AUTO") return;
    for (const move of [...this.queue]) this._assign(move);
  }

  onHold(tool) {
    this.holdTool = tool;
    for (const move of [...this.queue]) {
      if (this._blockedDest(move.to)) {
        move.phase = "cancelled";
        this.queue = this.queue.filter((item) => item !== move);
      }
    }
    for (const vehicle of this.vehicles) {
      if (vehicle.move && this._blockedDest(vehicle.move.to)) this._divert(vehicle);
    }
  }

  clearHold() {
    this.holdTool = null;
  }

  tick(dt) {
    if (this.mode === "AUTO") this.assignQueued();
    if (this.mode !== "PAUSE") {
      for (const vehicle of this.vehicles) {
        if (vehicle.state === "paused" && vehicle.resumeState) {
          this._setState(vehicle, vehicle.resumeState);
          vehicle.resumeState = null;
        }
      }
    }
    for (const vehicle of this.vehicles) this._step(vehicle, dt);
  }

  snapshot() {
    return {
      mode: this.mode,
      claimCount: this.claimCount,
      queued: this.queue.map((move) => ({
        id: move.id, to: move.to, carrierId: move.carrierId, kind: move.kind, phase: move.phase,
      })),
      vehicles: this.vehicles.map((vehicle) => {
        const point = railPoint(vehicle.s);
        return {
          id: vehicle.id,
          state: vehicle.state,
          carrying: vehicle.carrying,
          waiting: vehicle.waiting,
          dest: vehicle.move?.to || null,
          hoist: vehicle.hoist,
          progress: vehicle.progress,
          x: point.x,
          y: point.y,
          z: point.z,
          onSiding: vehicle.onSiding,
          history: vehicle.history.slice(),
        };
      }),
    };
  }

  _refuse(carrier, reason, port) {
    this.wh.pushLog({
      kind: "refuse",
      reason,
      zone: carrier.zone,
      carrierId: carrier.id,
      type: carrier.type,
      lotId: carrier.lotId,
      qty: carrier.qty,
      status: carrier.status,
      port,
    });
  }

  _blockedDest(portId) {
    if (!this.holdTool || !portId) return false;
    const port = PORTS[portId];
    if (!port || port.kind === "io") return false;
    return !!(port.tool && port.tool !== this.holdTool);
  }

  _assign(move) {
    if (move.phase !== "queued") return false;
    if (this.mode === "PAUSE") return false;
    if (this.vehicles.some((v) => v.carrying === move.carrierId || v.move?.carrierId === move.carrierId)) {
      return false;
    }
    const vehicle = this._pickVehicle(move);
    if (!vehicle) return false;
    move.phase = "assigned";
    move.vehicleId = vehicle.id;
    this.queue = this.queue.filter((item) => item !== move);
    vehicle.move = move;
    vehicle.coupled = false;
    vehicle.abortDrop = false;
    vehicle.waiting = false;
    vehicle.pauseAfterHoist = false;
    const source = this._carrierS(move.carrierId);
    this._arm(vehicle, vehicle.s, source);
    this._setState(vehicle, "goto_pick");
    return true;
  }

  _pickVehicle(move) {
    const source = this._carrierS(move.carrierId);
    const idle = this.vehicles.filter((v) => v.state === "idle" && !v.move);
    if (!idle.length) return null;
    idle.sort((a, b) => forwardDistance(a.s, source) - forwardDistance(b.s, source));
    return idle[0];
  }

  _carrierS(carrierId) {
    const carrier = this.wh.get(carrierId);
    const location = carrier?.location || "";
    if (location.startsWith("port:")) return nodeS(PORTS[location.slice(5)].rail);
    if (location.startsWith("io:")) return nodeS(PORTS[location].rail);
    if (location.startsWith("tool:")) {
      const tool = location.slice(5);
      const port = Object.values(PORTS).find((item) => item.tool === tool);
      return nodeS(port.rail);
    }
    const zone = carrier?.zone || "DBK";
    return nodeS(PORTS[`io:${zone}`].rail);
  }

  _arm(vehicle, from, to) {
    vehicle.legFrom = from;
    vehicle.legTo = to;
    vehicle.legDist = forwardDistance(from, to);
    vehicle.legDur = travelDuration(vehicle.legDist);
    vehicle.acc = 0;
    vehicle.raw = 0;
    vehicle.progress = 0;
  }

  _setState(vehicle, state) {
    if (vehicle.state === state) return;
    vehicle.history.push(state);
    vehicle.state = state;
  }

  _latchPause() {
    for (const vehicle of this.vehicles) {
      if (vehicle.state === "idle" || vehicle.state === "paused") continue;
      if (vehicle.state === "hoist_pick" || vehicle.state === "hoist_drop") {
        vehicle.pauseAfterHoist = true;
      } else {
        vehicle.resumeState = vehicle.state;
        this._setState(vehicle, "paused");
      }
    }
  }

  _divert(vehicle) {
    const carrier = this.wh.get(vehicle.carrying || vehicle.move.carrierId);
    const zone = returnZoneFor(carrier);
    const hoisting = vehicle.state === "hoist_pick" || vehicle.state === "hoist_drop";
    if (!vehicle.carrying && !hoisting) {
      vehicle.move.phase = "cancelled";
      vehicle.move = null;
      vehicle.onSiding = true;
      vehicle.waiting = false;
      this._setState(vehicle, "idle");
      return;
    }
    vehicle.move.diverted = true;
    if (!zone) {
      vehicle.move.to = null;
      vehicle.abortDrop = true;
      vehicle.pauseAfterHoist = true;
      if (!hoisting) {
        vehicle.resumeState = null;
        vehicle.onSiding = false;
        this._setState(vehicle, "paused");
      }
      return;
    }
    vehicle.move.to = `io:${zone}`;
    vehicle.move.kind = "return";
    if (carrier) carrier._return = true;
    if (vehicle.state === "hoist_drop") vehicle.abortDrop = true;
    if (vehicle.state === "travel") {
      this._arm(vehicle, vehicle.s, nodeS(PORTS[vehicle.move.to].rail));
    }
  }

  _gapBlocked(vehicle) {
    for (const other of this.vehicles) {
      if (other === vehicle || other.onSiding) continue;
      const gap = forwardDistance(vehicle.s, other.s);
      if (gap === 0) return vehicle.id > other.id;
      if (gap > 0 && gap < 8) return true;
    }
    return false;
  }

  _step(vehicle, dt) {
    if (vehicle.state === "idle" || vehicle.state === "paused") {
      vehicle.waiting = false;
      vehicle.hoist = 0;
      vehicle.onSiding = vehicle.state === "idle";
      return;
    }
    if (vehicle.onSiding && (vehicle.state === "goto_pick" || vehicle.state === "travel")) {
      if (this._gapBlocked(vehicle)) {
        vehicle.waiting = true;
        return;
      }
      vehicle.onSiding = false;
    }
    if ((vehicle.state === "goto_pick" || vehicle.state === "travel") && !vehicle.onSiding && this._gapBlocked(vehicle)) {
      vehicle.waiting = true;
      return;
    }
    vehicle.waiting = false;
    vehicle.acc += dt;
    const dur = vehicle.state === "hoist_pick" || vehicle.state === "hoist_drop" ? LEG.hoist : vehicle.legDur;
    const raw = Math.min(1, vehicle.acc / dur);
    vehicle.raw = raw;
    vehicle.progress = smooth(raw);
    if (vehicle.state === "goto_pick" || vehicle.state === "travel") {
      vehicle.s = advance(vehicle.legFrom, vehicle.legDist * vehicle.progress);
      vehicle.hoist = 0;
    } else if (vehicle.state === "hoist_pick") {
      vehicle.hoist = hoistFromRaw(raw);
      if (raw >= 0.5 && !vehicle.coupled) this._couple(vehicle);
    } else if (vehicle.state === "hoist_drop") {
      vehicle.hoist = hoistFromRaw(raw);
      if (raw >= 0.5 && vehicle.coupled && !vehicle.abortDrop) this._decouple(vehicle);
    }
    if (raw >= 1) this._complete(vehicle);
  }

  _couple(vehicle) {
    vehicle.coupled = true;
    vehicle.carrying = vehicle.move.carrierId;
    this.wh.markTransit(vehicle.carrying, vehicle.id);
    this.claimCount += 1;
  }

  _decouple(vehicle) {
    const id = vehicle.carrying;
    vehicle.coupled = false;
    vehicle.carrying = null;
    const dest = vehicle.move.to;
    const carrier = this.wh.get(id);
    if (String(dest).startsWith("io:")) carrier.location = dest;
    else carrier.location = `port:${dest}`;
    if (carrier.status !== "locked") carrier.status = "reserved";
    vehicle.move.phase = "dropped";
  }

  _complete(vehicle) {
    vehicle.acc = 0;
    vehicle.raw = 0;
    vehicle.progress = 0;
    if (vehicle.pauseAfterHoist && (vehicle.state === "hoist_pick" || vehicle.state === "hoist_drop")) {
      vehicle.pauseAfterHoist = false;
      if (vehicle.state === "hoist_pick" && vehicle.carrying && vehicle.move?.to) {
        this._arm(vehicle, vehicle.s, nodeS(PORTS[vehicle.move.to].rail));
        vehicle.resumeState = "travel";
      } else {
        vehicle.resumeState = null;
      }
      vehicle.onSiding = false;
      this._setState(vehicle, "paused");
      return;
    }
    if (vehicle.state === "goto_pick") {
      vehicle.s = vehicle.legTo;
      vehicle.coupled = false;
      this._setState(vehicle, "hoist_pick");
      return;
    }
    if (vehicle.state === "hoist_pick") {
      if (!vehicle.move?.to) {
        this._setState(vehicle, "paused");
        vehicle.onSiding = false;
        return;
      }
      this._arm(vehicle, vehicle.s, nodeS(PORTS[vehicle.move.to].rail));
      this._setState(vehicle, "travel");
      return;
    }
    if (vehicle.state === "travel") {
      vehicle.s = vehicle.legTo;
      if (!vehicle.move?.to) {
        this._setState(vehicle, "paused");
        return;
      }
      vehicle.abortDrop = false;
      this._setState(vehicle, "hoist_drop");
      return;
    }
    if (vehicle.state === "hoist_drop") {
      if (vehicle.abortDrop && vehicle.carrying) {
        vehicle.abortDrop = false;
        if (vehicle.move?.to) {
          this._arm(vehicle, vehicle.s, nodeS(PORTS[vehicle.move.to].rail));
          this._setState(vehicle, "travel");
        } else {
          vehicle.onSiding = false;
          this._setState(vehicle, "paused");
        }
        return;
      }
      vehicle.move = null;
      vehicle.carrying = null;
      vehicle.onSiding = true;
      this._setState(vehicle, "idle");
    }
  }
}
