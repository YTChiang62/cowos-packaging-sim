import * as THREE from "three";
import { box, cyl, mat } from "./mat.js";

/** Mid paint and a lighter recess so cabinets read on pale and dark floors. */
const BODY = mat(0x62727a, { roughness: 0.44, metalness: 0.32 });
const DARK = mat(0x3e4c54, { roughness: 0.48, metalness: 0.5 });
const STEEL = mat(0xd5dee4, { roughness: 0.22, metalness: 0.82 });
const COPPER = mat(0xc49258, { roughness: 0.32, metalness: 0.7 });
const CERAMIC = mat(0xf0ece2, { roughness: 0.42, metalness: 0.06 });
const GLASS = mat(0xc6eee8, { roughness: 0.06, metalness: 0.08, transparent: true, opacity: 0.32 });
const WINDOW = mat(0xe7f7f4, { roughness: 0.05, metalness: 0.04, transparent: true, opacity: 0.22 });
const EMO = mat(0xd2454c, { emissive: 0xff3040, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.12 });
const OVEN_SHELL = mat(0x6e5e50, { roughness: 0.42, metalness: 0.36 });
const OVEN_DOOR = mat(0x514638, { roughness: 0.4, metalness: 0.4 });

const ACCENT = {
  inspect: 0x9fd4ff,
  diebank: 0xd3925a,
  plasma: 0xb388ff,
  bonder: 0x3ee0c0,
  oven: 0xe08a4a,
  metrology: 0xd7e7ff,
  grinder: 0x7ec8e0,
  mounter: 0x8eb4ff,
  dicer: 0x8eb4ff,
  wos: 0xe0a15a,
  dispense: 0xc48a5a,
  ball: 0xf0d48a,
  clean: 0x5ec8d8,
  handler: 0x5ee0c8,
  marker: 0xff6b7a,
  packer: 0xd7c4a0,
};

const OVEN_GLOW = {
  anneal: 0xe08a3a,
  subbake: 0xc47a32,
  ufcure: 0x3ec8a0,
  reflow: 0xff5a3a,
};

function stackLight(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cyl(g, 0.028, 0.036, 1.12, STEEL, 0, 0.58, 0);
  const red = cyl(g, 0.055, 0.055, 0.07, mat(0x6a3036, { emissive: 0xff6b7a, emissiveIntensity: 0.12 }), 0, 1.2, 0);
  const yel = cyl(g, 0.055, 0.055, 0.07, mat(0x6a5824, { emissive: 0xf0c14b, emissiveIntensity: 0.12 }), 0, 1.29, 0);
  const grn = cyl(g, 0.055, 0.055, 0.07, mat(0x1e4a3c, { emissive: 0x3ee0c0, emissiveIntensity: 0.12 }), 0, 1.38, 0);
  const blu = cyl(g, 0.055, 0.055, 0.07, mat(0x1a3860, { emissive: 0x4aa0ff, emissiveIntensity: 0.28 }), 0, 1.47, 0);
  cyl(g, 0.04, 0.04, 0.04, DARK, 0, 1.54, 0);
  parent.add(g);
  return { red: red.material, yel: yel.material, grn: grn.material, blu: blu.material };
}

function gantry(chuck) {
  for (const x of [-1.02, 1.02]) {
    for (const z of [-0.48, 0.48]) cyl(chuck, 0.03, 0.035, 1.05, STEEL, x, 0.52, z);
  }
  box(chuck, 2.15, 0.055, 0.06, COPPER, 0, 1.05, 0);
}

function loadPort(group, parts, accent) {
  const port = new THREE.Group();
  port.position.set(0, 0, 1.55);
  box(port, 1.12, 0.08, 0.56, DARK, 0, 0.5, -0.06);
  box(port, 0.04, 0.028, 0.5, STEEL, -0.26, 0.56, -0.06);
  box(port, 0.04, 0.028, 0.5, STEEL, 0.26, 0.56, -0.06);
  box(port, 0.055, 0.88, 0.055, STEEL, -0.5, 0.96, -0.02);
  box(port, 0.055, 0.88, 0.055, STEEL, 0.5, 0.96, -0.02);
  box(port, 1.08, 0.05, 0.05, STEEL, 0, 1.38, -0.02);
  box(port, 0.82, 0.7, 0.028, DARK, 0, 0.96, 0.02);
  const door = box(port, 0.74, 0.62, 0.03, mat(accent, {
    roughness: 0.18, metalness: 0.22, transparent: true, opacity: 0.4,
  }), 0, 0.96, 0.05);
  box(port, 0.2, 0.11, 0.018, WINDOW, 0, 1.12, 0.075);
  const padMat = mat(0x245850, { emissive: accent, emissiveIntensity: 0.2, roughness: 0.42 });
  box(port, 0.48, 0.028, 0.32, padMat, 0, 0.57, -0.08);
  cyl(port, 0.016, 0.016, 0.016, mat(0x3ee0c0, { emissive: 0x3ee0c0, emissiveIntensity: 0.75 }), -0.16, 0.6, 0.12, 8);
  cyl(port, 0.016, 0.016, 0.016, mat(0xf0c14b, { emissive: 0xf0c14b, emissiveIntensity: 0.4 }), 0.16, 0.6, 0.12, 8);
  box(port, 0.15, 0.2, 0.1, BODY, 0.68, 0.74, -0.02);
  box(port, 0.07, 0.04, 0.016, mat(accent, { emissive: accent, emissiveIntensity: 0.5, roughness: 0.3 }), 0.68, 0.8, 0.04);
  for (let i = 0; i < 4; i++) cyl(port, 0.009, 0.009, 0.025, STEEL, 0.62 + i * 0.038, 0.66, 0.04, 6);
  group.add(port);
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.72, 1.55);
  group.add(anchor);
  parts.door = door;
  parts.pad = padMat;
  return anchor;
}

function quill(head) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1, 0.045), STEEL);
  mesh.geometry.translate(0, 0.5, 0);
  mesh.castShadow = true;
  head.add(mesh);
  return mesh;
}

function bellows(parent, y) {
  for (let i = 0; i < 5; i++) {
    const r = i % 2 ? 0.07 : 0.045;
    cyl(parent, r, r, 0.028, DARK, 0, y + i * 0.032, 0, 10);
  }
}

