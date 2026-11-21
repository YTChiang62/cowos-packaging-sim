/**
 * Movable, hideable HUD. State is plain data so tests can persist it
 * without a browser. Dragging is bound to panel chrome, never the canvas.
 */

export const HUD_STORAGE_KEY = "apex3d-hud";

export const HUD_PRESET_IDS = ["overview", "follow", "walk"];

export const HUD_PANELS = [
  { id: "lot-dock", labelKey: "hudLot", large: true, defaultHidden: true },
  { id: "facility-dock", labelKey: "hudFacility", large: true, defaultHidden: true },
  { id: "kpi-card", labelKey: "hudKpi", large: true, defaultHidden: false },
  { id: "ops-card", labelKey: "hudOps", large: true, defaultHidden: false },
  { id: "ops-layers", labelKey: "hudLayers", large: true, defaultHidden: false },
  { id: "tool-dock", labelKey: "hudTool", large: true, defaultHidden: false },
  { id: "stage-rail", labelKey: "hudRail", large: true, defaultHidden: false },
  { id: "preset-dock", labelKey: "hudPreset", large: false, defaultHidden: false },
  { id: "theme-dock", labelKey: "hudTheme", large: false, defaultHidden: false },
  { id: "cam-dock", labelKey: "hudCam", large: false, defaultHidden: false },
  { id: "mes-beats", labelKey: "hudBeats", large: false, defaultHidden: false },
  { id: "radio-dock", labelKey: "hudRadio", large: false, defaultHidden: false },
];

/**
 * Visibility each preset writes. true means hidden.
 * Overview keeps the v10 tucked lot and warehouse docks and shows the shift
 * card, the bottleneck card, and the factory-layer toggles.
 * Follow opens the lot dock and the tool dock and keeps a compact ops/KPI view.
 * Walk tucks the large docks and does not itself enter walk mode.
 */
const PRESET_HIDDEN = {
  overview: {
    "lot-dock": true,
    "facility-dock": true,
    "kpi-card": false,
    "ops-card": false,
    "ops-layers": false,
    "tool-dock": false,
    "stage-rail": false,
  },
  follow: {
    "lot-dock": false,
    "facility-dock": true,
    "kpi-card": false,
    "ops-card": false,
    "ops-layers": true,
    "tool-dock": false,
    "stage-rail": false,
  },
  walk: {
    "lot-dock": true,
    "facility-dock": true,
    "kpi-card": true,
    "ops-card": true,
    "ops-layers": true,
    "tool-dock": true,
    "stage-rail": true,
  },
};

/** Camera the preset asks for. "keep" must not enter or exit walk. */
export function presetCamera(preset) {
  if (preset === "overview") return "overview";
  if (preset === "follow") return "lot";
  return "keep";
}

const PANEL_IDS = new Set(HUD_PANELS.map((panel) => panel.id));

function blankPanel(hidden) {
  return { hidden: !!hidden, x: null, y: null };
}

