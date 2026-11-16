import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { FacilityView } from "./facility-view.js";
import { HOLD_AT, RAIL_Y, STATIONS, stationById } from "./route.js";
import { motion, smooth, specForMorph } from "./morph.js";
import { Workpiece } from "./product.js";
import { seedCarriers } from "./warehouse.js";
import { STOW_ANCHOR, buildTool, carrierShell, poseTool } from "./tools.js";

const BAYS = [
  { id: "incoming", x: -34, z: -16, w: 20, d: 18, color: 0x3a2a1c },
  { id: "cow", x: -5, z: -16, w: 28, d: 18, color: 0x102824 },
  { id: "grind", x: 24, z: -16, w: 18, d: 18, color: 0x152028 },
  { id: "dice", x: -34, z: 16, w: 20, d: 18, color: 0x1a1a30 },
  { id: "wos", x: -2, z: 16, w: 32, d: 18, color: 0x2a2214 },
  { id: "test", x: 23, z: 16, w: 11, d: 18, color: 0x102420 },
  { id: "pack", x: 34, z: 16, w: 10, d: 18, color: 0x262018 },
];

const BAY_ACCENT = {
  incoming: 0xd3925a,
  cow: 0x3ee0c0,
  grind: 0x7ec8e0,
  dice: 0x8aa0ff,
  wos: 0xe0a15a,
  test: 0x5ee0c8,
  pack: 0xd7c4a0,
};

const LABEL_FONT = "700 42px 'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC','Microsoft JhengHei',sans-serif";
const SUB_FONT = "500 26px 'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC','Microsoft JhengHei',sans-serif";

function makeFloorTexture() {
  const s = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#1c2e34";
  g.fillRect(0, 0, s, s);
  g.fillStyle = "rgba(211,146,90,0.16)";
  for (let y = 40; y < s; y += 18) {
    for (let x = 40; x < s; x += 18) {
      g.beginPath();
      g.arc(x + ((y / 18) % 2) * 4, y, 1.3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = "rgba(211,146,90,0.28)";
  g.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    const y = 80 + i * 68;
    g.beginPath();
    g.moveTo(40, y);
    g.bezierCurveTo(400, y + 20, 900, y - 18, 2000, y + 8);
    g.stroke();
  }
  const toPx = (m, origin, span, size) => ((m - origin) / span) * size;
  const worldW = 100;
  const worldD = 80;
  const ox = -50;
  const oz = -40;
  for (const bay of BAYS) {
    const x = toPx(bay.x - bay.w / 2, ox, worldW, s);
    const z = toPx(bay.z - bay.d / 2, oz, worldD, s);
    const w = (bay.w / worldW) * s;
    const d = (bay.d / worldD) * s;
    const col = "#" + BAY_ACCENT[bay.id].toString(16).padStart(6, "0");
    g.fillStyle = "rgba(80,120,120,0.10)";
    g.fillRect(x, z, w, d);
    g.strokeStyle = col;
    g.globalAlpha = 0.7;
    g.lineWidth = 4;
    g.strokeRect(x + 6, z + 6, w - 12, d - 12);
    g.globalAlpha = 1;
  }
  g.strokeStyle = "rgba(211,146,90,0.35)";
  g.setLineDash([16, 14]);
  g.lineWidth = 5;
  const aisleZ = toPx(0, oz, worldD, s);
  g.beginPath();
  g.moveTo(toPx(-46, ox, worldW, s), aisleZ);
  g.lineTo(toPx(42, ox, worldW, s), aisleZ);
  g.stroke();
  g.setLineDash([]);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function labelSprite(title, sub, accent) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 128;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sp.scale.set(4.4, 1.1, 1);
  sp.center.set(0.5, 0);
  sp.userData.redraw = (t, s, a) => {
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = "rgba(8,18,22,0.82)";
    roundRect(g, 8, 16, 496, 96, 20);
    g.fill();
    g.strokeStyle = a || accent || "rgba(211,146,90,0.7)";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#e8f3f0";
    g.font = LABEL_FONT;
    g.fillText(t, 28, 62);
    g.fillStyle = "#8aa3a8";
    g.font = SUB_FONT;
    g.fillText(s, 28, 94);
    tex.needsUpdate = true;
  };
  sp.userData.redraw(title, sub, accent);
  return sp;
}

function bayLabel(text, accent) {
  const cv = document.createElement("canvas");
  cv.width = 768;
  cv.height = 128;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false }));
  sp.scale.set(8, 1.35, 1);
  sp.position.y = 0.12;
  sp.userData.redraw = (t) => {
    g.clearRect(0, 0, 768, 128);
    g.fillStyle = accent;
    g.globalAlpha = 0.9;
    g.font = "700 64px 'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC',sans-serif";
    g.textAlign = "center";
    g.fillText(t, 384, 84);
    tex.needsUpdate = true;
  };
  sp.userData.redraw(text);
  return sp;
}

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.45,
    metalness: opts.metalness ?? 0.35,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