function makeHead(kind) {
  const g = new THREE.Group();
  if (kind === "diebank") {
    box(g, 0.36, 0.05, 0.08, STEEL, 0, 0.16, 0);
    box(g, 0.035, 0.02, 0.3, STEEL, -0.11, 0.1, 0.12);
    box(g, 0.035, 0.02, 0.3, STEEL, 0.11, 0.1, 0.12);
    cyl(g, 0.035, 0.028, 0.08, mat(0x163044, { emissive: 0x9fd4ff, emissiveIntensity: 0.45 }), 0.18, 0.22, 0);
  } else if (kind === "inspect" || kind === "metrology") {
    cyl(g, 0.06, 0.04, 0.16, STEEL, 0, 0.1, 0);
    cyl(g, 0.09, 0.09, 0.06, mat(0x163044, { emissive: 0x9fd4ff, emissiveIntensity: 0.55 }), 0, 0.02, 0);
  } else if (kind === "bonder" || kind === "wos") {
    bellows(g, 0.22);
    box(g, 0.42, 0.12, 0.34, CERAMIC, 0, 0.14, 0);
    box(g, 0.26, 0.04, 0.2, COPPER, 0, 0.05, 0);
    cyl(g, 0.04, 0.03, 0.06, STEEL, -0.16, 0.08, 0.12, 8);
    cyl(g, 0.04, 0.03, 0.06, STEEL, 0.16, 0.08, 0.12, 8);
  } else if (kind === "ball" || kind === "dispense") {
    box(g, 0.7, 0.08, 0.55, STEEL, 0, 0.1, 0);
    if (kind === "dispense") cyl(g, 0.02, 0.008, 0.28, STEEL, 0.18, -0.08, 0);
    if (kind === "ball") box(g, 0.22, 0.06, 0.16, mat(0xc47a3a, { roughness: 0.35, metalness: 0.35 }), -0.22, 0.16, 0);
  } else if (kind === "marker") {
    box(g, 0.32, 0.12, 0.22, BODY, 0, 0.14, 0);
    box(g, 0.16, 0.06, 0.02, WINDOW, 0, 0.12, 0.12);
    cyl(g, 0.04, 0.02, 0.16, mat(0xff6b7a, { emissive: 0xff6b7a, emissiveIntensity: 0.7 }), 0, 0.02, 0);
  }
  const q = quill(g);
  g.userData.quill = q;
  return g;
}

function addHead(chuck, parts, kind) {
  gantry(chuck);
  const head = makeHead(kind);
  chuck.add(head);
  parts.head = head;
  parts.quill = head.userData.quill;
}

function ovenBody(group, chuck, parts, glow) {
  box(group, 1.7, 1.35, 1.15, OVEN_SHELL, 0.05, 1.05, -0.25);
  const win = mat(glow, { emissive: glow, emissiveIntensity: 0.4, roughness: 0.2, transparent: true, opacity: 0.58 });
  box(group, 0.7, 0.42, 0.04, win, 0.05, 1.15, 0.34);
  parts.glow = win;
  const door = box(group, 1.15, 0.72, 0.05, OVEN_DOOR, 0.05, 0.7, 0.4);
  parts.ovenDoor = door;
  box(group, 0.08, 0.22, 0.04, STEEL, 0.48, 0.72, 0.44);
  box(chuck, 1.15, 0.05, 0.8, mat(glow, { emissive: glow, emissiveIntensity: 0.28, roughness: 0.35 }), 0, 0.06, 0);
}

