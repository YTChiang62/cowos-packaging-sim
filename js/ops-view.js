/**
 * Billboard chips for the ops snapshot, plus the small companion-lot meshes.
 * Sprites and these meshes are not walk solids and they are not tool bodies.
 */
import * as THREE from "three";
import { presentChip } from "./ops.js";
import { PARKS } from "./route.js";

const FAMILY = "'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC','Microsoft JhengHei',sans-serif";

const BAY_ANCHOR = Object.fromEntries(PARKS.map((park) => [park.id, { x: park.x, z: -16 }]));

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function makeSprite() {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 420;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0.5);
  sprite.renderOrder = 24;
  sprite.frustumCulled = false;
  sprite.userData.canvas = cv;
  sprite.userData.ctx = g;
  sprite.userData.tex = tex;
  sprite.visible = false;
  return sprite;
}

function fit(g, text, px, weight, maxWidth) {
  let size = px;
  g.font = `${weight} ${size}px ${FAMILY}`;
  while (size > 28 && g.measureText(text).width > maxWidth) {
    size -= 2;
    g.font = `${weight} ${size}px ${FAMILY}`;
  }
  return size;
}

function paint(sprite, spec) {
  const cv = sprite.userData.canvas;
  const g = sprite.userData.ctx;
  const second = !!(spec.showAlarm || spec.showQueue || spec.reason);
  const plateH = second ? 360 : 210;
  if (cv.height !== plateH) cv.height = plateH;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = "rgba(7,16,22,0.94)";
  roundRect(g, 14, 12, cv.width - 28, plateH - 24, 36);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = spec.showAlarm ? "#ff6b7a" : (spec.accent || "#d3925a");
  g.stroke();

  g.textBaseline = "middle";
  const titleY = second ? 118 : plateH / 2;
  g.textAlign = "left";
  fit(g, spec.title, second ? 76 : 88, 700, spec.showLoad ? 600 : 920);
  g.fillStyle = "#f4faf8";
  g.fillText(spec.title, 48, titleY);

  if (spec.showLoad) {
    const label = `${spec.load}%`;
    g.textAlign = "right";
    fit(g, label, second ? 80 : 92, 700, 300);
    g.fillStyle = spec.showAlarm ? "#ffb4bc" : spec.load >= 80 ? "#f0c14b" : "#8dffe4";
    g.fillText(label, cv.width - 48, titleY);
  }

  if (second) {
    let x = 48;
    const metaY = 258;
    g.textAlign = "left";
    if (spec.showAlarm) {
      g.fillStyle = "#ff6b7a";
      g.beginPath();
      g.arc(x + 16, metaY, 16, 0, Math.PI * 2);
      g.fill();
      fit(g, spec.alarmLabel, 58, 650, 320);
      g.fillStyle = "#ffd4d8";
      g.fillText(spec.alarmLabel, x + 44, metaY);
      x += 44 + g.measureText(spec.alarmLabel).width + 32;
    }
    if (spec.showQueue) {
      fit(g, spec.queueLabel, 58, 650, 420);
      g.fillStyle = "#f0c14b";
      g.fillText(spec.queueLabel, x, metaY);
      x += g.measureText(spec.queueLabel).width + 28;
    }
    if (spec.reason) {
      fit(g, spec.reason, 40, 500, Math.max(80, cv.width - x - 48));
      g.fillStyle = "#d5e2e4";
      g.fillText(spec.reason, x, metaY);
    }
  }
  sprite.userData.tex.needsUpdate = true;
  sprite.userData.plateH = plateH;
}