export class Plant {
  constructor(canvas) {
    this.canvas = canvas;
    this.t = 0;
    this.spin = 0;
    this.follow = false;
    this.tFn = (k) => k;
    this.lang = "zh-TW";
    this.tools = new Map();
    this.currentToolId = STATIONS[0].tool;
    this.carrierType = "FOUP";
    this.transport = null;
    this.pickup = null;
    this.handoff = null;
    this.mode = "idle";
    this.live = null;
    this.solo = null;
    this.frozen = false;
    this._shown = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x071016, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x071016, 140, 280);
    this.camera = new THREE.PerspectiveCamera(42, this._aspect(), 0.1, 220);
    this.camera.position.set(4, 36, 42);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.42;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 80;
    this.controls.target.set(-32, 2, 0);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this._buildWorld();
    this._buildBays();
    this._buildTools();
    this._buildDemoCarrier();
    this.view = new FacilityView(this.scene);
    this.view.sync({
      carriers: seedCarriers({ id: "PREVIEW", wafer: "" }),
      stacker: { phase: "idle", x: -0.4, y: 2.0, z: -0.2 },
      vehicles: [
        { id: "OHT-1", state: "idle", x: -46, y: RAIL_Y, z: -15.6, hoist: 0, onSiding: true },
        { id: "OHT-2", state: "idle", x: 42, y: RAIL_Y, z: -15.6, hoist: 0, onSiding: true },
      ],
    }, this.tools, 1, null);
    this.workpiece = new Workpiece();
    this.scene.add(this.workpiece.group);
    this.showLot("bank", STATIONS[0].tool, "FOUP");
    this.resize();
  }

  _aspect() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    return w / Math.max(1, h);
  }

  setTranslator(fn, lang) {
    this.tFn = fn;
    this.lang = lang;
    this.relabel();
    this._refreshCaption();
  }

  relabel() {
    for (const [id, rec] of this.tools) {
      const accent = "#" + BAY_ACCENT[rec.bay].toString(16).padStart(6, "0");
      rec.label.userData.redraw(id, this.tFn("step_" + rec.station.id), accent);
    }
    for (const bay of BAYS) {
      const sp = this.scene.getObjectByName(`bay-label-${bay.id}`);
      if (sp?.userData.redraw) sp.userData.redraw(this.tFn(`bay_${bay.id}`));
    }
  }

  blocksSync() {
    return this.mode === "live" || this.mode === "hold" || this.mode === "solo" || this.mode === "soloHold" || !!this.transport || !!this.handoff;
  }

  watch(session) {
    this.session = session || null;
    this.facilityBound = !!session?.facility;
  }

  showLot(morph, toolId, carrier) {
    if (this.facilityBound) return;
    if (this.mode === "live" || this.mode === "hold" || this.mode === "solo" || this.mode === "soloHold") return;
    if (this.transport || this.handoff) return;
    if (this._shown && this._shown.morph === morph && this._shown.toolId === toolId && this._shown.carrier === carrier) return;
    this.mode = "idle";
    this.setCarrier(carrier);
    this._placeCarrier(toolId);
    const chuck = this.tools.get(toolId).chuck;
    chuck.attach(this.workpiece.group);
    this.workpiece.group.position.set(0, 0, 0);
    this.workpiece.group.scale.setScalar(1);
    this.workpiece.compact = false;
    const spec = specForMorph(morph);
    this._apply(spec.station, spec.t, 0);
    this.workpiece.setCaption(this.tFn("cap_" + morph));
    this._shown = { morph, toolId, carrier };
    this.currentToolId = toolId;
  }

  beginLive(stationId, faultStart) {
    const station = stationById(stationId);
    this.solo = null;
    this.mode = "live";
    this.frozen = false;
    this.live = { stationId, t: 0, fault: faultStart ? 1 : 0, faultStart: faultStart ? 1 : 0, decaying: false };
    this._shown = null;
    this.dockTo(station.tool);
    this.focusWork(station.tool);
    this._apply(stationId, 0, this.live.fault);
  }

  setLiveT(t) {
    if (!this.live) return;
    this.live.t = t;
    if (this.live.faultStart && !this.live.decaying) this.live.fault = 1;
    else if (this.live.decaying) {
      const u = Math.min(1, Math.max(0, (t - HOLD_AT) / (1 - HOLD_AT)));
      this.live.fault = 1 - smooth(u);
    } else this.live.fault = 0;
    this._apply(this.live.stationId, this.live.t, this.live.fault);
  }

  freeze() {
    this.frozen = true;
    if (this.live) this.mode = "hold";
  }

  beginDecay() {
    if (!this.live) return;
    this.frozen = false;
    this.live.decaying = true;
    this.mode = "live";
    this.setLiveT(this.live.t);
  }

  endLive() {
    this.mode = "idle";
    this.live = null;
    this.frozen = false;
    this._shown = null;
  }

  settle() {
    this.mode = "idle";
    this.frozen = false;
    this.live = null;
    const spec = specForMorph("packed");
    this._apply(spec.station, 1, 0);
    this.workpiece.setCaption(this.tFn("cap_packed"));
    this._shown = { morph: "packed", toolId: stationById("ballpack").tool, carrier: "TRAY" };
  }

  playSolo(stationId) {
    if (this.mode === "live" || this.mode === "hold" || this.transport) return false;
    const station = stationById(stationId);
    if (!station) return false;
    this.handoff = null;
    this.mode = "solo";
    this.solo = { stationId, acc: 0, dur: station.duration, wait: true };
    this._shown = null;
    this.setCarrier(station.carrier);
    this.carrier.visible = true;
    if (this.carrier.parent !== this.scene) this.scene.attach(this.carrier);
    this.carrier.position.copy(this.loadportWorld(station.tool));
    this.carrier.attach(this.workpiece.group);
    this.workpiece.group.position.set(0, 0.35, 0);
    this.workpiece.group.scale.setScalar(0.42);
    this.workpiece.compact = true;
    this.focusWork(station.tool);
    this._apply(stationId, 0, 0);
    this.dockTo(station.tool, () => {
      if (this.solo && this.solo.stationId === stationId) this.solo.wait = false;
    });
    return true;
  }

  cancelSolo() {
    if (this.mode !== "solo" && this.mode !== "soloHold") return;
    this.mode = "idle";
    this.solo = null;
    this.handoff = null;
    this._shown = null;
    this.carrier.visible = false;
  }

  _apply(stationId, t, fault) {
    const m = motion(stationId, t, fault);
    this.workpiece.applyPose(m.pose, this.workpiece.compact);
    const station = stationById(stationId);
    const rec = this.tools.get(station.tool);
    if (rec) poseTool(rec, m, this.spin);
    const cap = fault > 0.55 ? this.tFn("cap_hold_" + stationId) : this.tFn(t > 0.72 ? "cap_" + station.morphOut : "cap_" + station.morphIn);
    this.workpiece.setCaption(cap);
    this._lastStation = stationId;
  }

  _refreshCaption() {
    if (this._lastStation != null && (this.mode === "live" || this.mode === "hold" || this.mode === "solo" || this.mode === "soloHold")) {
      const t = this.mode.startsWith("solo") ? (this.mode === "soloHold" ? 1 : (this.solo?.acc || 0) / (this.solo?.dur || 1)) : (this.live?.t || 0);
      const fault = this.live?.fault || 0;
      this._apply(this.mode.startsWith("solo") ? this.solo.stationId : this.live.stationId, t, this.mode.startsWith("solo") ? 0 : fault);
    } else if (this._shown) {
      this.workpiece.setCaption(this.tFn("cap_" + this._shown.morph));
    }
  }

  _buildWorld() {
    const hemi = new THREE.HemisphereLight(0xd5eef2, 0x24180e, 1.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xf2e6d0, 1.35);
    sun.position.set(24, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.bias = -0.0007;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x4aa89c, 0.35);
    fill.position.set(-30, 22, -12);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x9fd4ff, 0.22);
    rim.position.set(-40, 18, 30);
    this.scene.add(rim);
    const stockerLight = new THREE.PointLight(0xf0c08a, 8, 22);
    stockerLight.position.set(-46, 4.2, 0);
    this.scene.add(stockerLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 80),
      new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.82, metalness: 0.18 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(102, 0.6, 82), stdMat(0x141c20, { roughness: 0.9, metalness: 0.05 }));
    skirt.position.y = -0.36;
    this.scene.add(skirt);

    const wallMat = stdMat(0x6ec8c0, { transparent: true, opacity: 0.07, roughness: 0.1, metalness: 0.2 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(96, 6.5, 0.12), wallMat);
    wall.position.set(0, 3.2, -39);
    this.scene.add(wall);
    const wall2 = wall.clone();
    wall2.position.z = 39;
    this.scene.add(wall2);
    const wall3 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.5, 78), wallMat);
    wall3.position.set(-48, 3.2, 0);
    this.scene.add(wall3);
    const wall4 = wall3.clone();
    wall4.position.x = 46;
    this.scene.add(wall4);
  }

  _buildBays() {
    const glass = stdMat(0x7fdad0, { transparent: true, opacity: 0.09, roughness: 0.08, metalness: 0.15 });
    const frame = stdMat(0xb8874e, { roughness: 0.35, metalness: 0.7 });
    for (const bay of BAYS) {
      const group = new THREE.Group();
      group.position.set(bay.x, 0, bay.z);
      const hw = bay.w / 2;
      const hd = bay.d / 2;
      const h = 3.8;
      for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), frame);
        p.position.set(px, h / 2, pz);
        p.castShadow = true;
        group.add(p);
      }
      const toward = (pz) => (bay.z < 0 && pz > 0) || (bay.z > 0 && pz < 0);
      for (const [px, pz, sx, sz] of [[0, -hd, bay.w, 0.06], [0, hd, bay.w, 0.06], [-hw, 0, 0.06, bay.d], [hw, 0, 0.06, bay.d]]) {
        if (toward(pz) && sx > 1) {
          const doorW = Math.min(8, bay.w * 0.45);
          const side = (bay.w - doorW) / 2;
          for (const sign of [-1, 1]) {
            const pane = new THREE.Mesh(new THREE.BoxGeometry(side, 2.8, 0.06), glass);
            pane.position.set(sign * (doorW / 2 + side / 2), 1.6, pz);
            group.add(pane);
          }
        } else {
          const pane = new THREE.Mesh(new THREE.BoxGeometry(sx, 2.8, sz), glass);
          pane.position.set(px, 1.6, pz);
          group.add(pane);
        }
      }
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(bay.w - 0.6, 0.06, bay.d - 0.6),
        stdMat(bay.color, { roughness: 0.7, metalness: 0.15 })
      );
      plinth.position.y = 0.03;
      plinth.receiveShadow = true;
      group.add(plinth);
      const accent = "#" + BAY_ACCENT[bay.id].toString(16).padStart(6, "0");
      const lab = bayLabel(bay.id.toUpperCase(), accent);
      lab.name = `bay-label-${bay.id}`;
      lab.position.set(0, 0.14, bay.z < 0 ? hd - 1.2 : -hd + 1.2);
      group.add(lab);
      this.scene.add(group);
    }
  }

  _buildDemoCarrier() {
    this.carrier = new THREE.Group();
    this.shell = new THREE.Group();
    this.carrierAnchor = new THREE.Group();
    this.carrier.add(this.shell);
    this.carrier.add(this.carrierAnchor);
    this.carrier.visible = false;
    this.scene.add(this.carrier);
    this.setCarrier("FOUP");
  }

  _buildTools() {
    for (const station of STATIONS) {
      const built = buildTool(station);
      const accent = "#" + BAY_ACCENT[station.place.bay].toString(16).padStart(6, "0");
      const label = labelSprite(station.tool, station.id, accent);
      label.position.set(0, 3.25, 0);
      built.group.add(label);
      const work = new THREE.PointLight(0xfff4e4, 1.8, 7);
      work.position.set(0, 1.45, 0.2);
      built.chuck.add(work);
      this.scene.add(built.group);
      this.tools.set(station.tool, {
        ...built,
        station,
        id: station.tool,
        bay: station.place.bay,
        face: station.place.face,
        label,
        status: "idle",
      });
      poseTool(this.tools.get(station.tool), motion(station.id, 0, 0), 0);
    }
  }

  _buildShuttle() {
    /* The overhead vehicles live in FacilityView. Solo replay uses the demo carrier. */
  }

  setCarrier(type) {
    const next = type || "FOUP";
    if (next === this.carrierType && this.shell.children.length) return;
    this.carrierType = next;
    while (this.shell.children.length) {
      const child = this.shell.children[0];
      child.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
      this.shell.remove(child);
    }
    this.shell.add(carrierShell(next));
    this.carrierAnchor.position.copy(STOW_ANCHOR[next] || STOW_ANCHOR.FOUP);
  }

  loadportWorld(toolId, target = new THREE.Vector3()) {
    this.tools.get(toolId).load.getWorldPosition(target);
    return target;
  }

  _placeCarrier(toolId) {
    if (this.carrier.parent !== this.scene) this.scene.attach(this.carrier);
    const p = this.loadportWorld(toolId);
    this.carrier.position.copy(p);
    this.currentToolId = toolId;
    const rec = this.tools.get(toolId);
    /* demo carrier stays at the load port */
  }

  _reparent(parent, toPos, toScale, done) {
    parent.attach(this.workpiece.group);
    const fromScale = this.workpiece.group.scale.x || 1;
    const fromPos = this.workpiece.group.position.clone();
    if (fromPos.distanceTo(toPos) < 0.03 && Math.abs(fromScale - toScale) < 0.04) {
      this.workpiece.group.position.copy(toPos);
      this.workpiece.group.scale.setScalar(toScale);
      this.workpiece.compact = toScale < 0.7;
      done?.();
      return;
    }
    this.handoff = { fromPos, toPos, fromScale, toScale, acc: 0, dur: 0.55, done };
  }

  _stow(done) {
    this.carrierAnchor.position.copy(STOW_ANCHOR[this.carrierType] || STOW_ANCHOR.FOUP);
    this._reparent(this.carrierAnchor, new THREE.Vector3(0, 0, 0), 0.34, done);
  }

  dockTo(toolId, done) {
    const chuck = this.tools.get(toolId)?.chuck;
    if (!chuck) { done?.(); return; }
    this._reparent(chuck, new THREE.Vector3(0, 0, 0), 1, done);
  }

  _leaveLive() {
    this.mode = "idle";
    this.live = null;
    this.frozen = false;
    this.solo = null;
  }

  moveTo(toolId, carrierType) {
    return new Promise((resolve) => {
      this._leaveLive();
      if (carrierType) this.setCarrier(carrierType);
      const fromId = this.currentToolId || toolId;
      if (fromId === toolId) {
        this._placeCarrier(toolId);
        this.dockTo(toolId, resolve);
        return;
      }
      const startPath = () => {
        const a = this.loadportWorld(fromId, new THREE.Vector3());
        const b = this.loadportWorld(toolId, new THREE.Vector3());
        const from = this.tools.get(fromId);
        const to = this.tools.get(toolId);
        if (this.carrier.parent !== this.scene) this.scene.attach(this.carrier);
        const waypoints = [
          a.clone(),
          a.clone().setY(4.55),
          new THREE.Vector3(from.group.position.x, 4.9, 0),
          new THREE.Vector3(to.group.position.x, 4.9, 0),
          b.clone().setY(4.55),
          b.clone(),
        ];
        const segs = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
          const d = waypoints[i].distanceTo(waypoints[i + 1]);
          segs.push({ a: waypoints[i], b: waypoints[i + 1], dur: Math.max(0.18, d * 0.07) });
        }
        this.pickup = null;
        this.transport = { segs, acc: 0, resolve, toolId };
        /* crane path is driven by the facility snapshot */
      };
      this._stow(startPath);
    });
  }

  setFollow(on) {
    if (on === "crane" || on === "lot") this.follow = on;
    else this.follow = on ? "lot" : false;
    this.controls.enabled = !this.follow;
  }

  focusOverview() {
    this.follow = false;
    this.controls.enabled = true;
    this._camTween = {
      fromP: this.camera.position.clone(),
      fromT: this.controls.target.clone(),
      toP: new THREE.Vector3(4, 36, 42),
      toT: new THREE.Vector3(-32, 2, 0),
      acc: 0,
      dur: 1.0,
    };
  }

  focusWork(toolId) {
    const rec = this.tools.get(toolId);
    if (!rec) return;
    this.follow = false;
    this.controls.enabled = true;
    rec.group.updateWorldMatrix(true, true);
    const chuckWorld = new THREE.Vector3();
    rec.chuck.getWorldPosition(chuckWorld);
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(rec.group.quaternion);
    const side = new THREE.Vector3(front.z, 0, -front.x);
    const toP = chuckWorld.clone().add(front.multiplyScalar(6.6)).add(side.multiplyScalar(2.8)).add(new THREE.Vector3(0, 3.05, 0));
    const toT = chuckWorld.clone().add(new THREE.Vector3(0, 0.35, 0));
    this._camTween = {
      fromP: this.camera.position.clone(),
      fromT: this.controls.target.clone(),
      toP,
      toT,
      acc: 0,
      dur: Math.max(0.28, 0.85 / Math.max(1, this.speed || 1)),
    };
  }

  focusTool(toolId) {
    this.focusWork(toolId);
  }

  setToolStatus(toolId, status) {
    const rec = this.tools.get(toolId);
    if (!rec) return;
    rec.status = status;
    const dim = 0.05;
    rec.lights.red.emissiveIntensity = status === "HOLD" ? 1.35 : dim;
    rec.lights.yel.emissiveIntensity = status === "QUEUE" ? 0.95 : dim;
    rec.lights.grn.emissiveIntensity = status === "RUN" ? 1.15 : status === "DONE" ? 0.45 : dim;
    const col = status === "HOLD" ? 0xff6b7a : status === "QUEUE" ? 0xf0c14b : 0x3ee0c0;
    rec.point.color.setHex(col);
    rec.point.intensity = status === "idle" ? 0.2 : status === "HOLD" ? 2.6 : 1.5;
  }

  clearStatuses() {
    for (const rec of this.tools.values()) this.setToolStatus(rec.id, "idle");
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = [...this.tools.values()].map((r) => r.hit);
    const found = this.raycaster.intersectObjects(hits, false)[0];
    return found?.object.userData.toolId || null;
  }

  hover(clientX, clientY) {
    const id = this.pick(clientX, clientY);
    this.canvas.style.cursor = id ? "pointer" : "grab";
    return id;
  }

  _stepHandoff(dt) {
    if (!this.handoff) return;
    const h = this.handoff;
    h.acc += dt;
    const k = smooth(Math.min(1, h.acc / h.dur));
    this.workpiece.group.position.lerpVectors(h.fromPos, h.toPos, k);
    const s = h.fromScale + (h.toScale - h.fromScale) * k;
    this.workpiece.group.scale.setScalar(s);
    this.workpiece.compact = s < 0.7;
    if (k >= 1) {
      const done = h.done;
      this.handoff = null;
      done?.();
    }
  }

  _stepTransport(dt) {
    const tr = this.transport;
    if (!tr) return;
    tr.acc += dt;
    let time = tr.acc;
    let pos = tr.segs[0].a;
    let done = true;
    for (const seg of tr.segs) {
      if (time <= seg.dur) {
        const k = smooth(time / seg.dur);
        pos = new THREE.Vector3().lerpVectors(seg.a, seg.b, k);
        done = false;
        break;
      }
      time -= seg.dur;
      pos = seg.b;
    }
    const lifted = tr.acc > tr.segs[0].dur * 0.85;
    if (lifted && this.carrier.parent !== this.scene) {
      this.scene.attach(this.carrier);
      this.pickup = {
        from: this.carrier.position.clone(),
        to: new THREE.Vector3(0, -1.15, 0),
        acc: 0,
        dur: 0.4,
      };
    }
    this.carrier.position.set(pos.x, Math.max(pos.y, 1.2), pos.z);
    if (!lifted) this.carrier.position.copy(tr.segs[0].a);
    else if (this.pickup) {
      this.pickup.acc += dt;
      const k = smooth(Math.min(1, this.pickup.acc / this.pickup.dur));
      this.carrier.position.lerpVectors(this.pickup.from, this.pickup.to, k);
      if (k >= 1) this.pickup = null;
    }
    if (done) {
      if (this.carrier.parent !== this.scene) this.scene.attach(this.carrier);
      this.carrier.position.copy(this.loadportWorld(tr.toolId));
      this.currentToolId = tr.toolId;
      const rec = this.tools.get(tr.toolId);
      /* dropped at the load port */
      const resolve = tr.resolve;
      this.transport = null;
      this.dockTo(tr.toolId, resolve);
    }
  }

  _syncFacility(dt) {
    const facility = this.session?.facility;
    if (!facility || !this.view) return;
    this.facilityBound = true;
    const snap = facility.snapshot();
    this._snap = snap;
    const soloTool = this.solo ? stationById(this.solo.stationId)?.tool : null;
    if (this.mode !== "solo" && this.mode !== "soloHold") this.carrier.visible = false;
    this.view.sync(snap, this.tools, dt, soloTool);
    if (this.mode === "solo" || this.mode === "soloHold") return;
    const lot = snap.lotCarrierId ? snap.carriers.find((c) => c.id === snap.lotCarrierId) : null;
    const atTool = !!(lot && String(lot.location).startsWith("tool:"));
    const processing = (this.mode === "live" || this.mode === "hold") && this.live && this.live.t < 0.999;
    if (this.handoff || processing || (atTool && (this.mode === "live" || this.mode === "hold"))) return;
    if (!lot) {
      const tool = this.tools.get(STATIONS[0].tool);
      if (tool && this.workpiece.group.parent !== tool.chuck) {
        tool.chuck.attach(this.workpiece.group);
        this.workpiece.group.position.set(0, 0, 0);
        this.workpiece.group.scale.setScalar(1);
        this.workpiece.compact = false;
      }
      if (this.holdId === "kgd") this._apply("diebank", 0.42, 1);
      return;
    }
    if (atTool) {
      const rec = this.tools.get(lot.location.slice(5));
      if (rec && this.workpiece.group.parent !== rec.chuck) {
        rec.chuck.attach(this.workpiece.group);
        this.workpiece.group.position.set(0, 0, 0);
        this.workpiece.group.scale.setScalar(1);
        this.workpiece.compact = false;
      }
      if (this.mode !== "live" && this.mode !== "hold") {
        const spec = specForMorph(this.lotMorph || "bank");
        this._apply(spec.station, spec.t, 0);
      }
      return;
    }
    const shell = this.view.carriers.get(lot.id)?.group;
    if (!shell) return;
    if (this.workpiece.group.parent !== shell) shell.attach(this.workpiece.group);
    this.workpiece.group.position.set(0, 0.42, 0.15);
    this.workpiece.group.scale.setScalar(0.38);
    this.workpiece.compact = true;
    if (this.mode === "live" && this.live && this.live.t >= 0.999) {
      this.mode = "idle";
      this.live = null;
      this.frozen = false;
    }
    if (this.mode !== "live" && this.mode !== "hold") {
      const spec = specForMorph(this.lotMorph || "bank");
      this._apply(spec.station, spec.t, 0);
    }
  }

  update(dt, speed = 1) {
    this.speed = speed || 1;
    this.t += dt;
    const scaled = dt * speed;

    if (this._camTween) {
      const tw = this._camTween;
      tw.acc += dt;
      const k = smooth(Math.min(1, tw.acc / tw.dur));
      this.camera.position.lerpVectors(tw.fromP, tw.toP, k);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, k);
      this.camera.lookAt(this.controls.target);
      if (k >= 1) this._camTween = null;
    } else if (this.follow === "lot" || this.follow === true) {
      const target = this.workpiece.group.getWorldPosition(new THREE.Vector3());
      const desired = target.clone().add(new THREE.Vector3(6, 5.5, 7));
      this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      this.controls.target.lerp(target, 1 - Math.pow(0.001, dt));
      this.camera.lookAt(this.controls.target);
    } else if (this.follow === "crane" && this._snap?.vehicles?.length) {
      const active = this._snap.vehicles.find((v) => v.state !== "idle" && v.state !== "paused") || this._snap.vehicles[0];
      const target = new THREE.Vector3(active.x, 2.4, active.z);
      const desired = target.clone().add(new THREE.Vector3(8, 7, 9));
      this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      this.controls.target.lerp(target, 1 - Math.pow(0.001, dt));
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update();
    }

    this._stepHandoff(scaled);
    this._stepTransport(scaled);
    this._syncFacility(dt);

    const playing = (this.mode === "live" && !this.frozen) || (this.mode === "solo" && this.solo && !this.solo.wait);
    if (playing) this.spin += scaled * 14;

    if (this.mode === "solo") {
      if (!this.solo.wait) this.solo.acc += scaled;
      const u = this.solo.wait ? 0 : Math.min(1, this.solo.acc / this.solo.dur);
      this._apply(this.solo.stationId, u, 0);
      if (!this.solo.wait && u >= 1) this.mode = "soloHold";
    } else if (this.mode === "soloHold" && this.solo) {
      this._apply(this.solo.stationId, 1, 0);
    } else if ((this.mode === "live" || this.mode === "hold") && this.live) {
      this._apply(this.live.stationId, this.live.t, this.live.fault);
    }

    for (const rec of this.tools.values()) {
      if (rec.status === "HOLD") {
        rec.lights.red.emissiveIntensity = 0.55 + Math.sin(this.t * 6) * 0.7;
        rec.point.intensity = 1.5 + Math.sin(this.t * 6) * 1.1;
      } else if (rec.status === "RUN") {
        rec.lights.grn.emissiveIntensity = 0.7 + Math.sin(this.t * 3) * 0.35;
      }
      const camY = this.camera.position.y;
      const labelOpacity = camY > 22 ? Math.max(0, 1 - (camY - 22) / 10) : 1;
      rec.label.material.opacity = labelOpacity;
      rec.label.visible = labelOpacity > 0.08;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}
