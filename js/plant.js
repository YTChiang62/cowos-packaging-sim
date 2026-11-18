import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { FacilityView } from "./facility-view.js";
import { HOLD_AT, RAIL_NODES, RAIL_Y, STATIONS, stationById } from "./route.js";
import { motion, smooth, specForMorph } from "./morph.js";
import { Workpiece } from "./product.js";
import { seedCarriers } from "./warehouse.js";
import { STOW_ANCHOR, buildTool, carrierShell, poseTool } from "./tools.js";
import { buildAvatar, poseAvatar, setAvatarRole } from "./avatar.js";
import { FACILITY_ROOMS, OVERVIEW_CAMERA, PLANT_FLOOR, PLANT_WALLS, RETURN_AIR, WalkController } from "./walk.js";
import { applyTheme, paintFloor, readThemeId } from "./themes.js";
import { buildFacilityShell, makeBillboard, makeFlatTag } from "./shell.js";
import { OpsView } from "./ops-view.js";

const BAYS = [
  { id: "incoming", x: -36.75, z: -18, w: 16, d: 12 },
  { id: "cow", x: -12, z: -18, w: 32, d: 12 },
  { id: "dice", x: -34, z: 18, w: 18, d: 12 },
  { id: "wos", x: -8, z: 18, w: 32, d: 12 },
  { id: "pack", x: 24.5, z: 18, w: 32, d: 12 },
];

const BAY_ACCENT = {
  incoming: 0xd3925a,
  cow: 0x3ee0c0,
  dice: 0x8aa0ff,
  wos: 0xe0a15a,
  pack: 0xe7a098,
};

const LABEL_FONT = "700 42px 'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC','Microsoft JhengHei',sans-serif";
const SUB_FONT = "500 26px 'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC','Microsoft JhengHei',sans-serif";

