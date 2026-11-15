import * as THREE from "three";
import { box, cyl, mat } from "./mat.js";

const BODY = mat(0x1b262b, { roughness: 0.38, metalness: 0.55 });
const DARK = mat(0x12181c, { roughness: 0.42, metalness: 0.6 });
const STEEL = mat(0xb7c0c6, { roughness: 0.28, metalness: 0.78 });
const COPPER = mat(0xb8874e, { roughness: 0.32, metalness: 0.7 });
const CERAMIC = mat(0xe7e2d6, { roughness: 0.45, metalness: 0.08 });
const GLASS = mat(0x7fdad0, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28 });

function stackLight(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cyl(g, 0.035, 0.035, 0.55, DARK, 0, 0.28, 0);
  const red = cyl(g, 0.08, 0.08, 0.11, mat(0x3a181c, { emissive: 0xff6b7a, emissiveIntensity: 0.05, roughness: 0.4 }), 0, 0.64, 0);
  const yel = cyl(g, 0.08, 0.08, 0.11, mat(0x3a3014, { emissive: 0xf0c14b, emissiveIntensity: 0.05, roughness: 0.4 }), 0, 0.76, 0);
  const grn = cyl(g, 0.08, 0.08, 0.11, mat(0x143028, { emissive: 0x3ee0c0, emissiveIntensity: 0.05, roughness: 0.4 }), 0, 0.88, 0);
  parent.add(g);
  return { red: red.material, yel: yel.material, grn: grn.material };
}

function gantry(chuck) {
  const posts = [
    [-1.72, -0.95],
    [1.72, -0.95],
    [-1.72, 0.95],
    [1.72, 0.95],
  ];
  for (const [x, z] of posts) cyl(chuck, 0.045, 0.05, 1.62, STEEL, x, 0.81, z);
  box(chuck, 3.5, 0.07, 0.08, COPPER, 0, 1.6, 0);
  box(chuck, 0.08, 0.07, 2.0, COPPER, -1.72, 1.6, 0);
  box(chuck, 0.08, 0.07, 2.0, COPPER, 1.72, 1.6, 0);
}

function quill(head) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1, 0.055), STEEL);
  mesh.geometry.translate(0, 0.5, 0);
  mesh.castShadow = true;
  head.add(mesh);
  return mesh;
}

function makeHead(kind) {
  const g = new THREE.Group();
  if (kind === "diebank") {
    cyl(g, 0.07, 0.045, 0.2, STEEL, 0, 0.12, 0);
    cyl(g, 0.025, 0.025, 0.07, DARK, 0, 0.01, 0);
    box(g, 0.16, 0.05, 0.16, CERAMIC, 0, 0.22, 0);
  } else if (kind === "bonder" || kind === "wos") {
    box(g, 0.5, 0.14, 0.42, CERAMIC, 0, 0.16, 0);
    box(g, 0.3, 0.05, 0.26, COPPER, 0, 0.06, 0);
    cyl(g, 0.05, 0.05, 0.16, STEEL, 0, 0.28, 0);
    box(g, 0.18, 0.04, 0.04, mat(0x222a30, { roughness: 0.4, metalness: 0.4 }), 0.22, 0.2, 0.16);
  } else if (kind === "ballpack") {
    box(g, 1.02, 0.1, 0.9, STEEL, 0, 0.12, 0);
    box(g, 0.7, 0.04, 0.7, COPPER, 0, 0.04, 0);
    const bump = mat(0xf2d48a, { metalness: 0.8, roughness: 0.2 });
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bump);
        s.position.set(-0.24 + c * 0.16, 0.02, -0.24 + r * 0.16);
        g.add(s);
      }
    }
  }
  const q = quill(g);
  g.userData.quill = q;
  return g;
}

function stagePlate(chuck) {
  box(chuck, 2.7, 0.05, 1.9, DARK, 0, 0.02, 0);
}

