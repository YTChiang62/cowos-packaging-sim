/**
 * Scene palettes for the APEX-3D trainer.
 * Hex values for the 3D view live here. plant.js applies them; it does not
 * invent its own clear color, fog, floor, or key light.
 * The process contract (route, recipes, tool positions) is not touched.
 */

export const THEME_IDS = ["light", "neutral", "dark"];
export const DEFAULT_THEME = "light";
export const THEME_STORAGE_KEY = "apex3d-theme";

const LABEL = {
  fill: "rgba(6,14,18,0.92)",
  title: "#f4faf8",
  sub: "#d5e2e4",
};

/** v5 dark scene, kept as an explicit option. */
const DARK = {
  id: "dark",
  swatch: "#071016",
  clear: 0x071016,
  fog: 0x071016,
  fogNear: 140,
  fogFar: 280,
  exposure: 1.32,
  hemi: { sky: 0xd5eef2, ground: 0x24180e, intensity: 1.25 },
  sun: { color: 0xf2e6d0, intensity: 1.35 },
  fill: { color: 0x4aa89c, intensity: 0.35 },
  rim: { color: 0x9fd4ff, intensity: 0.22 },
  stocker: { color: 0xf0c08a, intensity: 14, distance: 18 },
  work: { color: 0xfff4e4, intensity: 1.8, distance: 7 },
  floor: {
    base: "#1c2e34",
    speckle: "rgba(211,146,90,0.16)",
    seam: "rgba(211,146,90,0.28)",
    bayFill: "rgba(80,120,120,0.10)",
    aisle: "rgba(211,146,90,0.35)",
    bayAlpha: 1,
    bayLine: 10,
    parkInk: "#f4faf8",
    parkHalo: "rgba(6,14,18,0.9)",
    aisleWidth: 5,
    roughness: 0.82,
    metalness: 0.18,
  },
  skirt: 0x141c20,
  wall: { color: 0x6ec8c0, opacity: 0.07 },
  bayGlass: { color: 0x7fdad0, opacity: 0.09 },
  bayFrame: 0xb8874e,
  bays: {
    incoming: 0x3a2a1c,
    cow: 0x102824,
    dice: 0x1a1a30,
    wos: 0x2a2214,
    pack: 0x262018,
  },
  parkEdge: {
    incoming: 0xe0a56a,
    cow: 0x5ee0c8,
    dice: 0x9aafff,
    wos: 0xf0c080,
    pack: 0xf0c2b0,
  },
  facility: {
    returnFloor: 0x2c4550,
    returnHatch: "rgba(190,220,220,0.16)",
    ahuFloor: 0x24343a,
    gownFloor: 0x1e3532,
    dutyFloor: 0x3a3024,
    line: 0x8eb8b4,
    ahu: 0x314248,
    ahuRoof: 0x24383e,
    louver: 0xc4894a,
    gownWall: 0x3d5c54,
    dutyWall: 0x6a5438,
    curb: 0x3d5c64,
    plenum: 0x1a3036,
    glass: 0x7fdad0,
  },
  label: LABEL,
};

const NEUTRAL = {
  id: "neutral",
  swatch: "#a7b2b8",
  clear: 0xa7b2b8,
  fog: 0xa7b2b8,
  fogNear: 150,
  fogFar: 310,
  exposure: 1.12,
  hemi: { sky: 0xd7e1e6, ground: 0x6e675c, intensity: 1.32 },
  sun: { color: 0xf3e7d6, intensity: 1.18 },
  fill: { color: 0x8eacb6, intensity: 0.52 },
  rim: { color: 0xd5e3ea, intensity: 0.3 },
  stocker: { color: 0xf0c08a, intensity: 11, distance: 18 },
  work: { color: 0xfff3e4, intensity: 1.35, distance: 7 },
  floor: {
    base: "#c5ced3",
    speckle: "rgba(55,68,74,0.22)",
    seam: "rgba(48,60,66,0.26)",
    bayFill: "rgba(70,92,98,0.16)",
    aisle: "rgba(36,48,54,0.55)",
    bayAlpha: 1,
    bayLine: 12,
    parkInk: "#141c20",
    parkHalo: "rgba(255,255,255,0.84)",
    aisleWidth: 6,
    roughness: 0.84,
    metalness: 0.1,
  },
  skirt: 0x8e989e,
  wall: { color: 0x7f96a0, opacity: 0.16 },
  bayGlass: { color: 0x8ec8c4, opacity: 0.14 },
  bayFrame: 0xa78458,
  bays: {
    incoming: 0xc48a5c,
    cow: 0x6a9e96,
    dice: 0x848cb8,
    wos: 0xc6aa68,
    pack: 0xc48a86,
  },
  parkEdge: {
    incoming: 0x5c3a22,
    cow: 0x1c403c,
    dice: 0x2a3058,
    wos: 0x5a4418,
    pack: 0x5a3030,
  },
  facility: {
    returnFloor: 0x8fa3a8,
    returnHatch: "rgba(28,40,46,0.22)",
    ahuFloor: 0x7d8e8a,
    gownFloor: 0xa3c0b4,
    dutyFloor: 0xc4b496,
    line: 0x243034,
    ahu: 0x6e7e82,
    ahuRoof: 0x556468,
    louver: 0xb88848,
    gownWall: 0x5c7870,
    dutyWall: 0x8a7458,
    curb: 0x5c6c72,
    plenum: 0xc5d0d4,
    glass: 0xc5ddd8,
  },
  label: LABEL,
};

