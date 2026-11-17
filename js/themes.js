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
  swatch: "#d7e2e8",
  clear: 0xd7e2e8,
  fog: 0xd7e2e8,
  fogNear: 168,
  fogFar: 340,
  exposure: 1.0,
  hemi: { sky: 0xf7fbfc, ground: 0xc5ced3, intensity: 1.38 },
  sun: { color: 0xfff7ee, intensity: 0.98 },
  fill: { color: 0xc5dde6, intensity: 0.74 },
  rim: { color: 0xeaf3f6, intensity: 0.4 },
  stocker: { color: 0xf6d7b0, intensity: 8, distance: 18 },
  work: { color: 0xfff6ea, intensity: 1.05, distance: 7 },
  floor: {
    base: "#e7eef2",
    speckle: "rgba(62,84,94,0.26)",
    seam: "rgba(70,92,102,0.2)",
    bayFill: "rgba(110,140,150,0.18)",
    aisle: "rgba(42,62,72,0.62)",
    bayAlpha: 0.95,
    bayLine: 6,
    aisleWidth: 7,
    roughness: 0.88,
    metalness: 0.05,
  },
  skirt: 0xd0d8dc,
  wall: { color: 0x8eabba, opacity: 0.28 },
  bayGlass: { color: 0x9fd0cc, opacity: 0.2 },
  bayFrame: 0x8d6a42,
  bays: {
    incoming: 0xe6d6c4,
    cow: 0xd4ebe6,
    dice: 0xd9def0,
    wos: 0xf0e0cc,
    pack: 0xe7e0d4,
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
 * Paint the floor canvas. Layout (bay rectangles, aisle) stays with the plant;
 * only the colors come from the palette.
 */
export function paintFloor(g, size, palette, bays, accents) {
  const floor = palette.floor;
  const s = size;
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
    g.bezierCurveTo(400, y + 20, 900, y - 18, 2000, y + 8);
    g.stroke();
  }
  const toPx = (m, origin, span, sizePx) => ((m - origin) / span) * sizePx;
  const worldW = 100;
  const worldD = 80;
  const ox = -50;
  const oz = -40;
  for (const bay of bays) {
    const x = toPx(bay.x - bay.w / 2, ox, worldW, s);
    const z = toPx(bay.z - bay.d / 2, oz, worldD, s);
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
  g.strokeStyle = floor.aisle;
  g.setLineDash([16, 14]);
  g.lineWidth = floor.aisleWidth;
  const aisleZ = toPx(0, oz, worldD, s);
  g.beginPath();
  g.moveTo(toPx(-46, ox, worldW, s), aisleZ);
  g.lineTo(toPx(42, ox, worldW, s), aisleZ);
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