function browserStore() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function makeFloorTexture(palette) {
  const s = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  paintFloor(c.getContext("2d"), s, palette, BAYS, BAY_ACCENT, {
    floor: PLANT_FLOOR,
    walls: PLANT_WALLS,
    loop: RAIL_NODES,
    rooms: FACILITY_ROOMS,
    returns: RETURN_AIR,
  });
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
  sp.userData.plate = {
    fill: "rgba(6,14,18,0.92)",
    title: "#f4faf8",
    sub: "#d5e2e4",
  };
  sp.userData.setPlate = (plate) => {
    if (plate) sp.userData.plate = plate;
    sp.userData.redraw(sp.userData._title, sp.userData._sub, sp.userData._accent);
  };
  sp.userData.redraw = (t, s, a) => {
    sp.userData._title = t;
    sp.userData._sub = s;
    sp.userData._accent = a;
    const plate = sp.userData.plate;
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = plate.fill;
    roundRect(g, 8, 16, 496, 96, 20);
    g.fill();
    g.strokeStyle = a || accent || "rgba(211,146,90,0.85)";
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = plate.title;
    g.font = LABEL_FONT;
    g.fillText(t, 28, 62);
    g.fillStyle = plate.sub;
    g.font = SUB_FONT;
    g.fillText(s, 28, 94);
    tex.needsUpdate = true;
  };
  sp.userData.redraw(title, sub, accent);
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
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x000000, 140, 280);
    const overview = OVERVIEW_CAMERA;
    this.camera = new THREE.PerspectiveCamera(overview.fov, this._aspect(), 0.15, 480);
    this.camera.position.set(overview.position[0], overview.position[1], overview.position[2]);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.42;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 210;
    this.controls.target.set(overview.target[0], overview.target[1], overview.target[2]);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.walking = false;
    this.tags = [];
    this.billboards = [];
    this.tints = [];
    this.walker = new WalkController();
    this.pointerLocked = false;
    this._walkPhase = 0;
    this._lastInspect = null;
    this._keys = new Set();
    this.onInspect = null;
    this.onWalk = null;
    this.opsFocus = null;
    this._opsSnapshot = null;
    this._opsLayers = null;

    this._buildWorld();
    this._buildBays();
    this._buildTools();
    this._buildDemoCarrier();
    const shell = buildFacilityShell(this.scene, (key) => this.tFn(key));
    this.tints = shell.tints;
    this.tags.push(...shell.tags);
    this.billboards.push(...shell.billboards);
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
    this.avatar = buildAvatar("MFG");
    this.scene.add(this.avatar);
    this.inspectRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.74, 28),
      new THREE.MeshBasicMaterial({
        color: 0x3ee0c0,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.inspectRing.rotation.x = -Math.PI / 2;
    this.inspectRing.visible = false;
    this.scene.add(this.inspectRing);
    this._bindWalkInput();
    applyTheme(this, readThemeId(browserStore()));
    this.showLot("bank", STATIONS[0].tool, "FOUP");
    this.resize();
  }

  repaintFloor(palette) {
    if (!this.floor) return;
    const tex = makeFloorTexture(palette);
    const material = this.floor.material;
    if (material.map) material.map.dispose();
    material.map = tex;
    material.roughness = palette.floor.roughness;
    material.metalness = palette.floor.metalness;
    material.needsUpdate = true;
  }

  setAvatarRole(role) {
    setAvatarRole(this.avatar, role);
  }

  enterWalk() {
    if (this.walking) return;
    this._camTween = null;
    const pose = this.walker.enter();
    this.walking = true;
    this.follow = false;
    this.controls.enabled = false;
    this.avatar.visible = true;
    this.avatar.position.set(pose.x, 0, pose.z);
    this.avatar.rotation.y = pose.yaw;
    this._lastInspect = null;
    this.canvas.style.cursor = "crosshair";
    this.onWalk?.(true);
  }

  exitWalk({ overview = true } = {}) {
    if (!this.walking && !this.walker.active) return;
    const cam = this.walker.exit();
    this.walking = false;
    this.follow = cam.follow;
    this.avatar.visible = false;
    this.inspectRing.visible = false;
    this._lastInspect = null;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.pointerLocked = false;
    this.canvas.style.cursor = "";
    this.onWalk?.(false);
    if (overview) this.focusOverview();
    else this.controls.enabled = cam.controls && !this.follow;
  }

  requestLook() {
    if (!this.walking || document.pointerLockElement === this.canvas) return;
    this.canvas.requestPointerLock?.();
  }

  _bindWalkInput() {
    const typing = (e) => e.target?.matches?.("input, textarea, select");
    const moveKey = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    this._onKeyDown = (e) => {
      if (typing(e)) return;
      this._keys.add(e.code);
      if (this.walking && moveKey.has(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this._keys.delete(e.code);
    this._onMouse = (e) => {
      if (!this.walking || document.pointerLockElement !== this.canvas) return;
      this.walker.yaw -= e.movementX * 0.0022;
      this.walker.pitch = Math.max(-0.42, Math.min(0.28, this.walker.pitch - e.movementY * 0.0016));
    };
    this._onLock = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.walking) this.canvas.style.cursor = this.pointerLocked ? "none" : "crosshair";
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("mousemove", this._onMouse);
    window.addEventListener("blur", () => this._keys.clear());
    document.addEventListener("pointerlockchange", this._onLock);
  }

  _driveWalk(dt) {
    let forward = 0;
    let strafe = 0;
    if (this._keys.has("KeyW") || this._keys.has("ArrowUp")) forward += 1;
    if (this._keys.has("KeyS") || this._keys.has("ArrowDown")) forward -= 1;
    if (this._keys.has("KeyD") || this._keys.has("ArrowRight")) strafe += 1;
    if (this._keys.has("KeyA") || this._keys.has("ArrowLeft")) strafe -= 1;
    const sprint = this._keys.has("ShiftLeft") || this._keys.has("ShiftRight");
    const moving = forward !== 0 || strafe !== 0;
    this.walker.step({ forward, strafe, sprint, yaw: this.walker.yaw, dt });
    this.avatar.position.set(this.walker.x, 0, this.walker.z);
    this.avatar.rotation.y = this.walker.yaw;
    this._walkPhase += dt * (moving ? (sprint ? 11 : 7.5) : 1.6);
    poseAvatar(this.avatar, this._walkPhase, moving);
    const id = this.walker.updateInspect();
    this._highlightInspect(id);
    if (id !== this._lastInspect) {
      this._lastInspect = id;
      this.onInspect?.(id);
    }
    const yaw = this.walker.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let back = 3.35;
    let cx = this.walker.x - fx * back;
    let cz = this.walker.z - fz * back;
    if (this.walker.blocked(cx, cz)) {
      back = 1.9;
      cx = this.walker.x - fx * back;
      cz = this.walker.z - fz * back;
    }
    const lookY = 1.05 + Math.sin(this.walker.pitch) * 0.85;
    this.camera.position.set(cx, 2.15, cz);
    this.controls.target.set(this.walker.x + fx * 2.5, lookY, this.walker.z + fz * 2.5);
    this.camera.lookAt(this.controls.target);
  }

  _highlightInspect(id) {
    if (!id) {
      this.inspectRing.visible = false;
      return;
    }
    const solid = this.walker.solids.find((entry) => entry.id === id);
    if (!solid) {
      this.inspectRing.visible = false;
      return;
    }
    this.inspectRing.visible = true;
    this.inspectRing.position.set(solid.ax, 0.07, solid.az);
    this.inspectRing.material.opacity = 0.32 + Math.sin(this.t * 4) * 0.12;
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
    this.refreshPlaceTags();
  }

  refreshPlaceTags() {
    const ink = this.palette?.floor?.parkInk || "#14201c";
    const halo = this.palette?.floor?.parkHalo || "rgba(255,255,255,0.94)";
    for (const tag of this.tags || []) {
      tag.userData.redraw?.(this.tFn(tag.userData.labelKey), ink, halo);
    }
    for (const sign of this.billboards || []) {
      sign.userData.redraw?.(this.tFn(sign.userData.labelKey));
    }
    if (this._opsSnapshot && this.opsView) {
      this.opsView.sync(this._opsSnapshot, this._opsLayers, this.tFn);
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
    this._shown = { morph: "packed", toolId: stationById("pack").tool, carrier: "TRAY" };
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
    const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(24, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -110;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 72;
    sun.shadow.camera.bottom = -72;
    sun.shadow.bias = -0.0007;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-30, 22, -12);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(-40, 18, 30);
    this.scene.add(rim);
    const stocker = new THREE.PointLight(0xffffff, 1, 18);
    stocker.position.set(-46.2, 3.2, 6.2);
    this.scene.add(stocker);
    this.lights = { hemi, sun, fill, rim, stocker };

    const fw = PLANT_FLOOR.maxX - PLANT_FLOOR.minX;
    const fd = PLANT_FLOOR.maxZ - PLANT_FLOOR.minZ;
    const fcx = (PLANT_FLOOR.minX + PLANT_FLOOR.maxX) / 2;
    const fcz = (PLANT_FLOOR.minZ + PLANT_FLOOR.maxZ) / 2;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(fw, fd),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.03 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(fcx, 0, fcz);
    floor.receiveShadow = true;
    this.floor = floor;
    this.scene.add(floor);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(fw + 1.6, 0.6, fd + 1.6), stdMat(0xffffff, { roughness: 0.9, metalness: 0.05 }));
    skirt.position.set(fcx, -0.36, fcz);
    this.skirt = skirt;
    this.scene.add(skirt);

    const { north, south, west, east } = PLANT_WALLS;
    const spanX = east - west;
    const spanZ = south - north;
    const midX = (east + west) / 2;
    const midZ = (south + north) / 2;
    const wallH = 6.6;
    const wallMat = stdMat(0xffffff, { transparent: true, opacity: 0.1, roughness: 0.12, metalness: 0.12 });
    this.wallMat = wallMat;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(spanX, wallH, 0.14), wallMat);
    wall.position.set(midX, wallH / 2, north);
    this.scene.add(wall);
    const wall2 = wall.clone();
    wall2.position.set(midX, wallH / 2, south);
    this.scene.add(wall2);
    const wall3 = new THREE.Mesh(new THREE.BoxGeometry(0.14, wallH, spanZ), wallMat);
    wall3.position.set(west, wallH / 2, midZ);
    this.scene.add(wall3);
    const wall4 = wall3.clone();
    wall4.position.set(east, wallH / 2, midZ);
    this.scene.add(wall4);
  }

  _buildBays() {
    const glass = stdMat(0xffffff, { transparent: true, opacity: 0.1, roughness: 0.08, metalness: 0.15 });
    const frame = stdMat(0xffffff, { roughness: 0.35, metalness: 0.7 });
    this.bayGlass = glass;
    this.bayFrame = frame;
    this.bayPlinths = [];
    for (const bay of BAYS) {
      const group = new THREE.Group();
      group.position.set(bay.x, 0, bay.z);
      const hw = bay.w / 2;
      const hd = bay.d / 2;
      const h = 4.7;
      for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), frame);
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
            const pane = new THREE.Mesh(new THREE.BoxGeometry(side, 3.15, 0.06), glass);
            pane.position.set(sign * (doorW / 2 + side / 2), 1.75, pz);
            group.add(pane);
          }
        } else {
          const pane = new THREE.Mesh(new THREE.BoxGeometry(sx, 3.15, sz), glass);
          pane.position.set(px, 1.75, pz);
          group.add(pane);
        }
      }
      const plinthMat = stdMat(0xffffff, { roughness: 0.7, metalness: 0.15 });
      this.bayPlinths.push({ id: bay.id, material: plinthMat });
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(bay.w - 0.6, 0.06, bay.d - 0.6),
        plinthMat
      );
      plinth.position.y = 0.03;
      plinth.receiveShadow = true;
      group.add(plinth);
      const twoLine = bay.id === "incoming";
      const span = twoLine ? Math.min(bay.w * 0.72, 7.6) : Math.min(bay.w * 0.62, 12.8);
      const depth = twoLine ? span / 2.35 : span / 4;
      const half = depth / 2;
      const edge = bay.z < 0 ? -20.55 : 20.55;
      const localZ = bay.z < 0 ? edge - bay.z - half : edge - bay.z + half;
      const tag = makeFlatTag(bay.id);
      tag.userData.labelKey = `bay_${bay.id}`;
      tag.position.set(0, 0.14, localZ);
      tag.scale.set(span, depth, 1);
      group.add(tag);
      this.tags.push(tag);
      const lab = makeBillboard(bay.id);
      lab.name = `bay-label-${bay.id}`;
      lab.userData.labelKey = `bay_${bay.id}`;
      lab.scale.set(8.6, 1.8, 1);
      lab.position.set(0, 3.15, bay.z < 0 ? hd - 1.35 : -hd + 1.35);
      group.add(lab);
      this.billboards.push(lab);
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
      label.scale.set(2.7, 0.68, 1);
      label.position.set(0, 2.35, 0);
      built.group.add(label);
      const workLight = new THREE.PointLight(0xfff4e4, 1.8, 7);
      workLight.position.set(0, 1.45, 0.2);
      built.chuck.add(workLight);
      this.scene.add(built.group);
      this.tools.set(station.tool, {
        ...built,
        station,
        id: station.tool,
        bay: station.place.bay,
        face: station.place.face,
        label,
        workLight,
        status: "idle",
      });
      poseTool(this.tools.get(station.tool), motion(station.id, 0, 0), 0);
    }
    this.opsView = new OpsView(this.scene);
    this._publishOpsAnchors();
  }

  _publishOpsAnchors() {
    const tools = [];
    for (const rec of this.tools.values()) {
      tools.push({
        id: rec.id,
        x: rec.group.position.x,
        z: rec.group.position.z,
        face: rec.face,
      });
    }
    this.opsView.setAnchors(tools);
  }

  setOps(snapshot, layers) {
    this._opsSnapshot = snapshot || null;
    this._opsLayers = layers || null;
    if (!this.opsView) return;
    this.opsView.sync(this._opsSnapshot, this._opsLayers, this.tFn);
  }

  setOpsFocus(toolId) {
    this.opsFocus = toolId || null;
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
    if (this.walking && on) this.exitWalk({ overview: false });
    if (on === "crane" || on === "lot") this.follow = on;
    else this.follow = on ? "lot" : false;
    this.controls.enabled = !this.follow && !this.walking;
  }

  focusOverview() {
    this.follow = false;
    this.controls.enabled = true;
    this._camTween = {
      fromP: this.camera.position.clone(),
      fromT: this.controls.target.clone(),
      toP: new THREE.Vector3(OVERVIEW_CAMERA.position[0], OVERVIEW_CAMERA.position[1], OVERVIEW_CAMERA.position[2]),
      toT: new THREE.Vector3(OVERVIEW_CAMERA.target[0], OVERVIEW_CAMERA.target[1], OVERVIEW_CAMERA.target[2]),
      acc: 0,
      dur: 1.0,
    };
  }

  focusWork(toolId) {
    const rec = this.tools.get(toolId);
    if (!rec || this.walking) return;
    this.follow = false;
    this.controls.enabled = true;
    rec.group.updateWorldMatrix(true, true);
    const chuckWorld = new THREE.Vector3();
    rec.chuck.getWorldPosition(chuckWorld);
    const front = new THREE.Vector3(0, 0, 1).applyQuaternion(rec.group.quaternion);
    const side = new THREE.Vector3(front.z, 0, -front.x);
    const toP = chuckWorld.clone().add(front.multiplyScalar(5.2)).add(side.multiplyScalar(2.1)).add(new THREE.Vector3(0, 2.4, 0));
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
    if (this.walking) {
      this.canvas.style.cursor = this.pointerLocked ? "none" : "crosshair";
      return null;
    }
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

    if (this.walking) {
      this._driveWalk(dt);
    } else if (this._camTween) {
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
      if (this.walking && rec.id === this.walker.inspectId) {
        rec.point.intensity = Math.max(rec.point.intensity, 2.1);
      }
      const camY = this.camera.position.y;
      const labelOpacity = camY > 22 ? Math.max(0, 1 - (camY - 22) / 10) : 1;
      rec.label.material.opacity = labelOpacity;
      rec.label.visible = labelOpacity > 0.08;
    }
    const camY = this.camera.position.y;
    const signOpacity = camY > 28 ? Math.max(0, 1 - (camY - 28) / 16) : 1;
    for (const sign of this.billboards || []) {
      sign.material.opacity = signOpacity;
      sign.visible = signOpacity > 0.05;
    }

    this.opsView?.pose({
      walking: this.walking,
      camY: this.camera.position.y,
      nearbyTool: this.walking ? this.walker.inspectId : this.opsFocus,
    });

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