export function defaultHudState() {
  const panels = {};
  for (const panel of HUD_PANELS) panels[panel.id] = blankPanel(panel.defaultHidden);
  return { focus: false, beforeFocus: null, preset: "overview", panels };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function normalizeHudState(raw) {
  const base = defaultHudState();
  if (!raw || typeof raw !== "object") return base;
  base.focus = raw.focus === true;
  base.preset = HUD_PRESET_IDS.includes(raw.preset) ? raw.preset : "overview";
  if (raw.beforeFocus && typeof raw.beforeFocus === "object") {
    base.beforeFocus = {};
    for (const id of PANEL_IDS) {
      if (typeof raw.beforeFocus[id] === "boolean") base.beforeFocus[id] = raw.beforeFocus[id];
    }
  }
  const panels = raw.panels || {};
  for (const panel of HUD_PANELS) {
    const saved = panels[panel.id];
    if (!saved || typeof saved !== "object") continue;
    base.panels[panel.id] = {
      hidden: saved.hidden === true,
      x: Number.isFinite(saved.x) ? saved.x : null,
      y: Number.isFinite(saved.y) ? saved.y : null,
    };
  }
  return base;
}

export function readHud(storage) {
  if (!storage || typeof storage.getItem !== "function") return defaultHudState();
  try {
    const raw = storage.getItem(HUD_STORAGE_KEY);
    if (!raw) return defaultHudState();
    return normalizeHudState(JSON.parse(raw));
  } catch {
    return defaultHudState();
  }
}

export function writeHud(state, storage) {
  const next = normalizeHudState(state);
  if (storage && typeof storage.setItem === "function") {
    try {
      storage.setItem(HUD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }
  return next;
}

export function hidePanel(state, id) {
  const next = cloneState(normalizeHudState(state));
  if (!PANEL_IDS.has(id)) return next;
  next.panels[id].hidden = true;
  return next;
}

export function showPanel(state, id) {
  const next = cloneState(normalizeHudState(state));
  if (!PANEL_IDS.has(id)) return next;
  next.panels[id].hidden = false;
  return next;
}

export function movePanel(state, id, x, y) {
  const next = cloneState(normalizeHudState(state));
  if (!PANEL_IDS.has(id)) return next;
  next.panels[id].x = Math.round(x);
  next.panels[id].y = Math.round(y);
  return next;
}

export function applyPreset(state, preset) {
  const next = cloneState(normalizeHudState(state));
  if (!HUD_PRESET_IDS.includes(preset)) return next;
  next.preset = preset;
  next.focus = false;
  next.beforeFocus = null;
  const spec = PRESET_HIDDEN[preset];
  for (const [id, hidden] of Object.entries(spec)) {
    if (!next.panels[id]) continue;
    next.panels[id].hidden = hidden;
  }
  return next;
}

export function toggleFocus(state) {
  const next = cloneState(normalizeHudState(state));
  if (next.focus) {
    next.focus = false;
    const before = next.beforeFocus || {};
    for (const panel of HUD_PANELS) {
      if (!panel.large) continue;
      next.panels[panel.id].hidden = before[panel.id] === true;
    }
    next.beforeFocus = null;
    return next;
  }
  next.focus = true;
  next.beforeFocus = {};
  for (const panel of HUD_PANELS) {
    if (!panel.large) continue;
    next.beforeFocus[panel.id] = next.panels[panel.id].hidden === true;
    next.panels[panel.id].hidden = true;
  }
  return next;
}

export function dragStartsOnChrome(target) {
  if (!target) return false;
  if (target.id === "view" || target.nodeName === "CANVAS") return false;
  if (typeof target.closest !== "function") return target.hudChrome === true;
  return !!target.closest(".hud-grip, .hud-hide, .hud-focus, .hud-peek");
}

export function bindHud(doc, storage, label) {
  let state = readHud(storage);
  const root = doc;
  const strip = root.getElementById("hud-strip");

  function text(key) {
    return label ? label(key) : key;
  }

  function paint() {
    for (const panel of HUD_PANELS) {
      const el = root.getElementById(panel.id);
      if (!el) continue;
      const saved = state.panels[panel.id];
      el.classList.toggle("is-hud-hidden", saved.hidden);
      if (saved.x == null || saved.y == null) {
        el.style.left = "";
        el.style.top = "";
        el.style.right = "";
        el.style.bottom = "";
        el.classList.remove("is-hud-moved");
      } else {
        el.style.left = `${saved.x}px`;
        el.style.top = `${saved.y}px`;
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.classList.add("is-hud-moved");
      }
      const hideBtn = el.querySelector(".hud-hide");
      if (hideBtn) hideBtn.textContent = text("hudHide");
      const grip = el.querySelector(".hud-grip");
      if (grip) grip.textContent = text(panel.labelKey);
    }
    if (!strip) return;
    strip.replaceChildren();
    const focus = root.createElement("button");
    focus.type = "button";
    focus.className = "hud-focus";
    focus.dataset.focus = "1";
    focus.textContent = text(state.focus ? "hudRestore" : "hudFocus");
    focus.addEventListener("click", () => {
      state = toggleFocus(state);
      state = writeHud(state, storage);
      paint();
    });
    strip.append(focus);
    for (const panel of HUD_PANELS) {
      if (!state.panels[panel.id].hidden) continue;
      const peek = root.createElement("button");
      peek.type = "button";
      peek.className = "hud-peek";
      peek.dataset.hud = panel.id;
      peek.textContent = text(panel.labelKey);
      peek.addEventListener("click", () => {
        state = showPanel(state, panel.id);
        if (panel.id === "tool-dock") root.getElementById(panel.id)?.classList.add("is-on");
        state = writeHud(state, storage);
        paint();
      });
      strip.append(peek);
    }
  }

  function ensureChrome(panel) {
    const el = root.getElementById(panel.id);
    if (!el || el.querySelector(".hud-chrome")) return;
    el.classList.add("hud-panel");
    const bar = root.createElement("div");
    bar.className = "hud-chrome";
    const grip = root.createElement("span");
    grip.className = "hud-grip";
    grip.textContent = text(panel.labelKey);
    const hide = root.createElement("button");
    hide.type = "button";
    hide.className = "hud-hide";
    hide.textContent = text("hudHide");
    hide.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state = hidePanel(state, panel.id);
      state = writeHud(state, storage);
      paint();
    });
    grip.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - rect.left;
      const dy = event.clientY - rect.top;
      el.classList.add("is-dragging");
      const move = (ev) => {
        const x = Math.max(8, Math.min((root.defaultView?.innerWidth || 1200) - 80, ev.clientX - dx));
        const y = Math.max(8, Math.min((root.defaultView?.innerHeight || 800) - 48, ev.clientY - dy));
        state = movePanel(state, panel.id, x, y);
        paint();
      };
      const up = () => {
        el.classList.remove("is-dragging");
        root.defaultView?.removeEventListener("pointermove", move);
        root.defaultView?.removeEventListener("pointerup", up);
        state = writeHud(state, storage);
      };
      root.defaultView?.addEventListener("pointermove", move);
      root.defaultView?.addEventListener("pointerup", up);
    });
    bar.append(grip, hide);
    el.prepend(bar);
  }

  for (const panel of HUD_PANELS) ensureChrome(panel);
  paint();

  return {
    get state() {
      return state;
    },
    refresh() {
      paint();
    },
    hide(id) {
      state = writeHud(hidePanel(state, id), storage);
      paint();
    },
    show(id) {
      state = writeHud(showPanel(state, id), storage);
      paint();
    },
    usePreset(id) {
      state = writeHud(applyPreset(state, id), storage);
      paint();
      return state;
    },
  };
}
