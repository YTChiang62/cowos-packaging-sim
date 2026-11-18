/**
 * Perimeter rooms and return-air corridors for the APEX-3D cleanroom.
 * Stylized boxes, not scanned models. Process bays, tools, and the OHT stay
 * in plant.js / route.js. Walk collision for these volumes lives in walk.js.
 */
import * as THREE from "three";
import { FACILITY_ROOMS, RETURN_AIR, ROOM_WALL_T } from "./walk.js";

function material(color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.48,
    metalness: opts.metalness ?? 0.28,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.depthWrite ?? !opts.transparent,
  });
  return mat;
}

function addBox(parent, w, h, d, mat, x, y, z) {
  if (w < 0.04 || h < 0.04 || d < 0.04) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const TAG_FAMILY = "'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC','Microsoft JhengHei',sans-serif";

function fitFont(g, text, maxWidth, start, limit = 210) {
  let px = start;
  const set = (n) => {
    g.font = `700 ${n}px ${TAG_FAMILY}`;
  };
  set(px);
  while (px < limit && g.measureText(text).width < maxWidth * 0.9) {
    px += 4;
    set(px);
  }
  while (px > 26 && g.measureText(text).width > maxWidth) {
    px -= 2;
    set(px);
  }
  return px;
}

/** Horizontal name sitting on a colored floor. Ink and halo follow the theme. */
export function makeFlatTag(text, { plate = false } = {}) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 256;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 3;
  mesh.userData.plate = plate;
  mesh.userData.redraw = (t, ink, halo) => {
    const label = t || "";
    g.clearRect(0, 0, 1024, 256);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const usePlate = mesh.userData.plate;
    const fill = usePlate ? "#f4faf8" : (ink || "#14201c");
    const stroke = usePlate ? "rgba(8,14,16,0.92)" : (halo || "rgba(255,255,255,0.94)");
    const parts = label.split(" / ");
    if (usePlate) {
      g.fillStyle = "rgba(14,22,24,0.88)";
      g.beginPath();
      g.roundRect?.(36, 48, 952, 164, 28);
      if (!g.roundRect) g.rect(36, 48, 952, 164);
      g.fill();
    }
    if (parts.length === 2) {
      const top = fitFont(g, parts[0], 940, 118, 168);
      g.lineWidth = Math.max(8, top * 0.12);
      g.strokeStyle = stroke;
      g.strokeText(parts[0], 512, 92);
      g.fillStyle = fill;
      g.fillText(parts[0], 512, 92);
      const sub = fitFont(g, parts[1], 900, 78, 112);
      g.lineWidth = Math.max(6, sub * 0.12);
      g.strokeStyle = stroke;
      g.strokeText(parts[1], 512, 188);
      g.fillStyle = fill;
      g.fillText(parts[1], 512, 188);
    } else {
      const px = fitFont(g, label, 960, 132, 196);
      g.lineWidth = Math.max(10, px * 0.12);
      g.strokeStyle = stroke;
      g.strokeText(label, 512, 132);
      g.fillStyle = fill;
      g.fillText(label, 512, 132);
    }
    tex.needsUpdate = true;
  };
  mesh.userData.redraw(text, "#14201c", "rgba(255,255,255,0.94)");
  return mesh;
}

/** Upright sign for walk mode and lower orbits. Hidden from the high overview. */
export function makeBillboard(text) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 220;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.center.set(0.5, 0);
  sp.userData.redraw = (t) => {
    const label = t || "";
    g.clearRect(0, 0, 1024, 220);
    g.fillStyle = "rgba(10,18,20,0.88)";
    g.beginPath();
    g.roundRect?.(16, 28, 992, 168, 28);
    if (!g.roundRect) g.rect(16, 28, 992, 168);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    fitFont(g, label, 920, 84, 120);
    g.fillStyle = "#f4faf8";
    g.fillText(label, 512, 112);
    tex.needsUpdate = true;
  };
  sp.userData.redraw(text);
  return sp;
}

function track(tints, key, mat) {
  tints.push({ mat, key });
  return mat;
}

