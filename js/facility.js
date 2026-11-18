/**
 * Facility orchestrator. Warehouse inventory stays the system of record.
 * The crane and the five tools only move when this module, following
 * js/route.js, says the carrier was issued and the port accepts it.
 */
import { Amhs } from "./amhs.js";
import {
  DOCK_REQUIREMENTS,
  OUTPUT_PRESENT,
  PORTS,
  PUTAWAY,
  portAccepts,
  returnZoneFor,
  stationById,
} from "./route.js";
import { Warehouse, seedCarriers } from "./warehouse.js";

export class Facility {
  constructor({ lot, kgdLocked = false, mode = "AUTO", rules = null, kgdQty = 12 } = {}) {
    this.lotId = lot?.id || "LOT";
    this.rules = rules || null;
    this.kgdQty = rules?.kgdQty || kgdQty || 12;
    this.wh = new Warehouse(seedCarriers(lot, { kgdLocked, kgdQty: this.kgdQty }));
    this.amhs = new Amhs(this.wh, { accepts: (port, type) => this._accepts(port, type) });
    this.amhs.setMode(mode);
    this.moves = [];
    this.gate = [];
    this._instant = false;
    this._n = 1;
    this.holdOpen = false;
    this.holdTool = null;
    this.lotCarrierId = null;
    this.lastRefusal = null;
  }

  setMode(mode) {
    return this.amhs.setMode(mode);
  }

  get mode() {
    return this.amhs.mode;
  }

  /**
   * Issue and dispatch everything DOCK_REQUIREMENTS names for this operation.
   * A KGD shortage refuses the whole approach: the missing tray is not
   * reserved, and the crane is not asked to pick up a carrier that was
   * never issued.
   */
  beginApproach(stationId) {
    if (this.holdOpen) return { ok: false, reason: "hold" };
    const reqs = this._activeReqs(stationId);
    const reserved = [];
    const staged = [];
    for (const req of reqs) {
      if (this._satisfied(req)) continue;
      if (req.role === "issue") {
        const issued = this.wh.reserve({
          zone: req.zone, sku: req.sku, type: req.type, lotId: this.lotId,
        });
        if (!issued.ok) {
          for (const id of reserved) this.wh.unreserve(id);
          this.lastRefusal = issued.reason;
          this.wh.pushLog({
            kind: "refuse",
            reason: issued.reason,
            zone: req.zone,
            carrierId: null,
            type: req.type,
            lotId: this.lotId,
            qty: 0,
            status: "locked",
            port: req.port,
          });
          this._instant = false;
          this.gate = [];
          return { ok: false, reason: issued.reason, hold: issued.reason === "kgd_shortage" ? "kgd" : null };
        }
        reserved.push(issued.carrier.id);
        if (req.becomesLot) this.lotCarrierId = issued.carrier.id;
        this.wh.pushLog({
          kind: "reserve",
          zone: req.zone,
          carrierId: issued.carrier.id,
          type: issued.carrier.type,
          lotId: this.lotId,
          qty: issued.carrier.qty,
          status: "reserved",
          port: req.port,
        });
        staged.push(this._stageIssue(issued.carrier, req.port));
      } else if (req.role === "follow") {
        const carrier = this._named(req.sku);
        if (!carrier || carrier.type !== req.type) {
          for (const id of reserved) this.wh.unreserve(id);
          this.gate = [];
          this.lastRefusal = carrier ? "type_mismatch" : "no_lot_carrier";
          return { ok: false, reason: this.lastRefusal };
        }
        staged.push(this._stageTravel(carrier, req.port));
      } else {
        const carrier = this.wh.get(this.lotCarrierId);
        if (!carrier || carrier.type !== req.type) {
          for (const id of reserved) this.wh.unreserve(id);
          this.gate = [];
          this.lastRefusal = carrier ? "type_mismatch" : "no_lot_carrier";
          return { ok: false, reason: this.lastRefusal };
        }
        staged.push(this._stageTravel(carrier, req.port));
      }
    }
    if (!staged.length) {
      this._instant = true;
      this.gate = [];
      return { ok: true, done: true };
    }
    this._instant = false;
    this.gate = staged.map((move) => move.id);
    return { ok: true, done: false, moves: this.gate.slice() };
  }

  approachDone() {
    if (this._instant) return true;
    if (!this.gate.length) return false;
    return this.gate.every((id) => this.moves.find((move) => move.id === id)?.phase === "done");
  }

  consumeApproach() {
    this._instant = false;
    this.gate = [];
  }

  readyForProcess(stationId) {
    return this._activeReqs(stationId).every((req) => this._satisfied(req));
  }

