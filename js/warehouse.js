/**
 * Electronic warehouse for the HBX-100 trainer.
 * Inventory location is the system of record. The overhead crane and the
 * tool load ports copy it; they do not invent a second location.
 *
 * Status:  stock | reserved | transit | locked
 * Location: bin:ZONE:SLOT | stacker | io:ZONE | transit:VEHICLE | port:PORT | tool:TOOL
 */
import { LEG, ZONES } from "./route.js";

export function seedCarriers(lot, { kgdLocked = false } = {}) {
  const kgd = (id, slot) => ({
    id,
    zone: "DBK",
    type: "TRAY",
    sku: "kgd",
    lotId: null,
    qty: kgdLocked ? 0 : 12,
    status: kgdLocked ? "locked" : "stock",
    location: `bin:DBK:${slot}`,
    home: `bin:DBK:${slot}`,
  });
  return [
    kgd("KGD-A1", "A1"),
    kgd("KGD-A2", "A2"),
    {
      id: "INT-B1", zone: "INT", type: "FOUP", sku: "interposer", lotId: null, qty: 1,
      status: "stock", location: "bin:INT:B1", home: "bin:INT:B1", wafer: lot?.wafer || "",
    },
    {
      id: "INT-B2", zone: "INT", type: "FOUP", sku: "interposer", lotId: null, qty: 1,
      status: "stock", location: "bin:INT:B2", home: "bin:INT:B2",
    },
    {
      id: "SUB-C1", zone: "SUB", type: "MAG", sku: "substrate", lotId: null, qty: 8,
      status: "stock", location: "bin:SUB:C1", home: "bin:SUB:C1",
    },
    {
      id: "SUB-C2", zone: "SUB", type: "MAG", sku: "substrate", lotId: null, qty: 8,
      status: "stock", location: "bin:SUB:C2", home: "bin:SUB:C2",
    },
  ];
}

function idleStacker() {
  return { phase: "idle", progress: 0, carrierId: null, from: null, to: null, x: 0, y: 1.2, z: 0.2 };
}

export class Warehouse {
  constructor(carriers = []) {
    this.carriers = carriers.map((c) => ({ ...c }));
    this.log = [];
    this.stacker = idleStacker();
    this._jobs = [];
    this._seq = 1;
  }

  get(id) {
    return this.carriers.find((c) => c.id === id) || null;
  }

  available(zone, sku, type) {
    return this.carriers.find((c) =>
      c.zone === zone &&
      c.sku === sku &&
      c.type === type &&
      c.status === "stock" &&
      c.qty > 0 &&
      String(c.location).startsWith("bin:")
    ) || null;
  }

  /** Reserve a stored carrier. Does not move it and does not call a crane. */
  reserve({ zone, sku, type, lotId }) {
    const carrier = this.available(zone, sku, type);
    if (!carrier) {
      return { ok: false, reason: sku === "kgd" ? "kgd_shortage" : "no_available" };
    }
    carrier.status = "reserved";
    carrier.lotId = lotId || carrier.lotId;
    return { ok: true, carrier };
  }

  unreserve(id) {
    const carrier = this.get(id);
    if (!carrier || carrier.status !== "reserved") return;
    if (String(carrier.location).startsWith("bin:")) {
      carrier.status = "stock";
      carrier.lotId = null;
    }
  }

  pushLog(entry) {
    this.log.push({ seq: this._seq++, ...entry });
  }

  enqueueRetrieve(carrierId) {
    const carrier = this.get(carrierId);
    if (!carrier) return;
    this._jobs.push({
      job: "out",
      carrierId,
      from: carrier.location.startsWith("bin:") ? carrier.location : carrier.home,
      to: `io:${carrier.zone}`,
    });
    if (carrier.location.startsWith("bin:")) carrier._holdLoc = carrier.location;
    this._pumpStacker();
  }

  enqueueStore(carrierId, zone, { returning = false } = {}) {
    const slot = this._freeBin(zone);
    const carrier = this.get(carrierId);
    if (!carrier) return;
    carrier.zone = zone;
    carrier._return = returning;
    this._jobs.push({
      job: "in",
      carrierId,
      from: carrier.location,
      to: `bin:${zone}:${slot}`,
      zone,
    });
    this._pumpStacker();
  }

  _freeBin(zone) {
    const spec = ZONES.find((z) => z.id === zone);
    const used = new Set();
    for (const carrier of this.carriers) {
      if (String(carrier.location).startsWith(`bin:${zone}:`)) used.add(carrier.location.split(":")[2]);
    }
    for (const job of this._jobs) {
      if (String(job.to).startsWith(`bin:${zone}:`)) used.add(job.to.split(":")[2]);
    }
    if (String(this.stacker.to).startsWith(`bin:${zone}:`)) used.add(this.stacker.to.split(":")[2]);
    return spec.bins.find((bin) => !used.has(bin)) || spec.bins[spec.bins.length - 1];
  }