function quiet(mesh) {
  if (!mesh) return mesh;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function pipe(parent, x, y, z, h, material = STEEL) {
  return quiet(cyl(parent, 0.025, 0.025, h, material, x, y, z, 8));
}

/**
 * Shared service kit. Every mesh stays inside the walk solid
 * (local x ±1.38, z -1.22…1.86) so a new part is not a new door.
 */
function serviceKit(group) {
  box(group, 0.03, 0.14, 2.15, STEEL, -1.3, 0.18, -0.06);
  box(group, 0.03, 0.14, 2.15, STEEL, 1.3, 0.18, -0.06);
  box(group, 0.06, 0.62, 0.46, BODY, -1.24, 0.64, -0.62);
  for (let i = 0; i < 3; i++) quiet(box(group, 0.016, 0.08, 0.05, DARK, -1.2, 0.48 + i * 0.14, -0.7));
  quiet(box(group, 2.05, 0.045, 0.08, STEEL, 0, 0.32, -1.08));
  for (const x of [-0.7, 0, 0.7]) quiet(cyl(group, 0.012, 0.012, 0.16, DARK, x, 0.2, -1.08, 6));
  cyl(group, 0.055, 0.06, 0.025, STEEL, -1.12, 0.24, 0.82, 12);
  cyl(group, 0.042, 0.042, 0.035, EMO, -1.12, 0.27, 0.82, 12);
  quiet(box(group, 0.05, 0.48, 0.05, STEEL, 1.18, 1.82, 0.02));
  quiet(box(group, 0.62, 0.11, 0.36, BODY, 0.92, 2.1, 0.02));
  for (let i = 0; i < 4; i++) quiet(box(group, 0.42, 0.012, 0.016, STEEL, 0.92, 2.16, -0.08 + i * 0.06));
  box(group, 1.05, 0.045, 0.03, STEEL, 0, 1.38, 0.58);
  box(group, 1.05, 0.045, 0.03, STEEL, 0, 0.92, 0.58);
  box(group, 0.04, 0.46, 0.03, STEEL, -0.5, 1.15, 0.58);
  box(group, 0.04, 0.46, 0.03, STEEL, 0.5, 1.15, 0.58);
  quiet(box(group, 0.92, 0.38, 0.016, WINDOW, 0, 1.15, 0.6));
}

/** Extra silhouette inside the existing footprint so each tool reads up close. */
function dressTool(group, chuck, parts, station) {
  const id = station.id;
  if (id === "iqc") {
    if (parts.sweep) {
      quiet(cyl(parts.sweep, 0.035, 0.035, 0.12, STEEL, -0.07, 0.82, 0.02, 8));
      quiet(cyl(parts.sweep, 0.035, 0.035, 0.12, STEEL, 0.07, 0.82, 0.02, 8));
      quiet(cyl(parts.sweep, 0.02, 0.02, 0.035, DARK, -0.07, 0.9, 0.05, 8));
      quiet(cyl(parts.sweep, 0.02, 0.02, 0.035, DARK, 0.07, 0.9, 0.05, 8));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 24), STEEL);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.22, 0);
      quiet(ring);
      parts.sweep.add(ring);
    }
    quiet(box(group, 0.32, 0.62, 0.24, BODY, -0.95, 0.72, 0.28));
    quiet(box(group, 0.22, 0.36, 0.02, WINDOW, -0.95, 0.78, 0.41));
    for (let i = 0; i < 5; i++) {
      const wafer = quiet(cyl(group, 0.09, 0.09, 0.012, CERAMIC, -0.95, 0.48 + i * 0.08, 0.28, 16));
      wafer.rotation.x = Math.PI / 2;
    }
    quiet(box(chuck, 0.9, 0.02, 0.04, STEEL, 0, 0.08, 0.32));
    quiet(box(chuck, 0.9, 0.02, 0.04, STEEL, 0, 0.08, -0.32));
  } else if (id === "diebank") {
    const die = mat(0xd7ebe7, { roughness: 0.4, metalness: 0.2 });
    const hbm = mat(0x3ee0c0, { roughness: 0.35, metalness: 0.3, emissive: 0x0a3a32, emissiveIntensity: 0.35 });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        quiet(box(group, 0.12, 0.03, 0.09, (c + r) % 3 === 0 ? hbm : die, -0.48 + c * 0.16, 1.58, -0.78 + r * 0.12));
      }
    }
    quiet(box(group, 0.07, 1.35, 0.07, STEEL, 0.72, 1.15, -0.15));
    quiet(box(group, 0.28, 0.05, 0.08, COPPER, 0.48, 1.45, -0.15));
  } else if (id === "plasma") {
    quiet(cyl(group, 0.28, 0.28, 0.04, STEEL, 0.05, 1.42, -0.25, 20));
    quiet(cyl(group, 0.28, 0.28, 0.04, COPPER, 0.05, 0.95, -0.25, 20));
    const viewport = quiet(cyl(group, 0.14, 0.14, 0.03, GLASS, 0.05, 1.15, 0.4, 16));
    viewport.rotation.x = Math.PI / 2;
    const rotor = new THREE.Group();
    rotor.position.set(0.05, 1.18, -0.25);
    quiet(cyl(rotor, 0.16, 0.16, 0.03, mat(0xd7c4ff, { emissive: 0x6a3ad0, emissiveIntensity: 0.4 }), 0, 0, 0, 16));
    group.add(rotor);
    parts.rotor = rotor;
    pipe(group, -0.85, 1.15, -0.7, 0.7);
    pipe(group, -0.72, 1.05, -0.7, 0.55, mat(0xc4b0e8, { roughness: 0.35, metalness: 0.35 }));
    quiet(box(group, 0.32, 0.28, 0.22, BODY, -0.95, 0.78, -0.55));
    for (let i = 0; i < 4; i++) quiet(box(group, 0.34, 0.012, 0.16, STEEL, -0.95, 0.68 + i * 0.07, -0.55));
    quiet(cyl(group, 0.02, 0.02, 0.35, COPPER, -0.7, 0.95, -0.4, 8));
  } else if (id === "hbond") {
    const heater = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.02, 6, 24), COPPER);
    heater.rotation.x = Math.PI / 2;
    heater.position.y = 0.07;
    quiet(heater);
    chuck.add(heater);
    const chuckRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 6, 20), STEEL);
    chuckRing.rotation.x = Math.PI / 2;
    chuckRing.position.y = 0.05;
    quiet(chuckRing);
    chuck.add(chuckRing);
    quiet(box(group, 0.16, 0.9, 0.7, BODY, -1.05, 1.15, -0.15));
    quiet(box(group, 0.16, 0.9, 0.7, BODY, 1.05, 1.15, -0.15));
    quiet(cyl(chuck, 0.045, 0.035, 0.16, STEEL, -0.42, 0.55, 0.05, 8));
    quiet(cyl(chuck, 0.045, 0.035, 0.16, STEEL, 0.42, 0.55, 0.05, 8));
    quiet(cyl(chuck, 0.03, 0.03, 0.02, mat(0x9fd4ff, { emissive: 0x9fd4ff, emissiveIntensity: 0.45 }), -0.42, 0.46, 0.05, 8));
    quiet(cyl(chuck, 0.03, 0.03, 0.02, mat(0x9fd4ff, { emissive: 0x9fd4ff, emissiveIntensity: 0.45 }), 0.42, 0.46, 0.05, 8));
  } else if (id === "anneal") {
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 20), STEEL);
    mouth.position.set(0.05, 1.15, 0.38);
    quiet(mouth);
    group.add(mouth);
    quiet(cyl(group, 0.08, 0.08, 0.55, mat(0x4a6270, { roughness: 0.4, metalness: 0.45 }), -1.05, 0.7, -0.2, 12));
    pipe(group, -1.05, 1.15, -0.2, 0.4);
    for (let i = 0; i < 3; i++) {
      quiet(box(group, 0.5, 0.02, 0.02, mat(0xffb060, { emissive: 0xe08a3a, emissiveIntensity: 0.7 }), 0.05, 0.95 + i * 0.12, -0.15));
    }
  } else if (id === "overlay") {
    quiet(box(group, 1.15, 0.07, 0.1, STEEL, 0.1, 1.9, -0.3));
    for (const [x, z] of [[-0.12, 0.1], [0.12, 0.1], [0, -0.08]]) {
      quiet(cyl(group, 0.045, 0.06, 0.16, STEEL, 0.55 + x, 1.78, -0.35 + z, 10));
    }
    quiet(box(group, 0.42, 0.08, 0.28, CERAMIC, 0.55, 1.7, -0.35));
    quiet(box(group, 0.32, 0.2, 0.03, mat(0x163848, { emissive: 0x1a5878, emissiveIntensity: 0.55 }), -0.95, 1.15, 0.15));
    quiet(box(chuck, 0.7, 0.03, 0.55, CERAMIC, -0.1, 0.08, 0));
  } else if (id === "backgrind") {
    const chuckDisc = quiet(cyl(chuck, 0.55, 0.55, 0.05, mat(0x4a6068, { roughness: 0.32, metalness: 0.62 }), 0, 0.08, 0, 24));
    chuckDisc.castShadow = true;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      quiet(cyl(chuck, 0.035, 0.035, 0.02, DARK, Math.cos(a) * 0.28, 0.12, Math.sin(a) * 0.28, 8));
    }
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 18, Math.PI), STEEL);
    guard.rotation.y = Math.PI / 2;
    guard.position.set(0, 0.7, 0);
    quiet(guard);
    chuck.add(guard);
    quiet(box(group, 0.55, 0.28, 0.32, BODY, 0, 1.45, -0.35));
    quiet(cyl(group, 0.08, 0.08, 0.22, STEEL, 0, 1.22, -0.15, 12));
    const water = mat(0x9fd8ea, { transparent: true, opacity: 0.55, emissive: 0x1a6a88, emissiveIntensity: 0.25, roughness: 0.1 });
    for (const x of [-0.22, 0.22]) {
      const nozzle = quiet(cyl(chuck, 0.012, 0.008, 0.22, water, x, 0.42, 0.18, 6));
      nozzle.rotation.x = 0.7;
    }
    quiet(box(chuck, 0.06, 0.04, 0.16, COPPER, 0.48, 0.2, 0.05));
  } else if (id === "mount") {
    const uv = mat(0x9eb6ff, { emissive: 0x4458c8, emissiveIntensity: 0.45, roughness: 0.3 });
    quiet(box(chuck, 0.7, 0.04, 0.08, uv, 0.15, 0.42, 0.15));
    const roller = new THREE.Group();
    quiet(cyl(roller, 0.12, 0.12, 0.5, STEEL, 0, 0, 0, 12));
    roller.rotation.z = Math.PI / 2;
    roller.position.set(0.15, 0.55, -0.2);
    chuck.add(roller);
    const nip = quiet(cyl(chuck, 0.06, 0.06, 0.48, DARK, 0.15, 0.38, 0.05, 10));
    nip.rotation.z = Math.PI / 2;
    for (const [x, z] of [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]]) {
      quiet(box(chuck, 0.08, 0.04, 0.08, STEEL, x, 0.08, z));
    }
  } else if (id === "dice") {
    quiet(cyl(chuck, 0.02, 0.012, 0.22, STEEL, 0.28, 0.55, 0.15, 8));
    quiet(box(group, 1.15, 0.08, 0.7, GLASS, 0, 1.55, 0.15));
    quiet(box(chuck, 0.08, 0.08, 0.08, COPPER, -0.55, 0.2, -0.4));
    quiet(box(group, 0.9, 0.28, 0.22, BODY, 0, 1.55, -0.55));
    const wash = mat(0x9fd8ea, { transparent: true, opacity: 0.5, emissive: 0x1a6a88, emissiveIntensity: 0.2 });
    quiet(cyl(chuck, 0.012, 0.01, 0.18, wash, -0.2, 0.4, 0.22, 6));
    quiet(cyl(chuck, 0.012, 0.01, 0.18, wash, 0.2, 0.4, 0.22, 6));
  } else if (id === "diceaoi") {
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.028, 8, 28),
      mat(0xf4f7ff, { emissive: 0xd7e7ff, emissiveIntensity: 0.65, roughness: 0.2, metalness: 0.15 }),
    );
    frame.rotation.x = Math.PI / 2;
    frame.position.y = 0.1;
    quiet(frame);
    chuck.add(frame);
    quiet(box(group, 1.2, 0.08, 0.08, STEEL, 0, 1.45, -0.15));
    quiet(box(group, 0.22, 0.16, 0.16, BODY, 0, 1.58, -0.15));
    quiet(cyl(group, 0.05, 0.04, 0.1, mat(0x163044, { emissive: 0x9fd4ff, emissiveIntensity: 0.55 }), 0, 1.42, -0.05, 10));
  } else if (id === "subbake") {
    for (let i = 0; i < 4; i++) {
      quiet(box(group, 0.36, 0.02, 0.22, mat(0xd3925a, { roughness: 0.4, metalness: 0.45 }), 0.95, 0.55 + i * 0.18, -0.55));
    }
    quiet(box(group, 0.08, 0.9, 0.28, DARK, 0.78, 0.9, -0.55));
    quiet(box(group, 0.08, 0.9, 0.28, DARK, 1.14, 0.9, -0.55));
    quiet(box(group, 0.1, 0.16, 0.04, STEEL, 0.55, 0.78, 0.44));
  } else if (id === "wos") {
    for (let i = 0; i < 4; i++) {
      quiet(box(chuck, 0.5, 0.008, 0.02, DARK, 0.1, 0.09, -0.18 + i * 0.12));
    }
    quiet(box(group, 0.55, 0.06, 0.4, BODY, 0.85, 0.55, 0.15));
    quiet(box(chuck, 0.04, 0.02, 0.04, mat(0xf0d48a, { emissive: 0xc4922a, emissiveIntensity: 0.4 }), -0.28, 0.1, -0.28));
    quiet(box(chuck, 0.04, 0.02, 0.04, mat(0xf0d48a, { emissive: 0xc4922a, emissiveIntensity: 0.4 }), 0.28, 0.1, 0.22));
  } else if (id === "underfill") {
    if (parts.needle) {
      quiet(cyl(parts.needle, 0.055, 0.05, 0.24, mat(0xe7f4ee, { transparent: true, opacity: 0.45, roughness: 0.08 }), 0, 0.55, 0, 12));
      quiet(cyl(parts.needle, 0.04, 0.04, 0.14, mat(0xc48a5a, { roughness: 0.3, emissive: 0x6a3a18, emissiveIntensity: 0.25 }), 0, 0.48, 0, 12));
    }
    quiet(box(chuck, 0.16, 0.1, 0.12, BODY, -0.28, 0.72, 0.12));
    const eye = mat(0x9fd4ff, { emissive: 0x245868, emissiveIntensity: 0.55 });
    quiet(cyl(chuck, 0.045, 0.04, 0.08, eye, -0.28, 0.6, 0.2, 10));
    quiet(cyl(chuck, 0.07, 0.05, 0.22, mat(0xc48a5a, { roughness: 0.35, metalness: 0.25 }), 0.22, 0.85, -0.05, 12));
  } else if (id === "ufcure") {
    const belt = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const roller = quiet(cyl(belt, 0.05, 0.05, 0.7, STEEL, -0.4 + i * 0.2, 0.12, 0, 10));
      roller.rotation.z = Math.PI / 2;
    }
    chuck.add(belt);
    parts.belt = belt;
    quiet(box(group, 0.9, 0.04, 0.08, mat(0x3ec8a0, { emissive: 0x14684a, emissiveIntensity: 0.55 }), 0.05, 1.35, 0.36));
    quiet(cyl(group, 0.08, 0.08, 0.7, mat(0xd7fff0, { emissive: 0x3ec8a0, emissiveIntensity: 0.35, transparent: true, opacity: 0.55 }), 0.05, 1.05, -0.15, 12));
  } else if (id === "warpage") {
    quiet(box(chuck, 1.2, 0.05, 0.08, STEEL, 0, 0.72, 0));
    quiet(box(chuck, 0.14, 0.16, 0.14, BODY, 0, 0.84, 0));
    const left = quiet(cyl(chuck, 0.03, 0.03, 0.34, mat(0xff6b7a, { emissive: 0xff3048, emissiveIntensity: 0.45 }), -0.35, 0.55, 0.1, 8));
    left.rotation.z = 0.5;
    const right = quiet(cyl(chuck, 0.03, 0.03, 0.34, STEEL, 0.35, 0.55, 0.1, 8));
    right.rotation.z = -0.5;
    quiet(box(chuck, 0.7, 0.02, 0.5, CERAMIC, -0.1, 0.08, 0));
  } else if (id === "ball") {
    quiet(cyl(group, 0.1, 0.08, 0.12, mat(0xc47a3a, { roughness: 0.35, metalness: 0.4 }), -0.85, 0.55, 0.2, 12));
    const stencil = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 4), STEEL);
    stencil.rotation.x = -Math.PI / 2;
    stencil.position.set(0.15, 0.2, 0);
    quiet(stencil);
    chuck.add(stencil);
    quiet(box(chuck, 0.62, 0.04, 0.48, CERAMIC, 0.05, 0.08, 0));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        quiet(cyl(chuck, 0.03, 0.03, 0.012, DARK, -0.1 + c * 0.12, 0.11, -0.1 + r * 0.12, 8));
      }
    }
  } else if (id === "reflow") {
    const zones = [0xc47a32, 0xff5a3a, 0xe08a3a];
    zones.forEach((color, i) => {
      const glow = mat(color, { emissive: color, emissiveIntensity: 0.45, transparent: true, opacity: 0.55 });
      quiet(box(group, 0.42, 0.28, 0.04, glow, -0.45 + i * 0.48, 1.2, 0.36));
    });
    const belt = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const roller = quiet(cyl(belt, 0.04, 0.04, 0.62, DARK, -0.6 + i * 0.24, 0.1, 0, 8));
      roller.rotation.z = Math.PI / 2;
    }
    chuck.add(belt);
    parts.belt = belt;
    quiet(box(chuck, 1.35, 0.05, 0.035, STEEL, 0, 0.16, 0.28));
    quiet(box(chuck, 1.35, 0.05, 0.035, STEEL, 0, 0.16, -0.28));
    const curtain = mat(0x8a4040, { transparent: true, opacity: 0.4, roughness: 0.6 });
    quiet(box(group, 0.03, 0.4, 0.5, curtain, -0.95, 0.75, 0.02));
    quiet(box(group, 0.03, 0.4, 0.5, curtain, 0.95, 0.75, 0.02));
  } else if (id === "fluxclean") {
    for (const z of [-0.28, 0, 0.28]) pipe(group, 0, 1.25, z, 0.45);
    quiet(box(group, 0.9, 0.06, 0.08, STEEL, 0, 1.45, -0.15));
    for (const x of [-0.3, 0, 0.3]) {
      quiet(cyl(group, 0.02, 0.02, 0.02, mat(0x9fe8f4, { emissive: 0x5ec8d8, emissiveIntensity: 0.4 }), x, 1.02, -0.15, 8));
    }
    quiet(box(group, 1.35, 0.08, 0.08, STEEL, 0, 0.55, -0.55));
    quiet(box(group, 1.35, 0.08, 0.08, STEEL, 0, 0.55, 0.25));
  } else if (id === "ftest") {
    quiet(box(group, 0.28, 0.7, 0.28, BODY, -0.85, 0.7, 0.15));
    quiet(box(group, 0.28, 0.7, 0.28, BODY, 0.95, 0.7, 0.15));
    for (let i = 0; i < 3; i++) quiet(box(group, 0.18, 0.025, 0.16, DARK, -0.85, 0.48 + i * 0.16, 0.15));
    quiet(box(group, 0.4, 0.06, 0.16, STEEL, 0.15, 1.5, -0.15));
    for (let i = 0; i < 4; i++) quiet(cyl(chuck, 0.012, 0.012, 0.05, COPPER, -0.12 + i * 0.08, 0.16, 0.05, 6));
  } else if (id === "mark") {
    quiet(box(chuck, 0.22, 0.12, 0.16, BODY, 0, 0.78, 0));
    pipe(group, 0.85, 1.15, -0.55, 0.45);
    const arm = quiet(box(group, 0.42, 0.035, 0.035, STEEL, 0.5, 1.4, -0.28));
    arm.rotation.z = -0.35;
    arm.rotation.y = 0.4;
    quiet(box(group, 0.14, 0.14, 0.14, DARK, 0.55, 1.52, -0.15));
  } else if (id === "pack") {
    for (let i = 0; i < 3; i++) {
      quiet(box(group, 0.62, 0.03, 0.42, mat(0x4a545c, { roughness: 0.5, metalness: 0.3 }), -0.85, 0.5 + i * 0.08, 0.15));
    }
    quiet(box(group, 0.06, 1.05, 0.06, STEEL, -1.1, 1.0, 0.15));
    quiet(box(chuck, 0.08, 0.08, 0.08, mat(0xf0d48a, { emissive: 0xc4922a, emissiveIntensity: 0.35 }), -0.35, 0.12, -0.22));
    quiet(box(chuck, 0.7, 0.035, 0.08, mat(0xc47a3a, { emissive: 0x8a3e12, emissiveIntensity: 0.45, metalness: 0.4 }), 0.1, 0.32, 0.12));
  }
}