  /**
   * Job-out: the traveling carrier waits at the load port. Nothing is sent
   * to the next tool. Mount and WoS are the only carrier conversions.
   */
  presentOutput(stationId) {
    const present = (this.rules?.output || OUTPUT_PRESENT)[stationId];
    if (!present) return;
    const tool = stationById(stationId).tool;
    if (present.borrow) {
      for (const carrier of this.wh.carriers) {
        const here = carrier.location === `tool:${tool}` || carrier.location === `port:${present.port}`;
        if (!here || carrier.type !== present.type) continue;
        carrier.lotId = null;
        carrier._return = true;
        this._toPort(carrier, present.port);
        this._enqueue(carrier, `io:${present.returnZone}`, "return");
      }
      return;
    }
    if (present.sideReturn) {
      for (const carrier of this.wh.carriers) {
        const here = carrier.location === `tool:${tool}` || String(carrier.location).startsWith(`port:${tool}`);
        if (carrier.sku !== present.returnSku || !here) continue;
        carrier.lotId = null;
        carrier._return = true;
        const src = this._portFor(tool, carrier.type);
        if (src) this._toPort(carrier, src);
        this._enqueue(carrier, `io:${present.returnZone}`, "return");
      }
      const lot = this.wh.get(this.lotCarrierId);
      if (lot) this._toPort(lot, present.port);
      return;
    }
    if (present.markKgd) {
      const lot = this.wh.get(this.lotCarrierId);
      if (lot) this._toPort(lot, present.port);
      for (const carrier of this.wh.carriers) {
        if (carrier.location === `tool:${tool}` && carrier.sku === "kgd") {
          carrier.sku = "kgd-issued";
          carrier.status = "locked";
        }
      }
      return;
    }
    if (present.keepLot) {
      for (const carrier of this.wh.carriers) {
        const here = carrier.location === `tool:${tool}` || carrier.location === `port:${present.port}`;
        if (here && carrier.sku === present.sku) this._toPort(carrier, present.port);
      }
      return;
    }
    if (present.convertFrom) {
      const lot = this.wh.get(this.lotCarrierId);
      if (lot && lot.type === present.convertFrom) {
        if (present.returnZone) {
          lot.lotId = null;
          lot._return = true;
          const src = this._portFor(tool, lot.type) || present.port;
          this._toPort(lot, src);
          this._enqueue(lot, `io:${present.returnZone}`, "return");
        }
        if (present.returnSku && present.returnZone) {
          for (const carrier of this.wh.carriers) {
            const here = carrier.location === `tool:${tool}` || String(carrier.location).startsWith(`port:${tool}`);
            if (carrier.sku === present.returnSku && here) {
              carrier.lotId = null;
              carrier._return = true;
              const src = this._portFor(tool, carrier.type);
              if (src) this._toPort(carrier, src);
              this._enqueue(carrier, `io:${present.returnZone}`, "return");
            }
          }
        }
        if (present.retireFrame) {
          lot.lotId = null;
          lot.sku = "frame-empty";
          lot.status = "stock";
          lot.location = `port:${present.framePort}`;
        }
        const next = this.wh.addCarrier({
          id: `${present.idPrefix}${this.lotId}`,
          zone: null,
          type: present.type,
          sku: present.newSku,
          lotId: this.lotId,
          qty: 1,
          status: "reserved",
          location: `port:${present.port}`,
          home: null,
        });
        this.lotCarrierId = next.id;
        return;
      }
      if (lot) this._toPort(lot, present.port);
      return;
    }
    const lot = this.wh.get(this.lotCarrierId);
    if (!lot) return;
    if (present.sku === "finished") {
      lot.sku = "finished";
      lot.qty = 1;
      lot.zone = "FG";
    }
    this._toPort(lot, present.port);
  }

  beginPutaway() {
    const carrier = this.wh.get(this.lotCarrierId);
    if (!carrier) return { ok: false, reason: "missing_carrier" };
    const putaway = this._putaway();
    carrier.sku = "finished";
    carrier.zone = putaway.zone;
    if (String(carrier.location).startsWith(`bin:${putaway.zone}:`)) {
      this._instant = true;
      this.gate = [];
      return { ok: true, done: true };
    }
    if (String(carrier.location).startsWith("tool:")) {
      const port = this._portFor(carrier.location.slice(5), carrier.type) || "PCK-56";
      this._toPort(carrier, port);
    }
    const move = this._enqueue(carrier, putaway.port, "putaway");
    this._instant = false;
    this.gate = [move.id];
    return { ok: true, done: false };
  }

  onHold(stationId) {
    const tool = stationById(stationId)?.tool;
    this.holdOpen = true;
    this.holdTool = tool;
    if (tool) this.wh.lockTool(tool);
    this.amhs.onHold(tool);
  }

  onHoldCleared({ action, stationId, qty }) {
    this.holdOpen = false;
    this.amhs.clearHold();
    if (stationId === "diebank" && (action === "wait" || action === "partial" || action === "release")) {
      this.wh.replenishKgd(action === "partial" ? qty : this.kgdQty);
      return;
    }
    const tool = stationById(stationId)?.tool;
    if (tool) this.wh.unlockTool(tool);
  }