export class OpsView {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "ops-overlay";
    this.scene.add(this.root);
    this.entries = [];
    this.snapshot = null;
    this.layers = null;
    this.tFn = (key) => key;
    this.toolAnchor = new Map();
  }

  setAnchors(tools) {
    this.toolAnchor.clear();
    for (const tool of tools) {
      this.toolAnchor.set(tool.id, { x: tool.x, z: tool.z, face: tool.face });
    }
  }

  clear() {
    for (const entry of this.entries) {
      this.root.remove(entry.sprite);
      entry.sprite.material.map.dispose();
      entry.sprite.material.dispose();
    }
    this.entries = [];
    this.snapshot = null;
  }

  sync(snapshot, layers, tFn) {
    this.tFn = tFn || this.tFn;
    this.layers = layers;
    this.snapshot = snapshot;
    if (!snapshot) {
      this.clear();
      return;
    }
    const chips = snapshot.chips;
    while (this.entries.length < chips.length) {
      const sprite = makeSprite();
      this.root.add(sprite);
      this.entries.push({ sprite, chip: null, sig: "", rich: false });
    }
    while (this.entries.length > chips.length) {
      const entry = this.entries.pop();
      this.root.remove(entry.sprite);
      entry.sprite.material.map.dispose();
      entry.sprite.material.dispose();
    }
    chips.forEach((chip, index) => {
      this.entries[index].chip = chip;
    });
    this.pose(this._ctx || { walking: false, camY: 110, nearbyTool: null });
  }

  pose(ctx) {
    this._ctx = ctx || this._ctx || { walking: false, camY: 110, nearbyTool: null };
    if (!this.snapshot) return;
    for (const entry of this.entries) this._place(entry, this._ctx);
  }

  _spec(entry, ctx) {
    const chip = entry.chip;
    const parts = presentChip(chip, this.layers);
    const rich = !!(parts.visible && chip.kind === "tool" && ctx.nearbyTool && ctx.nearbyTool === chip.id);
    const t = this.tFn;
    let reason = "";
    if (rich) {
      if (chip.alarmReason) reason = t(`opsReason_${chip.alarmReason}`);
      else if (chip.material) reason = t("opsReason_kgd");
      else reason = t(`opsBay_${chip.bay}`);
    }
    if (chip.kind === "tool" && chip.eq && chip.eq !== "IDLE" && chip.eq !== "RUN") {
      const eqLabel = t(`eq_${chip.eq}`);
      reason = reason ? `${eqLabel} · ${reason}` : eqLabel;
    }
    const title = chip.kind === "bay" ? t(`opsBay_${chip.id}`) : chip.id;
    return {
      parts,
      rich,
      title,
      load: chip.load,
      accent: chip.accent,
      showLoad: parts.load,
      showAlarm: parts.alarm,
      showQueue: parts.queue,
      alarmLabel: t("opsChipAlarm"),
      queueLabel: t("opsChipQueue", { n: chip.queue }),
      reason,
    };
  }

  _place(entry, ctx) {
    const spec = this._spec(entry, ctx);
    const chip = entry.chip;
    const walking = !!ctx.walking;
    const camY = ctx.camY ?? 110;
    const sig = [
      spec.title,
      spec.load,
      spec.showLoad ? 1 : 0,
      spec.showAlarm ? 1 : 0,
      spec.showQueue ? 1 : 0,
      spec.queueLabel,
      spec.reason,
      spec.accent,
      spec.rich ? 1 : 0,
    ].join("|");
    if (sig !== entry.sig) {
      entry.sig = sig;
      entry.rich = spec.rich;
      paint(entry.sprite, spec);
    }
    entry.sprite.visible = spec.parts.visible;
    if (!spec.parts.visible) return;

    const overview = camY > 36 && !walking;
    const plateH = entry.sprite.userData.plateH || 210;
    if (chip.kind === "bay") {
      const anchor = BAY_ANCHOR[chip.id];
      const aisle = anchor.z < 0 ? 1 : -1;
      const y = overview ? 4.6 : walking ? 5.4 : 6.2;
      entry.sprite.position.set(anchor.x, y, anchor.z + aisle * (overview ? 3.4 : 0.6));
      const width = overview ? 12.4 : walking ? 4.2 : 7.4;
      entry.sprite.scale.set(width, width * (plateH / 1024), 1);
      return;
    }

    const anchor = this.toolAnchor.get(chip.id) || { x: 0, z: 0, face: 1 };
    const aisle = anchor.face >= 0 ? 1 : -1;
    const y = overview ? 4.4 : spec.rich ? 2.55 : walking ? 4.2 : 4.8;
    const zLift = overview ? 0.2 : spec.rich ? 0.15 : 0.85;
    entry.sprite.position.set(anchor.x, y, anchor.z + aisle * zLift);
    const width = overview ? 5.6 : spec.rich ? 1.7 : walking ? 2.15 : 4.2;
    entry.sprite.scale.set(width, width * (plateH / 1024), 1);
  }
}