export function buildTool(station) {
  const group = new THREE.Group();
  group.position.set(station.place.x, 0, station.place.z);
  group.rotation.y = station.place.face > 0 ? 0 : Math.PI;
  group.userData.toolId = station.tool;

  box(group, 4.7, 0.28, 3.7, DARK, 0, 0.14, 0);
  box(group, 4.4, 0.9, 1.15, BODY, 0, 0.72, -1.15);

  const chuck = new THREE.Group();
  chuck.position.set(0.15, 1.0, 0.35);
  group.add(chuck);
  stagePlate(chuck);

  const load = new THREE.Object3D();
  load.position.set(-1.9, 0.72, 1.25);
  group.add(load);
  box(group, 0.9, 0.08, 0.7, BODY, -1.9, 0.68, 1.25);

  const parts = { head: null, quill: null, spindle: null, spinner: null, blade: null, lamp: null, pusher: null, cards: null };
  const kind = station.kind;

  if (kind === "diebank") {
    gantry(chuck);
    for (let i = 0; i < 4; i++) {
      const y = 0.55 + i * 0.38;
      box(group, 2.3, 0.05, 0.85, DARK, 0.15, y, -1.05);
      box(group, 2.05, 0.08, 0.7, mat(0x3a2e24, { roughness: 0.65, metalness: 0.15 }), 0.15, y + 0.08, -0.95);
      for (let c = 0; c < 6; c++) {
        box(group, 0.14, 0.012, 0.14, mat(0x241c14, { roughness: 0.8, metalness: 0.1 }), -0.7 + c * 0.28, y + 0.13, -0.95);
      }
    }
    cyl(chuck, 0.12, 0.16, 0.1, STEEL, 0.7, 0.9, 0.55);
    cyl(chuck, 0.06, 0.06, 0.12, DARK, 0.7, 0.78, 0.55);
    const head = makeHead("diebank");
    chuck.add(head);
    parts.head = head;
    parts.quill = head.userData.quill;
  } else if (kind === "bonder") {
    gantry(chuck);
    const groove = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.03, 8, 36), COPPER);
    groove.rotation.x = Math.PI / 2;
    groove.position.y = 0.05;
    chuck.add(groove);
    const groove2 = groove.clone();
    groove2.scale.setScalar(0.62);
    chuck.add(groove2);
    cyl(chuck, 0.05, 0.07, 0.28, STEEL, -0.85, 0.7, -0.7);
    cyl(chuck, 0.05, 0.07, 0.28, STEEL, 0.85, 0.7, -0.7);
    const head = makeHead("bonder");
    chuck.add(head);
    parts.head = head;
    parts.quill = head.userData.quill;
    box(group, 0.7, 1.5, 0.55, BODY, 1.85, 1.15, -0.4);
  } else if (kind === "dicer") {
    box(chuck, 2.5, 0.12, 2.2, mat(0x10161c, { roughness: 0.5, metalness: 0.4 }), 0, 0.04, 0);
    box(chuck, 2.55, 0.18, 0.08, STEEL, 0, 0.14, 1.05);
    box(chuck, 2.55, 0.18, 0.08, STEEL, 0, 0.14, -1.05);
    box(chuck, 0.08, 0.18, 2.2, STEEL, 1.24, 0.14, 0);
    box(chuck, 0.08, 0.18, 2.2, STEEL, -1.24, 0.14, 0);
    const rail = box(chuck, 2.6, 0.06, 0.06, COPPER, 0, 1.25, -0.85);
    rail.position.z = -0.85;
    const spindle = new THREE.Group();
    chuck.add(spindle);
    cyl(spindle, 0.16, 0.16, 0.28, BODY, 0, 0.28, 0);
    cyl(spindle, 0.06, 0.06, 0.2, STEEL, 0, 0.1, 0);
    const spinner = new THREE.Group();
    spindle.add(spinner);
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.02, 28),
      mat(0xf4f7f8, { metalness: 0.92, roughness: 0.12, emissive: 0x9eb0c0, emissiveIntensity: 0.35 })
    );
    blade.castShadow = true;
    spinner.add(blade);
    parts.spindle = spindle;
    parts.spinner = spinner;
    parts.blade = blade;
    cyl(chuck, 0.03, 0.03, 0.35, mat(0x7ec8e0, { emissive: 0x1a4a55, emissiveIntensity: 0.3, metalness: 0.4 }), 1.05, 0.4, 0.4);
  } else if (kind === "wos") {
    gantry(chuck);
    const mag = new THREE.Group();
    mag.position.set(-1.85, 0, -0.15);
    box(mag, 0.7, 2.15, 0.62, BODY, 0, 1.2, 0);
    parts.cards = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      box(parts.cards, 0.62, 0.035, 0.5, mat(0xd3925a, { roughness: 0.4, metalness: 0.45 }), 0.08, 0.45 + i * 0.22, 0);
    }
    mag.add(parts.cards);
    group.add(mag);
    const hot = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 28), COPPER);
    hot.position.y = 0.06;
    chuck.add(hot);
    const pusher = new THREE.Group();
    box(pusher, 0.5, 0.06, 0.08, STEEL, 0, 0.18, 0);
    box(pusher, 0.08, 0.1, 0.2, CERAMIC, 0.22, 0.18, 0);
    chuck.add(pusher);
    parts.pusher = pusher;
    const head = makeHead("wos");
    chuck.add(head);
    parts.head = head;
    parts.quill = head.userData.quill;
  } else if (kind === "ballpack") {
    gantry(chuck);
    const head = makeHead("ballpack");
    chuck.add(head);
    parts.head = head;
    parts.quill = head.userData.quill;
    const nest = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 1.05), mat(0x1a2420, { roughness: 0.45, metalness: 0.3 }));
    nest.position.y = 0.05;
    chuck.add(nest);
    const lampMat = mat(0x143028, { emissive: 0x3ee0c0, emissiveIntensity: 0.15, roughness: 0.35 });
    box(chuck, 1.2, 0.04, 0.05, lampMat, 0, 0.1, 0.58);
    box(chuck, 1.2, 0.04, 0.05, lampMat, 0, 0.1, -0.58);
    box(chuck, 0.05, 0.04, 1.15, lampMat, 0.58, 0.1, 0);
    box(chuck, 0.05, 0.04, 1.15, lampMat, -0.58, 0.1, 0);
    parts.lamp = lampMat;
    box(group, 1.5, 0.08, 0.9, DARK, 1.55, 0.5, 0.9);
    box(group, 0.9, 0.16, 0.7, DARK, 1.7, 0.66, 0.9);
  }

  const lights = stackLight(group, 2.05, 0.3, -1.45);
  const window = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.05), GLASS);
  window.position.set(0, 1.15, 1.72);
  group.add(window);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 3.3, 3.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 1.5;
  hit.userData.toolId = station.tool;
  group.add(hit);

  const point = new THREE.PointLight(0x3ee0c0, 0, 7);
  point.position.set(0, 2.2, 0.4);
  group.add(point);

  return { group, chuck, load, hit, parts, lights, point, kind };
}