  _pumpStacker() {
    if (this.stacker.phase !== "idle") return;
    const job = this._jobs.shift();
    if (!job) return;
    const carrier = this.get(job.carrierId);
    carrier.location = "stacker";
    const from = this._local(job.from, carrier.zone);
    const to = this._local(job.to, job.zone || carrier.zone);
    this.stacker = {
      phase: job.job === "out" ? "to_io" : "to_bin",
      progress: 0,
      acc: 0,
      dur: LEG.stacker,
      carrierId: job.carrierId,
      from: job.from,
      to: job.to,
      fromLocal: from,
      toLocal: to,
      kind: job.job,
      x: from.x,
      y: from.y,
      z: from.z,
    };
  }

  _local(location, zone) {
    const zi = Math.max(0, ZONES.findIndex((z) => z.id === (zone || String(location).split(":")[1])));
    if (String(location).startsWith("io:")) {
      return { x: 3.05, y: 1.2, z: -2.25 + zi * 1.5 };
    }
    const slot = String(location).split(":")[2] || "A1";
    const spec = ZONES[zi];
    const si = Math.max(0, spec?.bins.indexOf(slot) ?? 0);
    return { x: -2.25 + zi * 1.5, y: 0.85 + si * 1.15, z: -0.2 };
  }

  tick(dt) {
    if (this.stacker.phase === "idle") return;
    this.stacker.acc += dt;
    const k = Math.min(1, this.stacker.acc / this.stacker.dur);
    const e = k * k * (3 - 2 * k);
    this.stacker.progress = k;
    const a = this.stacker.fromLocal;
    const b = this.stacker.toLocal;
    this.stacker.x = a.x + (b.x - a.x) * e;
    this.stacker.y = a.y + (b.y - a.y) * e;
    this.stacker.z = a.z + (b.z - a.z) * e;
    if (k < 1) return;
    const carrier = this.get(this.stacker.carrierId);
    carrier.location = this.stacker.to;
    if (this.stacker.kind === "out") {
      this.pushLog({
        kind: "issue",
        zone: carrier.zone,
        carrierId: carrier.id,
        type: carrier.type,
        lotId: carrier.lotId,
        qty: carrier.qty,
        status: carrier.status,
      });
    } else {
      const returning = !!carrier._return;
      carrier.status = "stock";
      carrier.zone = this.stacker.to.split(":")[1];
      carrier.home = carrier.location;
      carrier._return = false;
      if (returning) carrier.lotId = null;
      this.pushLog({
        kind: returning ? "return" : "putaway",
        zone: carrier.zone,
        carrierId: carrier.id,
        type: carrier.type,
        lotId: carrier.lotId,
        qty: carrier.qty,
        status: "stock",
      });
    }
    this.stacker = idleStacker();
    this._pumpStacker();
  }

  markTransit(id, vehicleId) {
    const carrier = this.get(id);
    carrier.status = "transit";
    carrier.location = `transit:${vehicleId}`;
    carrier.handoff = 0;
  }

  placeAt(id, location, status) {
    const carrier = this.get(id);
    carrier.location = location;
    if (status) carrier.status = status;
  }

  lockTool(tool) {
    for (const carrier of this.carriers) {
      if (carrier.location === `tool:${tool}` || String(carrier.location).startsWith(`port:${tool}`)) {
        carrier.status = "locked";
      }
    }
  }

  unlockTool(tool) {
    for (const carrier of this.carriers) {
      const here = carrier.location === `tool:${tool}` || String(carrier.location).startsWith(`port:${tool}`);
      if (here && carrier.status === "locked" && carrier.sku !== "kgd-issued") carrier.status = "reserved";
    }
  }

  replenishKgd(qty) {
    const carrier = this.carriers.find((c) => c.zone === "DBK" && (c.sku === "kgd" || c.sku === "kgd-issued"));
    if (!carrier) return null;
    carrier.sku = "kgd";
    carrier.type = "TRAY";
    carrier.status = "stock";
    carrier.qty = qty;
    carrier.lotId = null;
    carrier.zone = "DBK";
    carrier.location = carrier.home || "bin:DBK:A1";
    this.pushLog({
      kind: "putaway", zone: "DBK", carrierId: carrier.id, type: "TRAY",
      lotId: null, qty, status: "stock", reason: "replenish",
    });
    return carrier;
  }

  addCarrier(carrier) {
    this.carriers.push(carrier);
    return carrier;
  }

  snapshot() {
    return {
      carriers: this.carriers.map((c) => ({ ...c })),
      log: this.log.slice(-14),
      stacker: {
        phase: this.stacker.phase,
        progress: this.stacker.progress,
        carrierId: this.stacker.carrierId,
        x: this.stacker.x,
        y: this.stacker.y,
        z: this.stacker.z,
      },
    };
  }
}