export function buildTool(station) {
  const group = new THREE.Group();
  group.position.set(station.place.x, 0, station.place.z);
  group.rotation.y = station.place.face > 0 ? 0 : Math.PI;
  group.userData.toolId = station.tool;

  const kind = station.kind;
  const accentHex = ACCENT[kind] || 0xd3925a;
  const accent = mat(accentHex, { emissive: accentHex, emissiveIntensity: 0.16, roughness: 0.35, metalness: 0.45 });

  box(group, 2.7, 0.2, 2.35, DARK, 0, 0.1, -0.08);
  box(group, 2.64, 0.04, 0.05, accent, 0, 0.22, 1.02);

  const chuck = new THREE.Group();
  chuck.position.set(0, 0.72, -0.05);
  group.add(chuck);
  box(chuck, 1.7, 0.04, 1.15, DARK, 0, 0.02, 0);

  const parts = {
    head: null, quill: null, spindle: null, spinner: null, blade: null,
    lamp: null, pusher: null, cards: null, door: null, pad: null,
    table: null, contactor: null, optics: null, glow: null, sweep: null,
    wheel: null, needle: null, laser: null, ovenDoor: null, roll: null,
  };
  const load = loadPort(group, parts, accentHex);

  if (kind === "diebank") {
    box(group, 1.55, 1.7, 0.55, mat(0x6b5844, { roughness: 0.48, metalness: 0.28 }), -0.15, 1.15, -0.72);
    for (let i = 0; i < 4; i++) {
      const y = 0.55 + i * 0.32;
      box(group, 1.3, 0.035, 0.4, DARK, -0.15, y, -0.7);
      box(group, 1.15, 0.045, 0.32, mat(0xd7a36a, { roughness: 0.5, metalness: 0.22 }), -0.15, y + 0.05, -0.68);
    }
    addHead(chuck, parts, "diebank");
  } else if (kind === "inspect") {
    box(group, 1.35, 0.9, 0.7, mat(0x4e6270, { roughness: 0.4, metalness: 0.42 }), 0, 1.15, -0.35);
    const sweep = new THREE.Group();
    cyl(sweep, 0.12, 0.08, 0.28, STEEL, 0, 0.7, 0);
    cyl(sweep, 0.16, 0.16, 0.08, mat(0x245068, { emissive: 0x9fd4ff, emissiveIntensity: 0.7 }), 0, 0.52, 0);
    chuck.add(sweep);
    parts.sweep = sweep;
    box(chuck, 1.2, 0.025, 0.7, mat(0x9fd4ff, { emissive: 0x2a6a88, emissiveIntensity: 0.25 }), 0, 0.05, 0);
  } else if (kind === "plasma") {
    const glow = mat(0xb388ff, { emissive: 0x6a3ad0, emissiveIntensity: 0.45, roughness: 0.2, transparent: true, opacity: 0.72 });
    const chamber = cyl(group, 0.62, 0.62, 0.7, glow, 0.05, 1.15, -0.25, 28);
    chamber.scale.y = 0.85;
    parts.glow = glow;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.03, 8, 28), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0.05, 0.85, -0.25);
    group.add(ring);
    const door = box(group, 0.7, 0.55, 0.04, mat(0x3a3050, { roughness: 0.35, metalness: 0.4 }), 0.05, 0.85, 0.15);
    parts.ovenDoor = door;
  } else if (kind === "bonder") {
    cyl(group, 0.72, 0.72, 0.42, mat(0x3a5856, { roughness: 0.32, metalness: 0.55 }), 0.05, 1.05, -0.35, 28);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 28), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0.05, 0.9, -0.2);
    group.add(ring);
    addHead(chuck, parts, "bonder");
    const optics = new THREE.Group();
    cyl(optics, 0.05, 0.04, 0.28, STEEL, -0.38, 0.7, 0);
    cyl(optics, 0.05, 0.04, 0.28, STEEL, 0.38, 0.7, 0);
    cyl(optics, 0.035, 0.035, 0.02, mat(0x9fd4ff, { emissive: 0x9fd4ff, emissiveIntensity: 0.5 }), -0.38, 0.54, 0, 8);
    cyl(optics, 0.035, 0.035, 0.02, mat(0x9fd4ff, { emissive: 0x9fd4ff, emissiveIntensity: 0.5 }), 0.38, 0.54, 0, 8);
    chuck.add(optics);
    parts.optics = optics;
  } else if (kind === "oven") {
    ovenBody(group, chuck, parts, OVEN_GLOW[station.id] || 0xe08a3a);
  } else if (kind === "metrology") {
    box(group, 0.7, 1.45, 0.55, mat(0xe7eef2, { roughness: 0.35, metalness: 0.25 }), 0.55, 1.15, -0.35);
    cyl(group, 0.1, 0.14, 0.35, STEEL, 0.55, 0.55, -0.05);
    const sweep = new THREE.Group();
    box(sweep, 0.55, 0.08, 0.18, mat(0xd7e7ff, { emissive: 0x8ab4e0, emissiveIntensity: 0.35 }), 0, 0.85, 0);
    cyl(sweep, 0.08, 0.05, 0.2, STEEL, 0, 0.7, 0);
    chuck.add(sweep);
    parts.sweep = sweep;
    box(chuck, 0.9, 0.03, 0.7, mat(0x3a4a50, { roughness: 0.4, metalness: 0.4 }), -0.15, 0.05, 0);
  } else if (kind === "grinder") {
    box(group, 1.5, 0.7, 0.45, BODY, 0, 1.15, -0.7);
    const wheel = new THREE.Group();
    const spinner = new THREE.Group();
    wheel.add(spinner);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28),
      mat(0xd5dde4, { metalness: 0.85, roughness: 0.18 })
    );
    disc.rotation.z = Math.PI / 2;
    spinner.add(disc);
    cyl(wheel, 0.06, 0.06, 0.4, STEEL, 0, 0.35, 0);
    chuck.add(wheel);
    parts.wheel = wheel;
    parts.spinner = spinner;
  } else if (kind === "mounter") {
    const roll = new THREE.Group();
    cyl(roll, 0.28, 0.28, 0.55, mat(0x3a62b0, { roughness: 0.45, metalness: 0.15 }), 0, 0, 0, 20);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(-0.85, 0.85, -0.15);
    chuck.add(roll);
    parts.roll = roll;
    parts.spinner = roll;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 28), STEEL);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    chuck.add(ring);
    box(chuck, 0.9, 0.02, 0.9, mat(0x3a62b0, { transparent: true, opacity: 0.65, roughness: 0.5 }), 0.15, 0.05, 0);
  } else if (kind === "dicer") {
    box(group, 1.7, 1.05, 0.22, mat(0x3c4468, { roughness: 0.4, metalness: 0.42 }), 0, 1.25, -0.85);
    const table = new THREE.Group();
    chuck.add(table);
    box(table, 1.35, 0.07, 1.15, mat(0x3e4852, { roughness: 0.45, metalness: 0.4 }), 0, 0.06, 0);
    box(table, 1.3, 0.03, 0.025, mat(0x9ec4ff, { emissive: 0x6aa0ff, emissiveIntensity: 0.35 }), 0, 0.1, 0);
    parts.table = table;
    const spindle = new THREE.Group();
    chuck.add(spindle);
    cyl(spindle, 0.12, 0.12, 0.22, BODY, 0, 0.22, 0);
    const spinner = new THREE.Group();
    spindle.add(spinner);
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.018, 28),
      mat(0xf7fbff, { metalness: 0.92, roughness: 0.1, emissive: 0xc5d8ee, emissiveIntensity: 0.4 })
    );
    blade.castShadow = true;
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.045, 16), STEEL);
    flange.position.y = -0.02;
    blade.add(flange);
    spinner.add(blade);
    parts.spindle = spindle;
    parts.spinner = spinner;
    parts.blade = blade;
  } else if (kind === "wos") {
    addHead(chuck, parts, "wos");
    const mag = new THREE.Group();
    mag.position.set(-0.95, 0, -0.25);
    box(mag, 0.42, 1.35, 0.38, mat(0x6a5844, { roughness: 0.45, metalness: 0.35 }), 0, 0.85, 0);
    parts.cards = new THREE.Group();
    for (let i = 0; i < 5; i++) box(parts.cards, 0.32, 0.025, 0.26, mat(0xd3925a, { roughness: 0.38, metalness: 0.5 }), 0.04, 0.35 + i * 0.16, 0);
    mag.add(parts.cards);
    group.add(mag);
    const hot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.05, 24),
      mat(0xc47a3a, { emissive: 0x8a3e12, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.3 })
    );
    hot.position.y = 0.06;
    chuck.add(hot);
    const pusher = new THREE.Group();
    box(pusher, 0.32, 0.05, 0.08, STEEL, 0, 0.16, 0);
    chuck.add(pusher);
    parts.pusher = pusher;
  } else if (kind === "dispense") {
    addHead(chuck, parts, "dispense");
    const needle = new THREE.Group();
    cyl(needle, 0.035, 0.012, 0.42, STEEL, 0, 0.2, 0);
    cyl(needle, 0.09, 0.07, 0.22, mat(0xc48a5a, { roughness: 0.4, metalness: 0.3 }), 0, 0.48, 0);
    chuck.add(needle);
    parts.needle = needle;
  } else if (kind === "ball") {
    addHead(chuck, parts, "ball");
    const bump = mat(0xf2d48a, { metalness: 0.8, roughness: 0.2 });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bump);
        s.position.set(-0.12 + c * 0.12, 0.08, -0.12 + r * 0.12);
        if (parts.head) parts.head.add(s);
      }
    }
  } else if (kind === "clean") {
    box(group, 1.45, 0.55, 0.9, mat(0x2f5c64, { roughness: 0.28, metalness: 0.32 }), 0, 0.7, -0.15);
    const bath = box(group, 1.15, 0.08, 0.62, mat(0x5ec8d8, {
      emissive: 0x1a6a78, emissiveIntensity: 0.4, transparent: true, opacity: 0.65, roughness: 0.1,
    }), 0, 0.95, -0.15);
    parts.glow = bath.material;
    const door = box(group, 1.2, 0.4, 0.04, GLASS, 0, 1.15, 0.32);
    parts.ovenDoor = door;
  } else if (kind === "handler") {
    box(group, 1.15, 0.7, 0.7, mat(0x3a564e, { roughness: 0.4, metalness: 0.4 }), 0.15, 1.05, -0.2);
    const contactor = new THREE.Group();
    box(contactor, 0.55, 0.22, 0.4, mat(0x5a4636, { roughness: 0.4, metalness: 0.4 }), 0, 0.85, 0);
    box(contactor, 0.38, 0.04, 0.26, mat(0xf0d48a, { emissive: 0xc4922a, emissiveIntensity: 0.3, metalness: 0.7 }), 0, 0.72, 0);
    chuck.add(contactor);
    parts.contactor = contactor;
    const lampMat = mat(0x1e4a40, { emissive: 0x3ee0c0, emissiveIntensity: 0.2 });
    box(chuck, 0.9, 0.03, 0.03, lampMat, 0, 0.08, 0.4);
    parts.lamp = lampMat;
  } else if (kind === "marker") {
    addHead(chuck, parts, "marker");
    const beamMat = mat(0xff6b7a, { emissive: 0xff3048, emissiveIntensity: 1.1, transparent: true, opacity: 0.15, roughness: 0.2 });
    const beam = box(chuck, 0.02, 0.7, 0.02, beamMat, 0, 0.45, 0);
    parts.laser = beam;
  } else if (kind === "packer") {
    box(group, 1.55, 0.7, 0.55, mat(0x5c5348, { roughness: 0.45, metalness: 0.35 }), 0.35, 0.85, -0.45);
    for (let i = 0; i < 4; i++) {
      box(group, 0.7, 0.025, 0.4, mat(0x3e4850, { roughness: 0.5, metalness: 0.3 }), 0.4, 0.58 + i * 0.12, -0.45);
    }
    const pusher = new THREE.Group();
    box(pusher, 0.4, 0.06, 0.08, STEEL, 0, 0.16, 0);
    chuck.add(pusher);
    parts.pusher = pusher;
    box(chuck, 0.85, 0.04, 0.6, mat(0x3e4850, { roughness: 0.5, metalness: 0.25 }), 0, 0.05, 0);
  }

  dressTool(group, chuck, parts, station);
  serviceKit(group);

  const lights = stackLight(group, 1.18, 0.22, 0.9);
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2.3, 2.2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(0, 1.1, 0);
  hit.userData.toolId = station.tool;
  group.add(hit);

  const point = new THREE.PointLight(accentHex, 0, 5);
  point.position.set(0, 1.8, 0.2);
  group.add(point);

  return { group, chuck, load, hit, parts, lights, point, kind };
}

