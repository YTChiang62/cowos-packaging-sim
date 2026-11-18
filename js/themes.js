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
    bayAlpha: 0.7,
    bayLine: 4,
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
    bayAlpha: 0.9,
    bayLine: 5,
    aisleWidth: 6,
    roughness: 0.84,
    metalness: 0.1,
  },
  skirt: 0x8e989e,
  wall: { color: 0x7f96a0, opacity: 0.16 },
  bayGlass: { color: 0x8ec8c4, opacity: 0.14 },
  bayFrame: 0xa78458,
  bays: {
    incoming: 0xb7a48e,
    cow: 0x9fb8b4,
    dice: 0xa9adc2,
    wos: 0xc2b29a,
    pack: 0xb8afa2,
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
    bayLine: 8,
    aisleWidth: 12,
    roughness: 0.9,
    metalness: 0.03,
  },
  skirt: 0xe7eae6,
  wall: { color: 0xd7e0db, opacity: 0.16 },
  bayGlass: { color: 0xd5ebe4, opacity: 0.12 },
  bayFrame: 0x8a6840,
  bays: {
    incoming: 0xe7c8a2,
    cow: 0xb7ddd2,
    dice: 0xc5cef0,
    wos: 0xeccfa6,
    pack: 0xddd3c2,
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
  for (const bay of bays) {
    const x = toPx(bay.x - bay.w / 2, minX, worldW);
    const z = toPx(bay.z - bay.d / 2, minZ, worldD);
    const w = (bay.w / worldW) * s;
    const d = (bay.d / worldD) * s;
    const accent = accents[bay.id];
    const col = typeof accent === "number"
      ? "#" + accent.toString(16).padStart(6, "0")
      : accent;
    g.fillStyle = floor.bayFill;
    g.fillRect(x, z, w, d);
    g.strokeStyle = col;
    g.globalAlpha = floor.bayAlpha;
    g.lineWidth = floor.bayLine;
    g.strokeRect(x + 6, z + 6, w - 12, d - 12);
    g.globalAlpha = 1;
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
  return palette;
}