  requestMove({ carrierId, to }) {
    const carrier = this.wh.get(carrierId);
    if (!carrier) return { ok: false, reason: "missing_carrier" };
    if (!this._accepts(to, carrier.type)) {
      this.lastRefusal = "type_mismatch";
      this.wh.pushLog({
        kind: "refuse", reason: "type_mismatch", zone: carrier.zone, carrierId: carrier.id,
        type: carrier.type, lotId: carrier.lotId, qty: carrier.qty, status: carrier.status, port: to,
      });
      return { ok: false, reason: "type_mismatch" };
    }
    if (this.holdOpen && PORTS[to]?.tool && PORTS[to].tool !== this.holdTool) {
      this.lastRefusal = "hold_blocks_delivery";
      this.wh.pushLog({
        kind: "refuse", reason: "hold_blocks_delivery", zone: carrier.zone, carrierId: carrier.id,
        type: carrier.type, lotId: carrier.lotId, qty: carrier.qty, status: carrier.status, port: to,
      });
      return { ok: false, reason: "hold_blocks_delivery" };
    }
    if (String(carrier.location).startsWith("bin:")) {
      if (carrier.status !== "stock" && carrier.status !== "reserved") {
        return { ok: false, reason: "unavailable" };
      }
      carrier.status = "reserved";
      const move = this._move(carrier.id, to, "manual");
      this.wh.enqueueRetrieve(carrier.id);
      return { ok: true, id: move.id, queued: true };
    }
    if (String(carrier.location).startsWith("tool:")) {
      const port = this._portFor(carrier.location.slice(5), carrier.type);
      if (port) carrier.location = `port:${port}`;
    }
    const move = this._move(carrier.id, to, "manual");
    const res = this.amhs.request(move, { explicit: true });
    if (!res.ok) {
      move.phase = "refused";
      this.lastRefusal = res.reason;
    }
    return res;
  }

  returnToStock(carrierId) {
    const carrier = this.wh.get(carrierId);
    if (!carrier) return { ok: false, reason: "missing_carrier" };
    const zone = returnZoneFor(carrier);
    if (!zone) return { ok: false, reason: "no_zone" };
    const dest = `io:${zone}`;
    if (!this._accepts(dest, carrier.type)) return { ok: false, reason: "type_mismatch" };
    if (this.holdOpen && PORTS[dest]?.tool) return { ok: false, reason: "hold_blocks_delivery" };
    carrier._return = true;
    if (carrier.status === "locked") carrier.status = "reserved";
    if (String(carrier.location).startsWith("tool:")) {
      const port = this._portFor(carrier.location.slice(5), carrier.type);
      if (port) carrier.location = `port:${port}`;
    }
    if (String(carrier.location).startsWith("bin:")) {
      const move = this._move(carrier.id, dest, "return");
      this.wh.enqueueRetrieve(carrier.id);
      return { ok: true, id: move.id };
    }
    const move = this._enqueue(carrier, dest, "return", { explicit: true });
    return { ok: move.phase !== "refused", id: move.id, reason: move.phase === "refused" ? this.lastRefusal : null };
  }

  dispatchQueued() {
    return this.amhs.dispatchQueued();
  }

  tick(dt) {
    this.wh.tick(dt);
    this._promote();
    this.amhs.tick(dt);
    this._finishDrops(dt);
  }

  agreementErrors() {
    const errors = [];
    for (const vehicle of this.amhs.vehicles) {
      if (!vehicle.carrying) continue;
      const carrier = this.wh.get(vehicle.carrying);
      if (!carrier) errors.push(`phantom:${vehicle.carrying}`);
      else if (carrier.location !== `transit:${vehicle.id}`) errors.push(`loc:${carrier.id}:${carrier.location}`);
      else if (carrier.status !== "transit") errors.push(`status:${carrier.id}`);
    }
    for (const carrier of this.wh.carriers) {
      if (carrier.status === "transit" || String(carrier.location).startsWith("transit:")) {
        const vehicleId = String(carrier.location).startsWith("transit:") ? carrier.location.slice(8) : null;
        const vehicle = this.amhs.vehicles.find((item) => item.carrying === carrier.id);
        if (!vehicle) errors.push(`orphan-transit:${carrier.id}`);
        else if (vehicleId && vehicle.id !== vehicleId) errors.push(`transit-disagree:${carrier.id}`);
      }
    }
    return errors;
  }

  snapshot() {
    const wh = this.wh.snapshot();
    const amhs = this.amhs.snapshot();
    return {
      mode: this.mode,
      lotCarrierId: this.lotCarrierId,
      holdOpen: this.holdOpen,
      holdTool: this.holdTool,
      lastRefusal: this.lastRefusal,
      carriers: wh.carriers,
      log: wh.log,
      stacker: wh.stacker,
      vehicles: amhs.vehicles,
      queued: amhs.queued,
      claimCount: amhs.claimCount,
    };
  }