export function poseTool(built, m, spin) {
  const { parts } = built;
  if (parts.head) {
    const passX = built.kind === "ball" ? (m.pass || 0) * 0.22 : 0;
    parts.head.position.set(m.head.x + passX, m.head.y, m.head.z);
    if (parts.quill) parts.quill.scale.y = Math.max(0.08, 1.15 - m.head.y);
  }
  if (parts.spindle) {
    parts.spindle.position.set(m.blade.x, m.blade.y, m.blade.z);
    if (m.blade.axis === "z") {
      parts.blade.rotation.set(Math.PI / 2, 0, 0);
      parts.spinner.rotation.set(0, 0, spin);
    } else {
      parts.blade.rotation.set(0, 0, Math.PI / 2);
      parts.spinner.rotation.set(spin, 0, 0);
    }
  }
  if (parts.wheel) {
    parts.wheel.position.y = 0.55 - (m.wheel || 0) * 0.28;
    if (parts.spinner) parts.spinner.rotation.x = spin;
  }
  if (parts.roll) parts.roll.rotation.x = spin * 0.15;
  if (parts.lamp) parts.lamp.emissiveIntensity = 0.12 + (m.lamp || 0) * 1.4;
  if (parts.glow && parts.glow.emissiveIntensity != null) {
    const base = built.kind === "plasma" ? 0.35 : 0.25;
    parts.glow.emissiveIntensity = base + (m.lamp || 0) * 1.3;
  }
  if (parts.pusher) parts.pusher.position.x = -0.45 + (m.pusher || 0) * 0.7;
  if (parts.cards) parts.cards.position.y = (m.pusher || 0) * 0.05;
  if (parts.table) parts.table.position.x = (m.table || 0) * 0.25;
  if (parts.contactor) parts.contactor.position.y = 0.85 - (m.contactor || 0) * 0.28;
  if (parts.optics) parts.optics.rotation.y = Math.sin((m.head?.x || 0) * 2) * 0.15;
  if (parts.sweep) parts.sweep.position.x = (m.sweep || 0) * 0.45;
  if (parts.ovenDoor) {
    if (parts.ovenDoor.userData.baseY == null) parts.ovenDoor.userData.baseY = parts.ovenDoor.position.y;
    parts.ovenDoor.position.y = parts.ovenDoor.userData.baseY + (m.door || 0) * 0.35;
  }
  if (parts.needle) {
    parts.needle.position.y = 0.55 - (m.needle || 0) * 0.38;
    parts.needle.position.x = (m.pass || 0) * 0.42;
  }
  if (parts.rotor) parts.rotor.rotation.y = spin;
  if (parts.belt) {
    for (const roller of parts.belt.children) roller.rotation.x = spin;
  }
  if (parts.laser) {
    parts.laser.material.opacity = 0.05 + (m.laser || 0) * 0.85;
    parts.laser.scale.y = 0.3 + (m.laser || 0) * 0.7;
  }
}