function sideWall(parent, room, side, t, h, wallMat, glassMat, openDoor) {
  const { minX, maxX, minZ, maxZ } = room;
  const width = room.doorWidth || 1.7;
  const hasDoor = room.door === side;
  let x0;
  let x1;
  let z0;
  let z1;
  if (side === "east") {
    x0 = maxX - t;
    x1 = maxX;
    z0 = minZ;
    z1 = maxZ;
  } else if (side === "west") {
    x0 = minX;
    x1 = minX + t;
    z0 = minZ;
    z1 = maxZ;
  } else if (side === "south") {
    x0 = minX;
    x1 = maxX;
    z0 = maxZ - t;
    z1 = maxZ;
  } else {
    x0 = minX;
    x1 = maxX;
    z0 = minZ;
    z1 = minZ + t;
  }
  const vertical = side === "east" || side === "west";
  const add = (xa, xb, za, zb, y0, y1, mat) => {
    addBox(parent, xb - xa, y1 - y0, zb - za, mat, (xa + xb) / 2, (y0 + y1) / 2, (za + zb) / 2);
  };
  if (!hasDoor) {
    add(x0, x1, z0, z1, 0, h, wallMat);
    return;
  }
  const span0 = vertical ? z0 : x0;
  const span1 = vertical ? z1 : x1;
  const mid = (span0 + span1) / 2;
  const a0 = mid - width / 2;
  const a1 = mid + width / 2;
  const header = openDoor ? h - 0.55 : 2.28;
  if (vertical) {
    add(x0, x1, z0, a0, 0, h, wallMat);
    add(x0, x1, a1, z1, 0, h, wallMat);
    add(x0, x1, a0, a1, header, h, wallMat);
    if (!openDoor) add(x0, x1, a0, a1, 0.04, header, glassMat);
    else add(x0, x1, a0, a1, 0, 0.08, wallMat);
  } else {
    add(x0, a0, z0, z1, 0, h, wallMat);
    add(a1, x1, z0, z1, 0, h, wallMat);
    add(a0, a1, z0, z1, header, h, wallMat);
    if (!openDoor) add(a0, a1, z0, z1, 0.04, header, glassMat);
  }
}

function placeTag(parent, tags, key, text, x, z, span) {
  const tag = makeFlatTag(text);
  tag.position.set(x, 0.1, z);
  tag.scale.set(span, span / 4, 1);
  tag.userData.labelKey = key;
  tags.push(tag);
  parent.add(tag);
  return tag;
}

function placeSign(parent, billboards, key, text, x, y, z, w, h) {
  const sign = makeBillboard(text);
  sign.position.set(x, y, z);
  sign.scale.set(w, h, 1);
  sign.userData.labelKey = key;
  billboards.push(sign);
  parent.add(sign);
}

function buildRoom(parent, room, mats, tags, billboards, label) {
  const open = room.kind === "gowning";
  const h = room.kind === "duty" ? 2.85 : room.kind === "gowning" ? 3.05 : 3.2;
  const wallMat = room.kind === "gowning" ? mats.gownWall : room.kind === "duty" ? mats.dutyWall : mats.ahu;
  for (const side of ["north", "south", "east", "west"]) {
    sideWall(parent, room, side, ROOM_WALL_T, h, wallMat, mats.glass, open);
  }
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minZ + room.maxZ) / 2;
  const w = room.maxX - room.minX;
  const d = room.maxZ - room.minZ;
  let span = Math.min(w * 0.9, 11);
  if (span / 4 > d * 0.62) span = d * 0.62 * 4;
  const tag = makeFlatTag(label(room.labelKey), { plate: room.kind === "ahu" });
  const tagY = room.kind === "ahu" ? h + 0.78 : 0.1;
  tag.position.set(cx, tagY, cz);
  tag.scale.set(span, span / 4, 1);
  tag.userData.labelKey = room.labelKey;
  tags.push(tag);
  parent.add(tag);
  const signX = room.door === "west" ? room.minX + 0.3 : room.door === "east" ? room.maxX - 0.3 : cx;
  const signY = room.kind === "ahu" ? 2.05 : h + 0.2;
  placeSign(parent, billboards, room.labelKey, label(room.labelKey), signX, signY, cz, room.kind === "ahu" ? 4.4 : Math.min(span, 5.6), 1.05);

  if (room.kind === "ahu") {
    addBox(parent, w * 0.36, 0.58, d * 0.4, mats.ahuRoof, cx - w * 0.16, h + 0.29, cz - d * 0.06);
    addBox(parent, w * 0.22, 0.42, d * 0.26, mats.ahuRoof, cx + w * 0.2, h + 0.21, cz + d * 0.12);
    const lx = room.door === "west" ? room.minX + 0.22 : room.maxX - 0.22;
    for (let i = 0; i < 4; i++) {
      addBox(parent, 0.1, 0.07, d * 0.42, mats.louver, lx, 1.15 + i * 0.24, cz);
    }
  } else if (room.kind === "gowning") {
    const benchX = room.minX + ROOM_WALL_T + 0.42;
    addBox(parent, 0.78, 0.48, d - 1.9, mats.gownWall, benchX, 0.24, cz);
    addBox(parent, 0.08, 1.35, d - 2.1, mats.louver, benchX, 1.15, cz);
  } else if (room.kind === "duty") {
    addBox(parent, w * 0.42, 0.08, 0.55, mats.dutyWall, cx, 0.78, cz - d * 0.12);
  }
}