  _lotType() {
    return this.wh.get(this.lotCarrierId)?.type || null;
  }

  _activeReqs(stationId) {
    const lotType = this._lotType();
    const docks = this.rules?.docks || DOCK_REQUIREMENTS;
    return (docks[stationId] || []).filter((req) => {
      if (req.unlessLot && req.unlessLot === lotType) return false;
      if (req.onlyLot && req.onlyLot !== lotType) return false;
      return true;
    });
  }

  _named(sku) {
    return this.wh.carriers.find((c) => c.sku === sku && c.lotId === this.lotId)
      || this.wh.carriers.find((c) => c.sku === sku && (c.status === "reserved" || c.status === "transit"))
      || null;
  }

  _satisfied(req) {
    const tool = PORTS[req.port]?.tool;
    if (!tool) return false;
    return this.wh.carriers.some((carrier) => {
      if (carrier.location !== `tool:${tool}` || carrier.type !== req.type) return false;
      if (req.role === "travel") return carrier.id === this.lotCarrierId;
      if (req.role === "follow") return carrier.sku === req.sku;
      return carrier.sku === req.sku || (req.sku === "kgd" && carrier.sku === "kgd-issued");
    });
  }

  _stageIssue(carrier, port) {
    const move = this._move(carrier.id, port, "deliver");
    this.wh.enqueueRetrieve(carrier.id);
    return move;
  }

  _stageTravel(carrier, port) {
    if (String(carrier.location).startsWith("tool:")) {
      const src = this._portFor(carrier.location.slice(5), carrier.type);
      if (src) carrier.location = `port:${src}`;
    }
    return this._enqueue(carrier, port, "deliver");
  }

  _enqueue(carrier, to, kind, { explicit = false } = {}) {
    if (String(carrier.location).startsWith("bin:")) {
      const move = this._move(carrier.id, to, kind);
      this.wh.enqueueRetrieve(carrier.id);
      return move;
    }
    const move = this._move(carrier.id, to, kind);
    const res = this.amhs.request(move, { explicit: explicit || this.mode === "AUTO" });
    if (!res.ok) {
      move.phase = "refused";
      this.lastRefusal = res.reason;
    }
    return move;
  }

  _move(carrierId, to, kind) {
    const move = { id: `M${this._n++}`, carrierId, to, kind, phase: "retrieve" };
    this.moves.push(move);
    return move;
  }

  _promote() {
    for (const move of this.moves) {
      if (move.phase !== "retrieve") continue;
      const carrier = this.wh.get(move.carrierId);
      if (!carrier) continue;
      if (carrier.location === `io:${carrier.zone}`) {
        const res = this.amhs.request(move, { explicit: false });
        if (!res.ok) {
          move.phase = "refused";
          this.lastRefusal = res.reason;
        }
      }
    }
  }

  _finishDrops(dt) {
    for (const move of this.moves) {
      if (move.phase === "dropped") {
        const carrier = this.wh.get(move.carrierId);
        if (!carrier) {
          move.phase = "done";
          continue;
        }
        if (String(move.to).startsWith("io:")) {
          const zone = move.to.split(":")[1];
          this.wh.enqueueStore(carrier.id, zone, { returning: move.kind === "return" || !!carrier._return });
          move.phase = "storing";
        } else {
          carrier.handoff = 0;
          move.phase = "handoff";
        }
      } else if (move.phase === "handoff") {
        const carrier = this.wh.get(move.carrierId);
        carrier.handoff = (carrier.handoff || 0) + dt;
        if (carrier.handoff >= 0.95) {
          const tool = PORTS[move.to]?.tool;
          carrier.location = `tool:${tool}`;
          if (carrier.status !== "locked") carrier.status = "reserved";
          carrier.handoff = 1;
          move.phase = "done";
        }
      } else if (move.phase === "storing") {
        const carrier = this.wh.get(move.carrierId);
        if (carrier && String(carrier.location).startsWith("bin:")) move.phase = "done";
      }
    }
  }

  _toPort(carrier, port) {
    carrier.location = `port:${port}`;
    if (carrier.status !== "locked") carrier.status = "reserved";
  }

  _putaway() {
    return this.rules?.putaway || PUTAWAY;
  }

  _accepts(portId, type) {
    if (portAccepts(portId, type)) return true;
    const extra = this.rules?.acceptExtra?.[portId];
    return Array.isArray(extra) && extra.includes(type);
  }

  _portFor(tool, type) {
    return Object.keys(PORTS).find((id) => PORTS[id].tool === tool && this._accepts(id, type)) || null;
  }
}