const LIGHT = {
  id: "light",
  swatch: "#f7f8f6",
  clear: 0xf7f8f6,
  fog: 0xf6f7f5,
  fogNear: 260,
  fogFar: 520,
  exposure: 1.34,
  hemi: { sky: 0xfffdf8, ground: 0xe8e6de, intensity: 1.7 },
  sun: { color: 0xfff6ea, intensity: 1.46 },
  fill: { color: 0xf4f6f5, intensity: 0.42 },
  rim: { color: 0xffffff, intensity: 0.26 },
  stocker: { color: 0xffe6c4, intensity: 10, distance: 22 },
  work: { color: 0xfff6ea, intensity: 0.7, distance: 8 },
  floor: {
    base: "#f7f8f6",
    speckle: "rgba(90,98,94,0.1)",
    seam: "rgba(120,128,122,0.12)",
    bayFill: "rgba(70,96,90,0.05)",
    aisle: "rgba(36,52,58,0.72)",
    aisleBand: "rgba(64,84,88,0.075)",
    aisleEdge: "rgba(42,62,68,0.45)",
    loop: "rgba(150,116,68,0.55)",
    loopWidth: 14,
    boundary: "rgba(110,122,116,0.55)",
    bayAlpha: 1,
    bayLine: 16,
    parkInk: "#14201c",
    parkHalo: "rgba(255,255,255,0.94)",
    aisleWidth: 12,
    roughness: 0.9,
    metalness: 0.03,
  },
  skirt: 0xe7eae6,
  wall: { color: 0xd7e0db, opacity: 0.16 },
  bayGlass: { color: 0xd5ebe4, opacity: 0.12 },
  bayFrame: 0x8a6840,
  bays: {
    incoming: 0xe08a3c,
    cow: 0x2ea898,
    dice: 0x6d84d6,
    wos: 0xe2b03a,
    pack: 0xd46562,
  },
  parkEdge: {
    incoming: 0x6a320e,
    cow: 0x0c4e46,
    dice: 0x24306e,
    wos: 0x6a4a08,
    pack: 0x6a2828,
  },
  facility: {
    returnFloor: 0x9bb4b8,
    returnHatch: "rgba(28,58,66,0.28)",
    ahuFloor: 0x8f9f98,
    gownFloor: 0xc9e0d4,
    dutyFloor: 0xe4d3b4,
    line: 0x2f4a4e,
    ahu: 0x8b9c96,
    ahuRoof: 0x667872,
    louver: 0xc4894a,
    gownWall: 0x6f9484,
    dutyWall: 0xb09774,
    curb: 0x4e686e,
    plenum: 0xd5e6ea,
    glass: 0xd5ebe4,
  },
  label: LABEL,
};

export const THEMES = {
  light: LIGHT,
  neutral: NEUTRAL,
  dark: DARK,
};

export function isThemeId(id) {
  return THEME_IDS.includes(id);
}

export function paletteOf(id) {
  return THEMES[isThemeId(id) ? id : DEFAULT_THEME];
}

