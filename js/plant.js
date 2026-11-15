import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";

export const TOOL_LAYOUT = {
  "INB-01": { x: -38, z: -18, bay: "incoming", kind: "dock", face: 1 },
  "DBK-02": { x: -29, z: -18, bay: "incoming", kind: "bank", face: 1 },
  "PLM-11": { x: -13, z: -20, bay: "cow", kind: "plasma", face: 1 },
  "HB-21": { x: -5, z: -20, bay: "cow", kind: "bonder", face: 1 },
  "AXI-31": { x: 3, z: -20, bay: "cow", kind: "inspect", face: 1 },
  "CUF-41": { x: -9, z: -12, bay: "cow", kind: "dispense", face: 1 },
  "MOL-51": { x: 1, z: -12, bay: "cow", kind: "mold", face: 1 },
  "GRD-61": { x: 20, z: -18, bay: "grind", kind: "grind", face: 1 },
  "CWT-71": { x: 28, z: -18, bay: "grind", kind: "tester", face: 1 },
  "DIC-81": { x: -34, z: 18, bay: "dice", kind: "dicer", face: -1 },
  "FC-91": { x: -14, z: 18, bay: "wos", kind: "flipchip", face: -1 },
  "UF-92": { x: -7, z: 18, bay: "wos", kind: "dispense", face: -1 },
  "LID-93": { x: 0, z: 18, bay: "wos", kind: "lid", face: -1 },
  "BGA-94": { x: 7, z: 18, bay: "wos", kind: "ball", face: -1 },
  "SAM-95": { x: 13, z: 18, bay: "wos", kind: "inspect", face: -1 },
  "FTS-A1": { x: 21, z: 18, bay: "test", kind: "tester", face: -1 },
  "MRK-A2": { x: 26, z: 18, bay: "test", kind: "mark", face: -1 },
  "PAK-A3": { x: 34, z: 18, bay: "pack", kind: "pack", face: -1 },
};

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

function makeFloorTexture() {
  const s = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#1c2e34";
  g.fillRect(0, 0, s, s);

  // faint interposer micro-bump grid
  g.fillStyle = "rgba(211,146,90,0.16)";
  for (let y = 40; y < s; y += 18) {
    for (let x = 40; x < s; x += 18) {
      g.beginPath();
      g.arc(x + ((y / 18) % 2) * 4, y, 1.3, 0, Math.PI * 2);
      g.fill();
    }
  }

  // copper trace ribbons
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

  // aisle
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

function labelSprite(title, sub, accent) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 128;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = "rgba(8,18,22,0.82)";
  roundRect(g, 8, 16, 496, 96, 20);
  g.fill();
  g.strokeStyle = accent || "rgba(211,146,90,0.7)";
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = "#e8f3f0";
  g.font = "700 42px 'Sora','Noto Sans CJK TC','Noto Sans TC',sans-serif";
  g.fillText(title, 28, 62);
  g.fillStyle = "#8aa3a8";
  g.font = "500 26px 'Sora','Noto Sans CJK TC','Noto Sans TC',sans-serif";
  g.fillText(sub, 28, 94);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, sizeAttenuation: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(4.2, 1.05, 1);
  sp.center.set(0.5, 0);
  sp.position.y = 3.35;
  sp.userData.redraw = (t, s, a) => {
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = "rgba(8,18,22,0.82)";
    roundRect(g, 8, 16, 496, 96, 20);
    g.fill();
    g.strokeStyle = a || accent || "rgba(211,146,90,0.7)";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#e8f3f0";
    g.font = "700 42px 'Sora','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    g.fillText(t, 28, 62);
    g.fillStyle = "#8aa3a8";
    g.font = "500 26px 'Sora','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    g.fillText(s, 28, 94);
    tex.needsUpdate = true;
  };
  return sp;
}

function bayLabel(text, accent) {
  const cv = document.createElement("canvas");
  cv.width = 768;
  cv.height = 128;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, 768, 128);
  g.fillStyle = accent;
  g.globalAlpha = 0.9;
  g.font = "700 64px 'Sora','Noto Sans CJK TC','Noto Sans TC',sans-serif";
  g.textAlign = "center";
  g.fillText(text, 384, 84);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(8, 1.35, 1);
  sp.position.y = 0.12;
  sp.userData.redraw = (t) => {
    g.clearRect(0, 0, 768, 128);
    g.fillStyle = accent;
    g.globalAlpha = 0.9;
    g.font = "700 64px 'Sora','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    g.textAlign = "center";
    g.fillText(t, 384, 84);
    tex.needsUpdate = true;
  };
  return sp;
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

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.45,
    metalness: opts.metalness ?? 0.35,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