function buildReturn(parent, band, mats, tags, billboards, label) {
  const { minX, maxX, minZ, maxZ } = band;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const depth = maxZ - minZ;
  const north = band.id === "return-n";
  const inner = north ? maxZ : minZ;
  const curbZ = north ? inner - 0.2 : inner + 0.2;
  addBox(parent, maxX - minX, 0.72, 0.36, mats.curb, cx, 0.36, curbZ);
  const outer = north ? minZ : maxZ;
  const outerZ = north ? outer + 0.18 : outer - 0.18;
  addBox(parent, maxX - minX, 0.58, 0.3, mats.curb, cx, 0.29, outerZ);

  const gap = 12;
  const slabD = depth * 0.62;
  const leftW = cx - gap - minX;
  const rightW = maxX - (cx + gap);
  if (leftW > 1) addBox(parent, leftW, 0.12, slabD, mats.plenum, minX + leftW / 2, 3.55, cz);
  if (rightW > 1) addBox(parent, rightW, 0.12, slabD, mats.plenum, maxX - rightW / 2, 3.55, cz);
  for (let x = minX + 7; x < maxX - 5; x += 9) {
    if (Math.abs(x - cx) < gap - 1) continue;
    addBox(parent, 0.32, 2.15, depth * 0.48, mats.curb, x, 2.35, cz);
    addBox(parent, 0.7, 0.28, 0.7, mats.louver, x, 3.35, cz);
  }

  const span = Math.min(18, (maxX - minX) * 0.28);
  placeTag(parent, tags, band.labelKey, label(band.labelKey), cx, cz, span);
  placeSign(parent, billboards, band.labelKey, label(band.labelKey), cx, 1.55, cz, 8.4, 1.6);
}

/**
 * Build the facility shell and return theme targets plus nameplates.
 * `label` maps an i18n key to the current language.
 */
export function buildFacilityShell(scene, label) {
  const tints = [];
  const tags = [];
  const billboards = [];
  const mats = {
    ahu: track(tints, "ahu", material(0x8b9c96, { roughness: 0.55, metalness: 0.22 })),
    ahuRoof: track(tints, "ahuRoof", material(0x667872, { roughness: 0.4, metalness: 0.48 })),
    louver: track(tints, "louver", material(0xc4894a, { roughness: 0.35, metalness: 0.5 })),
    gownWall: track(tints, "gownWall", material(0x6f9484, { roughness: 0.5, metalness: 0.12 })),
    dutyWall: track(tints, "dutyWall", material(0xb09774, { roughness: 0.52, metalness: 0.16 })),
    curb: track(tints, "curb", material(0x4e686e, { roughness: 0.62, metalness: 0.18 })),
    plenum: track(tints, "plenum", material(0xd5e6ea, { transparent: true, opacity: 0.4, roughness: 0.18, metalness: 0.06 })),
    glass: track(tints, "glass", material(0xd5ebe4, { transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0.08 })),
  };
  const root = new THREE.Group();
  root.name = "facility-shell";
  scene.add(root);
  const text = typeof label === "function" ? label : (key) => key;
  for (const room of FACILITY_ROOMS) buildRoom(root, room, mats, tags, billboards, text);
  for (const band of RETURN_AIR) buildReturn(root, band, mats, tags, billboards, text);
  return { root, tints, tags, billboards };
}