export function readThemeId(storage) {
  if (!storage || typeof storage.getItem !== "function") return DEFAULT_THEME;
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeThemeId(id, storage) {
  const next = isThemeId(id) ? id : DEFAULT_THEME;
  if (storage && typeof storage.setItem === "function") {
    try {
      storage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode and the acceptance fake can both refuse a write */
    }
  }
  return next;
}

function paintColor(color, hex) {
  if (color && typeof color.setHex === "function") color.setHex(hex);
}

function cssColor(value) {
  if (typeof value === "string") return value;
  return "#" + (value >>> 0).toString(16).padStart(6, "0").slice(-6);
}

function worldRect(rect, toPx, minX, worldW, minZ, worldD) {
  const x = toPx(rect.minX, minX, worldW);
  const z = toPx(rect.minZ, minZ, worldD);
  const w = toPx(rect.maxX, minX, worldW) - x;
  const d = toPx(rect.maxZ, minZ, worldD) - z;
  return { x, z, w, d };
}

function fillZone(g, rect, fill, line, toPx, minX, worldW, minZ, worldD) {
  const box = worldRect(rect, toPx, minX, worldW, minZ, worldD);
  g.fillStyle = cssColor(fill);
  g.fillRect(box.x, box.z, box.w, box.d);
  if (line != null) {
    g.strokeStyle = cssColor(line);
    g.lineWidth = 8;
    g.strokeRect(box.x + 4, box.z + 4, Math.max(1, box.w - 8), Math.max(1, box.d - 8));
  }
  return box;
}

/**
 * Paint the floor canvas. Bay rectangles and the aisle spine stay with the plant;
 * colors come from the palette. `layout.floor` is the world XZ of the slab
 * (canvas top is north / min Z, matching the rotated floor plane).
 */
export function paintFloor(g, size, palette, bays, accents, layout) {
  const floor = palette.floor;
  const s = size;
  const bounds = layout?.floor || { minX: -50, maxX: 50, minZ: -40, maxZ: 40 };
  const minX = bounds.minX;
  const maxX = bounds.maxX;
  const minZ = bounds.minZ;
  const maxZ = bounds.maxZ;
  const worldW = maxX - minX;
  const worldD = maxZ - minZ;
  const toPx = (m, origin, span) => ((m - origin) / span) * s;
  g.fillStyle = floor.base;
  g.fillRect(0, 0, s, s);
  g.fillStyle = floor.speckle;
  for (let y = 40; y < s; y += 18) {
    for (let x = 40; x < s; x += 18) {
      g.beginPath();
      g.arc(x + ((y / 18) % 2) * 4, y, 1.3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = floor.seam;
  g.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    const y = 80 + i * 68;
    g.beginPath();
    g.moveTo(40, y);
    g.bezierCurveTo(400, y + 20, 900, y - 18, s - 40, y + 8);
    g.stroke();
  }
  const facility = palette.facility;
  if (facility && layout?.returns) {
    for (const band of layout.returns) {
      const box = fillZone(g, band, facility.returnFloor, facility.line, toPx, minX, worldW, minZ, worldD);
      g.save();
      g.beginPath();
      g.rect(box.x, box.z, box.w, box.d);
      g.clip();
      g.strokeStyle = facility.returnHatch;
      g.lineWidth = 2;
      const step = 22;
      for (let i = -box.d; i < box.w + box.d; i += step) {
        g.beginPath();
        g.moveTo(box.x + i, box.z);
        g.lineTo(box.x + i + box.d * 0.6, box.z + box.d);
        g.stroke();
      }
      g.restore();
    }
  }
  if (facility && layout?.rooms) {
    for (const room of layout.rooms) {
      const fill = room.kind === "gowning"
        ? facility.gownFloor
        : room.kind === "duty"
          ? facility.dutyFloor
          : facility.ahuFloor;
      fillZone(g, room, fill, facility.line, toPx, minX, worldW, minZ, worldD);
    }
  }
  for (const bay of bays) {
    const x = toPx(bay.x - bay.w / 2, minX, worldW);
    const z = toPx(bay.z - bay.d / 2, minZ, worldD);
    const w = (bay.w / worldW) * s;
    const d = (bay.d / worldD) * s;
    const accent = accents[bay.id];
    const col = typeof accent === "number"
      ? "#" + accent.toString(16).padStart(6, "0")
      : accent;
    const fill = palette.bays?.[bay.id];
    g.fillStyle = fill != null ? cssColor(fill) : floor.bayFill;
    g.globalAlpha = floor.parkAlpha ?? 1;
    g.fillRect(x, z, w, d);
    g.globalAlpha = floor.bayAlpha ?? 1;
    g.strokeStyle = cssColor(palette.parkEdge?.[bay.id] ?? col);
    g.lineWidth = floor.bayLine;
    const inset = g.lineWidth;
    g.strokeRect(x + inset * 0.5, z + inset * 0.5, Math.max(1, w - inset), Math.max(1, d - inset));
    g.globalAlpha = 1;
  }
  if (floor.boundary && layout?.walls) {
    const { north, south, west, east } = layout.walls;
    const x = toPx(west, minX, worldW);
    const z = toPx(north, minZ, worldD);
    const w = toPx(east, minX, worldW) - x;
    const d = toPx(south, minZ, worldD) - z;
    g.strokeStyle = floor.boundary;
    g.lineWidth = 12;
    g.strokeRect(x, z, w, d);
  }
  const aisleX0 = toPx(-46, minX, worldW);
  const aisleX1 = toPx(42, minX, worldW);
  const aisleZ = toPx(0, minZ, worldD);
  if (floor.aisleBand) {
    const z0 = toPx(-3.2, minZ, worldD);
    const z1 = toPx(3.2, minZ, worldD);
    g.fillStyle = floor.aisleBand;
    g.fillRect(aisleX0, Math.min(z0, z1), aisleX1 - aisleX0, Math.abs(z1 - z0));
    if (floor.aisleEdge) {
      g.strokeStyle = floor.aisleEdge;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(aisleX0, z0);
      g.lineTo(aisleX1, z0);
      g.moveTo(aisleX0, z1);
      g.lineTo(aisleX1, z1);
      g.stroke();
    }
  }
  if (floor.loop && layout?.loop) {
    g.strokeStyle = floor.loop;
    g.lineWidth = floor.loopWidth || 8;
    g.setLineDash([18, 14]);
    g.beginPath();
    layout.loop.forEach((node, i) => {
      const x = toPx(node.x, minX, worldW);
      const z = toPx(node.z, minZ, worldD);
      if (i === 0) g.moveTo(x, z);
      else g.lineTo(x, z);
    });
    g.closePath();
    g.stroke();
    g.setLineDash([]);
  }
  g.strokeStyle = floor.aisle;
  g.setLineDash([16, 14]);
  g.lineWidth = floor.aisleWidth;
  g.beginPath();
  g.moveTo(aisleX0, aisleZ);
  g.lineTo(aisleX1, aisleZ);
  g.stroke();
  g.setLineDash([]);
}

function markDocument(plant, themeId) {
  const root = plant.themeRoot || (typeof document !== "undefined" ? document.body : null);
  if (!root?.classList) return;
  for (const id of THEME_IDS) root.classList.remove(`theme-${id}`);
  root.classList.add(`theme-${themeId}`);
}

/**
 * Apply a curated palette. A stub plant only needs `themeId` / `palette`.
 * A live plant also updates clear color, fog, lights, floor, walls, and bays.
 * Tool groups are not rebuilt and their positions are not written.
 */
export function applyTheme(plant, id, storage) {
  const themeId = writeThemeId(id, storage);
  const palette = THEMES[themeId];
  plant.themeId = themeId;
  plant.palette = palette;

  if (plant.renderer) {
    plant.renderer.setClearColor?.(palette.clear, 1);
    plant.renderer.toneMappingExposure = palette.exposure;
  }
  const fog = plant.scene?.fog;
  if (fog) {
    paintColor(fog.color, palette.fog);
    fog.near = palette.fogNear;
    fog.far = palette.fogFar;
  }
  const lights = plant.lights;
  if (lights?.hemi) {
    paintColor(lights.hemi.color, palette.hemi.sky);
    paintColor(lights.hemi.groundColor, palette.hemi.ground);
    lights.hemi.intensity = palette.hemi.intensity;
  }
  if (lights?.sun) {
    paintColor(lights.sun.color, palette.sun.color);
    lights.sun.intensity = palette.sun.intensity;
  }
  if (lights?.fill) {
    paintColor(lights.fill.color, palette.fill.color);
    lights.fill.intensity = palette.fill.intensity;
  }
  if (lights?.rim) {
    paintColor(lights.rim.color, palette.rim.color);
    lights.rim.intensity = palette.rim.intensity;
  }
  if (lights?.stocker) {
    paintColor(lights.stocker.color, palette.stocker.color);
    lights.stocker.intensity = palette.stocker.intensity;
    if (palette.stocker.distance) lights.stocker.distance = palette.stocker.distance;
  }

  plant.repaintFloor?.(palette);

  paintColor(plant.skirt?.material?.color, palette.skirt);
  if (plant.wallMat) {
    paintColor(plant.wallMat.color, palette.wall.color);
    plant.wallMat.opacity = palette.wall.opacity;
  }
  if (plant.bayGlass) {
    paintColor(plant.bayGlass.color, palette.bayGlass.color);
    plant.bayGlass.opacity = palette.bayGlass.opacity;
  }
  paintColor(plant.bayFrame?.color, palette.bayFrame);
  if (plant.tints && palette.facility) {
    for (const entry of plant.tints) {
      const hex = palette.facility[entry.key];
      if (typeof hex === "number") paintColor(entry.mat?.color, hex);
    }
  }
  if (plant.bayPlinths) {
    for (const entry of plant.bayPlinths) {
      const hex = palette.bays[entry.id];
      if (hex != null) paintColor(entry.material.color, hex);
    }
  }

  if (plant.tools?.values) {
    for (const rec of plant.tools.values()) {
      if (rec.workLight && palette.work) {
        paintColor(rec.workLight.color, palette.work.color);
        rec.workLight.intensity = palette.work.intensity;
        if (palette.work.distance) rec.workLight.distance = palette.work.distance;
      }
      rec.label?.userData?.setPlate?.(palette.label);
    }
  }

  markDocument(plant, themeId);
  plant.refreshPlaceTags?.();
  return palette;
}