const LOT_COLORS = [0x3ee0c0, 0x8aa0ff, 0xe0a15a, 0xe7a098];

function makeCompanionMesh(slot) {
  const color = LOT_COLORS[slot % LOT_COLORS.length];
  const group = new THREE.Group();
  group.name = "companion-lot";
  const wafer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.04, 18),
    new THREE.MeshStandardMaterial({ color: 0xd5dee4, metalness: 0.62, roughness: 0.28 })
  );
  const die = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.045, 0.13),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 0.4 })
  );
  die.position.y = 0.055;
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.02, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xf4f7f8, metalness: 0.4, roughness: 0.35 })
  );
  cap.position.y = 0.09;
  group.add(wafer, die, cap);
  group.userData.die = die;
  return group;
}

/** Small product meshes for companion lots. Not crane jobs and not walk solids. */
export class CompanionLayer {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = "companion-lots";
    this.scene.add(this.root);
    this.meshes = [];
    this.selected = null;
  }

  sync(companions, locate) {
    const list = companions || [];
    while (this.meshes.length < list.length) {
      const mesh = makeCompanionMesh(this.meshes.length);
      this.root.add(mesh);
      this.meshes.push(mesh);
    }
    this.meshes.forEach((mesh, index) => {
      const lot = list[index];
      mesh.visible = !!lot;
      if (!lot) return;
      mesh.userData.lotId = lot.id;
      mesh.traverse((obj) => {
        obj.userData.lotId = lot.id;
      });
      const pos = locate ? locate(lot.tool, lot.slot ?? index) : { x: 0, y: 1, z: 0 };
      if (!mesh.userData.placed) {
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.userData.placed = true;
      }
      mesh.userData.goal = pos;
      const on = this.selected === lot.id;
      mesh.scale.setScalar(on ? 1.35 : 1);
      if (mesh.userData.die?.material) mesh.userData.die.material.emissiveIntensity = on ? 0.85 : 0.22;
    });
  }

  setSelected(id) {
    this.selected = id || null;
    for (const mesh of this.meshes) {
      const on = !!this.selected && mesh.userData.lotId === this.selected && mesh.visible;
      mesh.scale.setScalar(on ? 1.35 : 1);
      if (mesh.userData.die?.material) mesh.userData.die.material.emissiveIntensity = on ? 0.85 : 0.22;
    }
  }

  pose(dt) {
    const k = Math.min(1, (dt || 0) * 1.8);
    for (const mesh of this.meshes) {
      const goal = mesh.userData.goal;
      if (!mesh.visible || !goal) continue;
      mesh.position.x += (goal.x - mesh.position.x) * k;
      mesh.position.y += (goal.y - mesh.position.y) * k;
      mesh.position.z += (goal.z - mesh.position.z) * k;
    }
  }

  pick(raycaster) {
    const visible = this.meshes.filter((mesh) => mesh.visible);
    if (!visible.length) return null;
    const hits = raycaster.intersectObjects(visible, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && !obj.userData.lotId && obj.parent) obj = obj.parent;
    return obj?.userData.lotId || null;
  }

  worldPoint(id, target) {
    const mesh = this.meshes.find((item) => item.visible && item.userData.lotId === id);
    if (!mesh) return null;
    return mesh.getWorldPosition(target);
  }
}