export function poseTool(built, m, spin) {
  const { parts } = built;
  if (parts.head) {
    parts.head.position.set(m.head.x, m.head.y, m.head.z);
    if (parts.quill) {
      const reach = Math.max(0.08, 1.58 - m.head.y);
      parts.quill.scale.y = reach;
    }
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
  if (parts.lamp) parts.lamp.emissiveIntensity = 0.12 + m.lamp * 1.6;
  if (parts.pusher) parts.pusher.position.x = 1.2 + (0.15 - 1.2) * m.pusher;
  if (parts.cards) parts.cards.position.y = m.pusher * 0.08;
}

const SHELL = {
  foup: mat(0x1c4a46, { roughness: 0.35, metalness: 0.3 }),
  wafer: mat(0xc9d4d8, { roughness: 0.16, metalness: 0.8 }),
  frame: mat(0xd5dbe2, { metalness: 0.75, roughness: 0.28 }),
  tape: mat(0x2a4d8a, { roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.75 }),
  sub: mat(0xd3925a, { roughness: 0.42, metalness: 0.45 }),
  tray: mat(0x14181e, { roughness: 0.55, metalness: 0.25 }),
};

export function carrierShell(type) {
  const g = new THREE.Group();
  if (type === "FOUP") {
    box(g, 0.92, 1.28, 0.12, SHELL.foup, 0, 0.7, -0.36);
    box(g, 0.08, 1.28, 0.78, SHELL.foup, -0.42, 0.7, 0);
    box(g, 0.08, 1.28, 0.78, SHELL.foup, 0.42, 0.7, 0);
    box(g, 0.92, 0.08, 0.78, SHELL.foup, 0, 1.32, 0);
    box(g, 0.92, 0.08, 0.78, DARK, 0, 0.08, 0);
    box(g, 0.28, 0.08, 0.12, COPPER, 0, 1.4, 0.1);
    for (let i = 0; i < 5; i++) {
      const w = cyl(g, 0.28, 0.28, 0.015, SHELL.wafer, 0, 0.28 + i * 0.16, -0.05, 20);
      w.rotation.x = Math.PI / 2;
    }
  } else if (type === "FRAME") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 28), SHELL.frame);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);
    const tape = cyl(g, 0.44, 0.44, 0.02, SHELL.tape, 0, 0.06, 0, 28);
    tape.castShadow = false;
  } else if (type === "MAG") {
    box(g, 0.55, 1.35, 0.4, DARK, 0, 0.7, 0);
    for (let i = 0; i < 6; i++) {
      box(g, 0.48, 0.03, 0.34, SHELL.sub, 0.04, 0.22 + i * 0.18, 0);
    }
  } else {
    box(g, 1.15, 0.06, 0.78, SHELL.tray, 0, 0.06, 0);
    box(g, 1.15, 0.04, 0.04, DARK, 0, 0.1, 0.37);
    box(g, 1.15, 0.04, 0.04, DARK, 0, 0.1, -0.37);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        box(g, 0.22, 0.015, 0.18, mat(0x0c1014, { roughness: 0.6 }), -0.32 + c * 0.32, 0.095, -0.16 + r * 0.32);
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
