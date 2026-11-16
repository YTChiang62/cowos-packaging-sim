/**
 * 3D stocker, ceiling rail, and the two overhead vehicles.
 * Positions are copied from the warehouse / crane snapshot each frame.
 */
import * as THREE from "three";
import { box, cyl, mat } from "./mat.js";
import { RAIL_NODES, RAIL_Y, STOCKER, ZONES, railPath } from "./route.js";
import { carrierShell } from "./tools.js";

const ZONE_COLOR = { DBK: 0xd3925a, INT: 0x3ee0c0, SUB: 0xe0a15a, FG: 0xf2d7a2 };
const TYPE_COLOR = { FOUP: 0x1c6a62, TRAY: 0x2a241c, FRAME: 0xd5dbe2, MAG: 0xd3925a };

function sprite(text, color, w = 256, h = 64) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, w, h);
  g.fillStyle = color;
  g.font = `700 ${Math.floor(h * 0.62)}px 'Sora','WenQuanYi Micro Hei','Droid Sans Fallback',sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(w / 90, h / 90, 1);
  return sp;
}

function buildStocker() {
  const group = new THREE.Group();
  group.position.set(STOCKER.place.x, 0, STOCKER.place.z);
  group.name = "stocker";
  const shell = mat(0x1a2428, { roughness: 0.4, metalness: 0.55 });
  const dark = mat(0x10161a, { roughness: 0.5, metalness: 0.4 });
  box(group, 7.2, 0.28, 4.4, dark, 0.2, 0.14, 0);
  box(group, 0.16, 4.5, 4.2, shell, -3.45, 2.4, 0);
  box(group, 0.16, 4.5, 4.2, shell, 3.55, 2.4, 0);
  box(group, 7.1, 0.16, 4.2, shell, 0.05, 4.55, 0);
  box(group, 7.0, 4.3, 0.12, mat(0x142026, { roughness: 0.35, metalness: 0.4 }), 0.05, 2.35, -2.05);
  const glass = mat(0x7fdad0, { transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0.2 });
  box(group, 6.6, 3.5, 0.06, glass, 0.1, 2.4, 2.05);

  const bins = new Map();
  ZONES.forEach((zone, zi) => {
    const x = -2.25 + zi * 1.5;
    const color = ZONE_COLOR[zone.id];
    box(group, 1.25, 0.05, 0.08, mat(color, { emissive: color, emissiveIntensity: 0.45 }), x, 0.4, 1.7);
    const label = sprite(zone.id, "#" + color.toString(16).padStart(6, "0"));
    label.position.set(x, 4.15, 1.15);
    group.add(label);
    zone.bins.forEach((slot, si) => {
      const y = 0.85 + si * 1.15;
      box(group, 1.15, 0.05, 0.85, dark, x, y, -0.2);
      const proxyMat = mat(TYPE_COLOR[zone.carrier], {
        roughness: 0.4,
        metalness: 0.35,
        emissive: color,
        emissiveIntensity: 0.08,
      });
      const proxy = box(group, 0.72, 0.22, 0.48, proxyMat, x, y + 0.18, -0.2);
      const key = `bin:${zone.id}:${slot}`;
      bins.set(key, { mesh: proxy, mat: proxyMat, color });
    });
  });

  const ios = [];
  ZONES.forEach((zone, zi) => {
    const z = -2.25 + zi * 1.5;
    const color = ZONE_COLOR[zone.id];
    box(group, 0.7, 0.08, 0.7, mat(color, { emissive: color, emissiveIntensity: 0.25, roughness: 0.35 }), 3.15, 1.05, z);
    const anchor = new THREE.Object3D();
    anchor.position.set(3.15, 1.2, z);
    group.add(anchor);
    ios.push(anchor);
  });

  const stacker = new THREE.Group();
  const mast = box(stacker, 0.12, 4.2, 0.12, mat(0xb7c0c6, { metalness: 0.8, roughness: 0.25 }), 0, 2.2, 0.55);
  mast.position.set(0, 2.2, 0.55);
  const carriage = new THREE.Group();
  box(carriage, 0.85, 0.12, 0.7, mat(0xd3925a, { metalness: 0.6, roughness: 0.3 }), 0, 0, 0);
  stacker.add(carriage);
  group.add(stacker);

  const title = sprite("WMS", "#f0c08a", 320, 72);
  title.position.set(0.2, 5.05, 0);
  title.scale.set(4.2, 0.95, 1);
  group.add(title);

  return { group, bins, ios, stacker, carriage };
}

function buildRail() {
  const group = new THREE.Group();
  group.name = "oht-rail";
  const railMat = mat(0xc6a36a, { metalness: 0.72, roughness: 0.28 });
  const rail = railPath();
  for (const seg of rail.segs) {
    const dx = seg.b.x - seg.a.x;
    const dz = seg.b.z - seg.a.z;
    const len = Math.max(0.2, seg.len);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.16), railMat);
    beam.position.set((seg.a.x + seg.b.x) / 2, RAIL_Y, (seg.a.z + seg.b.z) / 2);
    beam.rotation.y = Math.atan2(dx, dz);
    beam.castShadow = true;
    group.add(beam);
    const twin = beam.clone();
    twin.position.y = RAIL_Y + 0.22;
    group.add(twin);
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), railMat);
    hanger.position.set(beam.position.x, RAIL_Y + 0.7, beam.position.z);
    group.add(hanger);
  }
  for (const node of RAIL_NODES) {
    if (!node.id.startsWith("io") && !["DBK-02", "HB-21", "DIC-81", "WOS-04", "BPK-05"].includes(node.id)) continue;
    const stub = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.12), railMat);
    stub.position.set(node.x + 1.15, RAIL_Y - 0.05, node.z);
    group.add(stub);
  }
  return group;
}

function buildVehicle(id, tint) {
  const group = new THREE.Group();
  group.name = id;
  const body = mat(tint, { metalness: 0.62, roughness: 0.28, emissive: tint, emissiveIntensity: 0.18 });
  box(group, 1.25, 0.28, 0.72, body, 0, -0.05, 0);
  box(group, 0.18, 0.22, 0.5, mat(0x101418, { metalness: 0.5, roughness: 0.4 }), -0.4, -0.28, 0);
  box(group, 0.18, 0.22, 0.5, mat(0x101418, { metalness: 0.5, roughness: 0.4 }), 0.4, -0.28, 0);
  const cable = cyl(group, 0.025, 0.025, 1, mat(0xd7dde2, { metalness: 0.8, roughness: 0.2 }), 0, -0.8, 0);
  const grip = new THREE.Group();
  box(grip, 0.72, 0.1, 0.42, body, 0, 0, 0);
  box(grip, 0.08, 0.28, 0.08, body, -0.28, -0.16, 0);
  box(grip, 0.08, 0.28, 0.08, body, 0.28, -0.16, 0);
  group.add(grip);
  const tag = sprite(id, "#e8f3f0", 256, 64);
  tag.position.set(0, 0.45, 0);
  tag.scale.set(1.5, 0.38, 1);
  group.add(tag);
  return { group, cable, grip };
}

export class FacilityView {
  constructor(scene) {
    this.scene = scene;
    this.stock = buildStocker();
    scene.add(this.stock.group);
    scene.add(buildRail());
    this.vehicles = new Map();
    [["OHT-1", 0xd3925a], ["OHT-2", 0x3ee0c0]].forEach(([id, tint]) => {
      const vehicle = buildVehicle(id, tint);
      scene.add(vehicle.group);
      this.vehicles.set(id, { ...vehicle, siding: 1 });
    });
    this.carriers = new Map();
    this._ioWorld = new THREE.Vector3();
    this._port = new THREE.Vector3();
  }

  carrierGroup(carrier) {
    let rec = this.carriers.get(carrier.id);
    if (rec && rec.type !== carrier.type) {
      this.scene.remove(rec.group);
      this.carriers.delete(carrier.id);
      rec = null;
    }
    if (!rec) {
      const group = new THREE.Group();
      group.add(carrierShell(carrier.type));
      group.userData.type = carrier.type;
      this.scene.add(group);
      rec = { group, type: carrier.type };
      this.carriers.set(carrier.id, rec);
    }
    return rec.group;
  }

  sync(snap, tools, dt, soloTool) {
    if (!snap) return;
    const onStacker = snap.stacker?.carrierId;
    for (const [key, bin] of this.stock.bins) {
      const occupant = snap.carriers.find((c) => c.location === key);
      const filled = !!(occupant && occupant.qty > 0 && occupant.id !== onStacker);
      bin.mesh.visible = filled || !!(occupant && occupant.status === "locked");
      bin.mat.emissiveIntensity = occupant?.status === "locked" ? 0.85 : filled ? 0.12 : 0.02;
      bin.mat.color.setHex(occupant?.status === "locked" && !(occupant.qty > 0) ? 0x6a3038 : TYPE_COLOR[occupant?.type] || bin.color);
    }
    if (snap.stacker) {
      this.stock.stacker.position.x = snap.stacker.x || 0;
      this.stock.carriage.position.set(0, snap.stacker.y || 1.2, snap.stacker.z || 0);
    }
    this.stock.group.updateWorldMatrix(true, true);

    for (const vehicle of snap.vehicles || []) {
      const view = this.vehicles.get(vehicle.id);
      if (!view) continue;
      const goal = vehicle.onSiding ? 1 : 0;
      view.siding += (goal - view.siding) * Math.min(1, dt * 3.5);
      view.group.position.set(vehicle.x + view.siding * 1.35, vehicle.y, vehicle.z);
      const drop = 0.45 + (vehicle.hoist || 0) * 4.35;
      view.grip.position.set(0, -drop, 0);
      view.cable.scale.y = Math.max(0.2, drop - 0.2);
      view.cable.position.y = -0.25 - (drop - 0.2) / 2;
      const moving = vehicle.state !== "idle" && vehicle.state !== "paused";
      view.group.children[0].material.emissiveIntensity = moving ? 0.55 : 0.16;
    }
    this.scene.updateMatrixWorld(true);

    const slotCount = new Map();
    for (const carrier of snap.carriers) {
      const mesh = this.carrierGroup(carrier);
      const loc = carrier.location || "";
      const inBin = loc.startsWith("bin:");
      mesh.visible = !inBin;
      if (inBin) continue;
      if (loc === "stacker") {
        this.stock.carriage.getWorldPosition(this._ioWorld);
        mesh.position.copy(this._ioWorld);
        mesh.position.y -= 0.15;
        continue;
      }
      if (loc.startsWith("transit:")) {
        const vehicle = this.vehicles.get(loc.slice(8));
        if (vehicle) {
          vehicle.grip.getWorldPosition(this._ioWorld);
          mesh.position.copy(this._ioWorld);
          mesh.position.y -= carrier.type === "FOUP" || carrier.type === "MAG" ? 1.15 : 0.72;
        }
        continue;
      }
      if (loc.startsWith("io:")) {
        const zi = Math.max(0, ZONES.findIndex((z) => z.id === loc.slice(3)));
        const anchor = this.stock.ios[zi];
        anchor.getWorldPosition(this._ioWorld);
        mesh.position.copy(this._ioWorld);
        continue;
      }
      const toolId = loc.startsWith("tool:") ? loc.slice(5) : (loc.startsWith("port:") ? loc.slice(5).split(":")[0] : null);
      const rec = toolId && tools.get(toolId);
      if (!rec) {
        mesh.visible = false;
        continue;
      }
      rec.load.getWorldPosition(this._port);
      const n = slotCount.get(toolId) || 0;
      slotCount.set(toolId, n + 1);
      mesh.position.copy(this._port);
      mesh.position.x += (n - 0.5) * 0.9;
    }

    for (const [id, rec] of tools) {
      const open = id === soloTool || snap.carriers.some((c) => c.location === `tool:${id}` || String(c.location).startsWith(`port:${id}`));
      if (rec.parts?.door) {
        const target = open ? 0.82 : 0;
        rec.parts.door.position.x += (target - rec.parts.door.position.x) * Math.min(1, dt * 3);
      }
      if (rec.parts?.pad) rec.parts.pad.emissiveIntensity = open ? 0.85 : 0.08;
    }
  }
}