export class Plant {
  constructor(canvas) {
    this.canvas = canvas;
    this.t = 0;
    this.follow = false;
    this.tFn = (k) => k;
    this.lang = "zh-TW";
    this.tools = new Map();
    this.currentToolId = "INB-01";
    this.carrierType = "FOUP";
    this.transport = null;
    this.hovered = null;
    this.selected = null;
    this.onToolClick = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x071016, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x071016, 70, 160);

    this.camera = new THREE.PerspectiveCamera(42, this._aspect(), 0.1, 220);
    this.camera.position.set(2, 31, 33);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.40;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 80;
    this.controls.target.set(-16, 0.2, 0);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this._mats = {
      body: mat(0x1b262b, { roughness: 0.38, metalness: 0.55 }),
      bodyDark: mat(0x12181c, { roughness: 0.4, metalness: 0.6 }),
      frame: mat(0xb8874e, { roughness: 0.35, metalness: 0.7 }),
      glass: mat(0x7fdad0, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22 }),
      floor: new THREE.MeshStandardMaterial({
        map: makeFloorTexture(),
        roughness: 0.82,
        metalness: 0.18,
      }),
      concrete: mat(0x141c20, { roughness: 0.9, metalness: 0.05 }),
      foup: mat(0x1c4a46, { roughness: 0.35, metalness: 0.25 }),
      wafer: mat(0xc9d4d8, { roughness: 0.15, metalness: 0.85 }),
      tray: mat(0x1a1f24, { roughness: 0.5, metalness: 0.2 }),
      chip: mat(0xdceceb, { roughness: 0.4, metalness: 0.3 }),
      hbm: mat(0x3ee0c0, { roughness: 0.4, metalness: 0.35, emissive: 0x0a3a32, emissiveIntensity: 0.3 }),
      sub: mat(0xd3925a, { roughness: 0.45, metalness: 0.4 }),
    };

    this._buildWorld();
    this._buildBays();
    this._buildRails();
    this._buildTools();
    this._buildShuttle();
    this._placeCarrier("INB-01", "FOUP", false);
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
  }

  relabel() {
    for (const [id, rec] of this.tools) {
      rec.label.userData.redraw(id, this.tFn(`step_${rec.stepId}`) || rec.stepId, "#" + BAY_ACCENT[rec.bay].toString(16).padStart(6, "0"));
    }
    for (const bay of BAYS) {
      const sp = this.scene.getObjectByName(`bay-label-${bay.id}`);
      if (sp?.userData.redraw) sp.userData.redraw(this.tFn(`bay_${bay.id}`));
    }
  }

  _buildWorld() {
    const hemi = new THREE.HemisphereLight(0xc9e4ea, 0x1a120c, 1.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xf2e6d0, 1.45);
    sun.position.set(24, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.0007;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x4aa89c, 0.28);
    fill.position.set(-20, 18, -10);
    this.scene.add(fill);
    const aisle = new THREE.DirectionalLight(0x9fd4d0, 0.35);
    aisle.position.set(0, 20, 4);
    this.scene.add(aisle);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 80), this._mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = "floor";
    this.scene.add(floor);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(102, 0.6, 82), this._mats.concrete);
    skirt.position.y = -0.36;
    this.scene.add(skirt);

    // perimeter glass
    const wallMat = mat(0x6ec8c0, { transparent: true, opacity: 0.07, roughness: 0.1, metalness: 0.2 });
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

    // ceiling grid + LED strips (sparse)
    const beamMat = mat(0x1c2a30, { metalness: 0.6, roughness: 0.4 });
    const ledMat = mat(0xdff6f2, { emissive: 0xb8e8e0, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0 });
    for (let x = -42; x <= 42; x += 8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 72), beamMat);
      beam.position.set(x, 7.1, 0);
      this.scene.add(beam);
    }
    const ledMatSoft = mat(0xdff6f2, { emissive: 0x8ec8c0, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0 });
    for (const bay of BAYS) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(bay.w - 2, 0.05, 0.16), ledMatSoft);
      led.position.set(bay.x, 6.9, bay.z - bay.d * 0.25);
      this.scene.add(led);
      const led2 = led.clone();
      led2.position.z = bay.z + bay.d * 0.25;
      this.scene.add(led2);
    }
  }

  _buildBays() {
    const glass = mat(0x7fdad0, { transparent: true, opacity: 0.09, roughness: 0.08, metalness: 0.15 });
    for (const bay of BAYS) {
      const group = new THREE.Group();
      group.position.set(bay.x, 0, bay.z);
      const hw = bay.w / 2;
      const hd = bay.d / 2;
      const h = 3.8;
      const frame = this._mats.frame;
      const posts = [
        [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd],
      ];
      for (const [px, pz] of posts) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), frame);
        p.position.set(px, h / 2, pz);
        p.castShadow = true;
        group.add(p);
      }
      const panes = [
        [0, -hd, bay.w, 0.06],
        [0, hd, bay.w, 0.06],
        [-hw, 0, 0.06, bay.d],
        [hw, 0, 0.06, bay.d],
      ];
      for (const [px, pz, sx, sz] of panes) {
        // leave a doorway toward the aisle
        const towardAisle = (bay.z < 0 && pz > 0) || (bay.z > 0 && pz < 0);
        if (towardAisle && sx > 1) {
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
        mat(bay.color, { roughness: 0.7, metalness: 0.15 })
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

  _buildRails() {
    const railMat = mat(0x5a4630, { metalness: 0.7, roughness: 0.4 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(86, 0.08, 0.22), railMat);
    rail.position.set(-2, 4.85, 0);
    this.scene.add(rail);
    const rail2 = rail.clone();
    rail2.position.z = 0.45;
    this.scene.add(rail2);

    for (const [id, rec] of Object.entries(TOOL_LAYOUT)) {
      const spur = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.06, Math.abs(rec.z) + 0.2),
        railMat
      );
      spur.position.set(rec.x, 4.85, rec.z / 2);
      this.scene.add(spur);
    }
  }

  _buildTools() {
    for (const [id, layout] of Object.entries(TOOL_LAYOUT)) {
      const g = this._makeTool(id, layout);
      this.scene.add(g.group);
      this.tools.set(id, { ...layout, ...g, id, stepId: stepIdFromTool(id), status: "idle" });
    }
  }

  _makeTool(id, layout) {
    const group = new THREE.Group();
    group.position.set(layout.x, 0, layout.z);
    group.userData.toolId = id;
    const accent = BAY_ACCENT[layout.bay];
    const face = layout.face;

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.32, 2.6), this._mats.bodyDark);
    base.position.y = 0.14;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.05, 1.85), this._mats.body);
    body.position.set(0, 1.35, -0.15 * face);
    body.castShadow = true;
    group.add(body);

    const window = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.08), this._mats.glass);
    window.position.set(0, 1.55, 0.78 * face);
    group.add(window);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.07, 1.52), mat(accent, { metalness: 0.5, roughness: 0.35 }));
    stripe.position.set(0, 2.35, -0.15 * face);
    group.add(stripe);

    const light = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.08, 0.16),
      mat(0x3ee0c0, { emissive: 0x3ee0c0, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.1 })
    );
    light.position.set(0, 2.55, 0);
    group.add(light);

    const port = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.7), this._mats.body);
    port.position.set(0, 1.05, 1.4 * face);
    port.castShadow = true;
    group.add(port);

    // kind-specific silhouette
    if (layout.kind === "plasma") {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 24), this._mats.body);
      cyl.position.set(0, 2.3, -0.15 * face);
      cyl.castShadow = true;
      group.add(cyl);
    } else if (layout.kind === "bonder" || layout.kind === "flipchip") {
      const gantry = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.12), this._mats.frame);
      gantry.position.set(0, 2.55, 0.1 * face);
      group.add(gantry);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), this._mats.frame);
      head.position.set(0, 2.3, 0.1 * face);
      group.add(head);
    } else if (layout.kind === "grind") {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 24), this._mats.wafer);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, 2.3, 0);
      group.add(disc);
    } else if (layout.kind === "dicer") {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), this._mats.frame);
      arm.position.set(0, 2.5, 0);
      group.add(arm);
      const saw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.4), mat(0x8899aa, { metalness: 0.8, roughness: 0.2 }));
      saw.position.set(0, 2.25, 0);
      group.add(saw);
    } else if (layout.kind === "bank") {
      for (let i = 0; i < 3; i++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 1.3), this._mats.bodyDark);
        shelf.position.set(0, 0.7 + i * 0.55, -0.1 * face);
        group.add(shelf);
        const bin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.9), mat(0x3a2a18, { roughness: 0.6 }));
        bin.position.set(0, 0.88 + i * 0.55, -0.1 * face);
        group.add(bin);
      }
    } else if (layout.kind === "mold") {
      const press = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 1.1), this._mats.frame);
      press.position.set(0, 2.35, 0);
      group.add(press);
    } else if (layout.kind === "pack") {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), mat(0xc4a06a, { roughness: 0.7, metalness: 0.1 }));
      box.position.set(0.7, 0.55, 1.1 * face);
      box.castShadow = true;
      group.add(box);
    } else if (layout.kind === "inspect") {
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.0), this._mats.glass);
      hood.position.set(0, 2.25, 0);
      group.add(hood);
    }

    const label = labelSprite(id, layout.kind, "#" + accent.toString(16).padStart(6, "0"));
    label.position.set(0, 3.15, 0);
    group.add(label);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 3.6, 3.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1.5;
    hit.userData.toolId = id;
    group.add(hit);

    // loadport world-ish local
    const load = new THREE.Object3D();
    load.position.set(0, 1.18, 1.75 * face);
    group.add(load);

    const point = new THREE.PointLight(accent, 0, 8);
    point.position.set(0, 2.4, 0);
    group.add(point);

    return { group, light, hit, load, point, label, accent };
  }

  _buildShuttle() {
    this.shuttle = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.7), this._mats.frame);
    this.shuttle.add(bar);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), this._mats.frame);
    hook.position.y = -0.4;
    this.shuttle.add(hook);
    const hook2 = hook.clone();
    hook2.position.x = 0.4;
    this.shuttle.add(hook2);
    const hook3 = hook.clone();
    hook3.position.x = -0.4;
    this.shuttle.add(hook3);
    this.shuttle.position.set(-38, 4.9, 0);
    this.scene.add(this.shuttle);

    this.carrier = new THREE.Group();
    this.scene.add(this.carrier);
  }

  _clearCarrier() {
    while (this.carrier.children.length) this.carrier.remove(this.carrier.children[0]);
  }

  _makeCarrierModel(type) {
    const g = new THREE.Group();
    if (type === "FOUP" || type === "BANK") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.7), this._mats.foup);
      body.position.y = 0.39;
      body.castShadow = true;
      g.add(body);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.04), this._mats.glass);
      win.position.set(0, 0.42, 0.36);
      g.add(win);
      const wafer = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), this._mats.wafer);
      wafer.rotation.x = Math.PI / 2;
      wafer.position.set(0, 0.42, 0.18);
      g.add(wafer);
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), this._mats.frame);
      latch.position.set(0, 0.78, 0.28);
      g.add(latch);
    } else if (type === "MAG") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.32), this._mats.bodyDark);
      body.position.y = 0.52;
      body.castShadow = true;
      g.add(body);
      for (let i = 0; i < 6; i++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.28), this._mats.sub);
        slot.position.set(0, 0.18 + i * 0.15, 0);
        g.add(slot);
      }
    } else {
      // TRAY or REEL
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.55), this._mats.tray);
      tray.position.y = 0.08;
      tray.castShadow = true;
      g.add(tray);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const chip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), this._mats.chip);
          chip.position.set(-0.26 + c * 0.26, 0.13, -0.12 + r * 0.24);
          g.add(chip);
          if (type === "REEL" || type === "TRAY") {
            const ball = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.16), this._mats.sub);
            ball.position.set(-0.26 + c * 0.26, 0.1, -0.12 + r * 0.24);
            g.add(ball);
          }
        }
      }
      if (type === "REEL") {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.32), mat(0xc4a06a, { roughness: 0.7 }));
        box.position.set(0.7, 0.18, 0);
        g.add(box);
      }
    }
    return g;
  }

  setCarrierType(type) {
    if (type === this.carrierType && this.carrier.children.length) return;
    this.carrierType = type;
    const pos = this.carrier.position.clone();
    const parent = this.carrier.parent;
    this._clearCarrier();
    this.carrier.add(this._makeCarrierModel(type));
    if (parent === this.scene) this.carrier.position.copy(pos);
  }

  loadportWorld(toolId, target = new THREE.Vector3()) {
    const rec = this.tools.get(toolId);
    rec.load.getWorldPosition(target);
    return target;
  }

  _placeCarrier(toolId, type, docked = true) {
    this.setCarrierType(type || this.carrierType);
    if (this.carrier.parent !== this.scene) this.scene.attach(this.carrier);
    const p = this.loadportWorld(toolId);
    this.carrier.position.copy(p);
    this.carrier.position.y = p.y;
    this.currentToolId = toolId;
    const rec = this.tools.get(toolId);
    if (rec) {
      this.shuttle.position.set(rec.group.position.x, 4.9, rec.group.position.z * 0.15);
    }
  }

  placeAt(toolId, type) {
    this._placeCarrier(toolId, type);
  }

  setToolStatus(toolId, status) {
    for (const [id, rec] of this.tools) {
      if (id !== toolId && rec.status !== "idle") {
        // leave others idle unless selected hold
      }
    }
    const rec = this.tools.get(toolId);
    if (!rec) return;
    rec.status = status;
    const col =
      status === "HOLD" ? 0xff6b7a :
      status === "RUN" ? 0x3ee0c0 :
      status === "QUEUE" ? 0xf0c14b :
      status === "DONE" ? 0xd3925a : 0x3ee0c0;
    rec.light.material.emissive.setHex(col);
    rec.light.material.color.setHex(col);
    rec.light.material.emissiveIntensity = status === "idle" ? 0.2 : 0.9;
    rec.point.color.setHex(col);
    rec.point.intensity = status === "idle" ? 0 : status === "HOLD" ? 2.2 : 1.4;
  }

  clearStatuses() {
    for (const rec of this.tools.values()) {
      rec.status = "idle";
      rec.light.material.emissive.setHex(0x3ee0c0);
      rec.light.material.emissiveIntensity = 0.25;
      rec.point.intensity = 0;
    }
  }

  moveTo(toolId, carrierType) {
    return new Promise((resolve) => {
      const fromId = this.currentToolId || toolId;
      const a = this.loadportWorld(fromId, new THREE.Vector3());
      const b = this.loadportWorld(toolId, new THREE.Vector3());
      const from = this.tools.get(fromId);
      const to = this.tools.get(toolId);
      if (carrierType) this.setCarrierType(carrierType);
      if (fromId === toolId) {
        this._placeCarrier(toolId, carrierType);
        resolve();
        return;
      }
      if (this.carrier.parent !== this.scene) this.scene.attach(this.carrier);

      const waypoints = [];
      waypoints.push(a.clone());
      const upA = a.clone(); upA.y = 4.55;
      waypoints.push(upA);
      const aisleA = new THREE.Vector3(from.group.position.x, 4.9, 0);
      waypoints.push(aisleA);
      const aisleB = new THREE.Vector3(to.group.position.x, 4.9, 0);
      waypoints.push(aisleB);
      const upB = b.clone(); upB.y = 4.55;
      waypoints.push(upB);
      waypoints.push(b.clone());

      // durations proportional to distance
      const segs = [];
      let total = 0;
      for (let i = 0; i < waypoints.length - 1; i++) {
        const d = waypoints[i].distanceTo(waypoints[i + 1]);
        const dur = Math.max(0.18, d * 0.085);
        segs.push({ a: waypoints[i], b: waypoints[i + 1], dur });
        total += dur;
      }
      this.transport = { segs, total, acc: 0, resolve, toolId, carried: false };
      this.shuttle.position.set(a.x, 4.9, a.z);
    });
  }

  setFollow(on) {
    this.follow = on;
    this.controls.enabled = !on;
  }

  focusOverview() {
    this.follow = false;
    this.controls.enabled = true;
    this._camTween = {
      fromP: this.camera.position.clone(),
      fromT: this.controls.target.clone(),
      toP: new THREE.Vector3(2, 31, 33),
      toT: new THREE.Vector3(-16, 0.2, 0),
      acc: 0,
      dur: 1.0,
    };
  }

  focusTool(toolId) {
    const rec = this.tools.get(toolId);
    if (!rec) return;
    this.follow = false;
    this.controls.enabled = true;
    const p = rec.group.position;
    const back = rec.face > 0 ? 14 : -14;
    this._camTween = {
      fromP: this.camera.position.clone(),
      fromT: this.controls.target.clone(),
      toP: new THREE.Vector3(p.x + 9, 13, p.z + back),
      toT: new THREE.Vector3(p.x, 1.1, p.z),
      acc: 0,
      dur: 0.9,
    };
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
    this.hovered = id;
    return id;
  }

  update(dt) {
    this.t += dt;

    if (this._camTween) {
      const tw = this._camTween;
      tw.acc += dt;
      const k = smooth(Math.min(1, tw.acc / tw.dur));
      this.camera.position.lerpVectors(tw.fromP, tw.toP, k);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, k);
      this.camera.lookAt(this.controls.target);
      if (k >= 1) this._camTween = null;
    } else if (this.follow) {
      const target = this.carrier.getWorldPosition(new THREE.Vector3());
      const desired = target.clone().add(new THREE.Vector3(8, 8, 10));
      this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      this.controls.target.lerp(target, 1 - Math.pow(0.001, dt));
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update();
    }

    if (this.transport) {
      const tr = this.transport;
      tr.acc += dt;
      // consume segments
      let t = tr.acc;
      let pos = tr.segs[0].a;
      let done = true;
      for (const seg of tr.segs) {
        if (t <= seg.dur) {
          const k = smooth(t / seg.dur);
          pos = new THREE.Vector3().lerpVectors(seg.a, seg.b, k);
          done = false;
          break;
        }
        t -= seg.dur;
        pos = seg.b;
      }
      // shuttle follows the high parts; carrier is picked after first lift
      const lifted = tr.acc > tr.segs[0].dur * 0.85;
      if (lifted && !tr.carried) {
        tr.carried = true;
        this.shuttle.attach(this.carrier);
        this.carrier.position.set(0, -1.05, 0);
      }
      this.shuttle.position.set(pos.x, Math.max(pos.y, 4.55), pos.z);
      if (tr.carried) {
        // carrier already parented
      } else {
        this.carrier.position.copy(tr.segs[0].a);
      }
      if (done || tr.acc >= tr.total) {
        if (this.carrier.parent !== this.scene) this.scene.attach(this.carrier);
        const end = this.loadportWorld(tr.toolId);
        this.carrier.position.copy(end);
        this.currentToolId = tr.toolId;
        const rec = this.tools.get(tr.toolId);
        this.shuttle.position.set(rec.group.position.x, 4.9, rec.group.position.z * 0.2);
        const resolve = tr.resolve;
        this.transport = null;
        resolve();
      }
    }

    const camY = this.camera.position.y;
    const labelOpacity = camY > 18 ? Math.max(0, 1 - (camY - 18) / 8) : 1;
    for (const rec of this.tools.values()) {
      rec.label.material.opacity = labelOpacity;
      rec.label.material.depthWrite = labelOpacity > 0.4;
      rec.label.visible = labelOpacity > 0.08;
    }

    // pulse hold/run lights
    for (const rec of this.tools.values()) {
      if (rec.status === "HOLD") {
        rec.light.material.emissiveIntensity = 0.55 + Math.sin(this.t * 6) * 0.4;
        rec.point.intensity = 1.4 + Math.sin(this.t * 6) * 0.8;
      } else if (rec.status === "RUN") {
        rec.light.material.emissiveIntensity = 0.7 + Math.sin(this.t * 3) * 0.2;
      }
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

function stepIdFromTool(id) {
  const map = {
    "INB-01": "recv", "DBK-02": "kit", "PLM-11": "plasma", "HB-21": "hbond",
    "AXI-31": "axi", "CUF-41": "cuf", "MOL-51": "mold", "GRD-61": "grind",
    "CWT-71": "cowtest", "DIC-81": "dice", "FC-91": "fc", "UF-92": "uf",
    "LID-93": "lid", "BGA-94": "ball", "SAM-95": "csam", "FTS-A1": "ft",
    "MRK-A2": "mark", "PAK-A3": "pack",
  };
  return map[id] || id;
}

function smooth(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}