const SHELL = {
  foup: mat(0x1c4a46, { roughness: 0.35, metalness: 0.3 }),
  wafer: mat(0xc9d4d8, { roughness: 0.16, metalness: 0.8 }),
  frame: mat(0xd5dbe2, { metalness: 0.75, roughness: 0.28 }),
  tape: mat(0x2a4d8a, { roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.75 }),
  sub: mat(0xd3925a, { roughness: 0.42, metalness: 0.45 }),
  tray: mat(0x3e4850, { roughness: 0.55, metalness: 0.28 }),
};

const SLOT = mat(0x8aa3a8, { roughness: 0.45, metalness: 0.35 });
const PIP = mat(0xf2d48a, { metalness: 0.8, roughness: 0.2 });

export function carrierShell(type) {
  const g = new THREE.Group();
  if (type === "FOUP") {
    box(g, 0.92, 1.28, 0.12, SHELL.foup, 0, 0.7, -0.36);
    box(g, 0.08, 1.28, 0.78, SHELL.foup, -0.42, 0.7, 0);
    box(g, 0.08, 1.28, 0.78, SHELL.foup, 0.42, 0.7, 0);
    box(g, 0.92, 0.08, 0.78, SHELL.foup, 0, 1.32, 0);
    box(g, 0.92, 0.08, 0.78, DARK, 0, 0.08, 0);
    box(g, 0.28, 0.08, 0.12, COPPER, 0, 1.4, 0.1);
    box(g, 0.16, 0.08, 0.04, COPPER, 0.28, 0.7, 0.36);
    for (const x of [-0.34, 0.34]) {
      for (let i = 0; i < 8; i++) box(g, 0.02, 0.012, 0.1, SLOT, x, 0.22 + i * 0.12, 0.28);
    }
    for (let i = 0; i < 8; i++) {
      const w = cyl(g, 0.3, 0.3, 0.012, SHELL.wafer, 0, 0.22 + i * 0.12, -0.02, 20);
      w.rotation.x = Math.PI / 2;
      w.castShadow = false;
    }
    const notch = cyl(g, 0.04, 0.04, 0.02, COPPER, 0.22, 0.22, -0.02, 8);
    notch.rotation.x = Math.PI / 2;
  } else if (type === "FRAME") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.04, 8, 28), SHELL.frame);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);
    cyl(g, 0.44, 0.44, 0.018, SHELL.tape, 0, 0.06, 0, 28);
    for (let i = -1; i <= 1; i++) {
      box(g, 0.7, 0.006, 0.012, SLOT, 0, 0.08, i * 0.18);
      box(g, 0.012, 0.006, 0.7, SLOT, i * 0.18, 0.082, 0);
    }
    for (const [x, z] of [[-0.16, 0.16], [0.16, -0.16], [0.16, 0.16], [-0.16, -0.16]]) {
      box(g, 0.1, 0.02, 0.08, CERAMIC, x, 0.09, z);
    }
  } else if (type === "MAG") {
    box(g, 0.08, 1.35, 0.42, DARK, -0.26, 0.7, 0);
    box(g, 0.08, 1.35, 0.42, DARK, 0.26, 0.7, 0);
    box(g, 0.5, 0.06, 0.42, DARK, 0, 1.35, 0);
    box(g, 0.16, 0.06, 0.08, COPPER, 0, 1.42, 0.12);
    for (let i = 0; i < 6; i++) {
      const y = 0.24 + i * 0.17;
      box(g, 0.42, 0.025, 0.3, SHELL.sub, 0, y, 0);
      box(g, 0.28, 0.008, 0.04, PIP, 0, y + 0.02, 0.08);
    }
  } else {
    box(g, 1.15, 0.05, 0.78, SHELL.tray, 0, 0.05, 0);
    box(g, 1.2, 0.05, 0.04, STEEL, 0, 0.1, 0.38);
    box(g, 1.2, 0.05, 0.04, STEEL, 0, 0.1, -0.38);
    box(g, 0.04, 0.05, 0.78, STEEL, 0.58, 0.1, 0);
    box(g, 0.04, 0.05, 0.78, STEEL, -0.58, 0.1, 0);
    box(g, 0.06, 0.02, 0.06, PIP, -0.48, 0.09, -0.3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = -0.36 + c * 0.24;
        const z = -0.22 + r * 0.22;
        box(g, 0.16, 0.012, 0.14, mat(0x242c32, { roughness: 0.6 }), x, 0.085, z);
        const pip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), PIP);
        pip.position.set(x, 0.1, z);
        pip.castShadow = false;
        g.add(pip);
      }
    }
  }
  return g;
}

export const STOW_ANCHOR = {
  FOUP: new THREE.Vector3(0, 0.55, 0.62),
  FRAME: new THREE.Vector3(0, 0.16, 0),
  MAG: new THREE.Vector3(0.48, 0.45, 0),
  TRAY: new THREE.Vector3(0, 0.16, 0),
};
