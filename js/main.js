import { bindHud } from "./hud.js";
import { LANGS, t, applyStaticI18n } from "./i18n.js";
import { THEME_IDS, applyTheme, paletteOf } from "./themes.js";
import { Session, STEPS } from "./mes.js";
import { Plant } from "./plant.js";
import { STATIONS } from "./route.js";
import {
  bindUI, renderAll, renderCatalog, renderFacility, renderOps, showTool, hideTool, showToast, showRadio, showDone,
} from "./ui.js";
import { buildOpsSnapshot, opsInputFromSession, readLayers, writeLayers } from "./ops.js";

const canvas = document.getElementById("view");
const els = bindUI();

const state = {
  lang: "zh-TW",
  intensity: "few",
  startRole: "MFG",
  productId: null,
  briefing: false,
  session: null,
  selectedTool: null,
};

const plant = new Plant(canvas);
plant.setTranslator((k, vars) => t(state.lang, k, vars || {}), state.lang);
plant.focusOverview();

applyStaticI18n(state.lang);
els.btnLang.textContent = "繁";
const hud = bindHud(document, localStorage, (key) => t(state.lang, key));
renderCatalog(state.lang, { selectedId: state.productId, briefing: state.briefing });

let opsLayers = readLayers(localStorage);
let opsElapsed = 0;
let opsTick = 0;
let opsSig = "";

function syncLayerUi() {
  const dock = document.getElementById("ops-layers");
  if (!dock) return;
  dock.setAttribute("aria-label", t(state.lang, "opsLayerLabel"));
  dock.querySelectorAll("[data-ops-layer]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(!!opsLayers[btn.dataset.opsLayer]));
  });
}
syncLayerUi();
document.getElementById("ops-layers").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ops-layer]");
  if (!btn) return;
  const id = btn.dataset.opsLayer;
  opsLayers = writeLayers({ ...opsLayers, [id]: !opsLayers[id] }, localStorage);
  syncLayerUi();
  syncOps(true);
});

function syncOps(force = false) {
  if (!state.session) {
    if (opsSig !== "off") {
      opsSig = "off";
      plant.setOps(null, opsLayers);
      renderOps(state.lang, null);
    }
    return;
  }
  const snap = buildOpsSnapshot(opsInputFromSession(state.session, opsElapsed));
  const sig = JSON.stringify({
    bottleneck: snap.bottleneck,
    rows: snap.tools.map((tool) => [tool.util, tool.queue, tool.alarm ? 1 : 0, tool.busy ? 1 : 0]),
    layers: opsLayers,
    lang: state.lang,
  });
  if (!force && sig === opsSig) return;
  opsSig = sig;
  plant.setOps(snap, opsLayers);
  renderOps(state.lang, snap);
}

function syncThemeUi() {
  const dock = document.getElementById("theme-dock");
  if (!dock) return;
  dock.setAttribute("aria-label", t(state.lang, "themeLabel"));
  dock.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.theme === plant.themeId));
  });
}
for (const id of THEME_IDS) {
  const swatch = document.querySelector(`[data-swatch="${id}"]`);
  if (swatch) swatch.style.background = paletteOf(id).swatch;
}
syncThemeUi();
document.getElementById("theme-dock").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-theme]");
  if (!btn) return;
  applyTheme(plant, btn.dataset.theme, localStorage);
  syncThemeUi();
});

function attachSession(session) {
  state.session = session;
  plant.watch(session);
  session.on("change", () => {
    renderAll(state.lang, session, els);
    renderFacility(state.lang, session);
    syncPlantStatus();
    syncOps(true);
  });
  session.on("transport", () => {
    /* The crane snapshot moves the carrier. Process waits until it is docked. */
  });
  session.on("process", ({ step, fault }) => {
    plant.beginLive(step.id, fault);
  });
  session.on("progress", (p) => plant.setLiveT(p));
  session.on("toast", ({ key, vars }) => showToast(state.lang, key, vars));
  session.on("radio", (key) => showRadio(state.lang, key));
  session.on("hold", () => {
    plant.holdId = session.hold?.id || null;
    plant.freeze();
    plant.focusWork(session.step().tool);
    plant.setFollow(false);
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    renderAll(state.lang, session, els);
    syncPlantStatus();
    syncOps(true);
  });
  session.on("complete", () => {
    plant.settle();
    showDone(state.lang, session, els);
  });
  session.on("resolved", (info) => {
    els.holdLayer.hidden = true;
    if (info?.rework || info?.bake) {
      plant.endLive();
      plant.showLot(session.morph, session.step().tool, session.displayCarrier());
      plant.focusWork(session.step().tool);
    } else if (info?.resume) {
      plant.beginDecay();
    }
  });
  renderAll(state.lang, session, els);
  renderFacility(state.lang, session);
  plant.showLot(session.morph, session.step().tool, session.displayCarrier());
  plant.workpiece?.setMark?.(session.product.mark);
  syncPlantStatus();
  syncOps(true);
}

function syncPlantStatus() {
  const s = state.session;
  if (!s) return;
  plant.clearStatuses();
  const tool = s.step().tool;
  const visual = s.status === "HOLD" ? "HOLD" : s.status === "DONE" ? "DONE" : s.busy ? "RUN" : "QUEUE";
  plant.setToolStatus(tool, visual);
  if (!plant.blocksSync()) plant.showLot(s.morph, tool, s.displayCarrier());
  if (state.selectedTool) showTool(state.lang, s, els, state.selectedTool);
}

function replayStation(stationId) {
  const s = state.session;
  if (!s) return;
  const toggleBack = !stationId && (plant.mode === "solo" || plant.mode === "soloHold");
  if (toggleBack) {
    plant.cancelSolo();
    plant.showLot(s.morph, s.step().tool, s.displayCarrier());
    syncPlantStatus();
    return;
  }
  if (s.busy || s.hold) {
    showToast(state.lang, "busyNow");
    const step = stationId ? (s.flow || STEPS).find((x) => x.id === stationId) || STATIONS.find((x) => x.id === stationId) : s.step();
    if (step) plant.focusWork(step.tool);
    return;
  }
  if (plant.mode === "solo" || plant.mode === "soloHold") plant.cancelSolo();
  plant.playSolo(stationId || s.step().id);
}

function paintMorph() {
  const s = state.session;
  if (!s || !els.lotMorph) return;
  const lang = state.lang;
  let text;
  let live = false;
  if ((plant.mode === "solo" || plant.mode === "soloHold") && plant.solo) {
    const st = (s.flow || STEPS).find((x) => x.id === plant.solo.stationId) || STATIONS.find((x) => x.id === plant.solo.stationId);
    text = t(lang, "morphDemo", { name: t(lang, "morph_" + (st?.morphOut || s.morph)) });
    live = true;
  } else if (s.hold) {
    text = `${t(lang, "morph_" + s.morph)} · HOLD`;
  } else if (plant.mode === "live" && plant.live && plant.live.t < 0.98) {
    const st = (s.flow || STEPS).find((x) => x.id === plant.live.stationId) || STATIONS.find((x) => x.id === plant.live.stationId);
    text = `${t(lang, "morph_" + s.morph)} → ${t(lang, "morph_" + st.morphOut)}`;
    live = true;
  } else {
    text = t(lang, "morph_" + s.morph);
  }
  els.lotMorph.dataset.live = live ? "1" : "";
  els.lotMorph.textContent = text;
  if (els.btnReplay) {
    const back = plant.mode === "solo" || plant.mode === "soloHold";
    els.btnReplay.textContent = t(lang, back ? "btnReturn" : "btnReplay");
  }
}

function startLot() {
  if (!state.productId || !state.briefing) return;
  opsElapsed = 0;
  opsSig = "";
  plant.setOpsFocus(null);
  const session = new Session({
    intensity: state.intensity,
    role: state.startRole,
    productId: state.productId,
    awaitChoice: true,
  });
  document.querySelectorAll("[data-role]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.role === state.startRole));
  });
  plant.setAvatarRole(state.startRole);
  els.startLayer.hidden = true;
  els.runLayer.hidden = false;
  els.doneLayer.hidden = true;
  els.holdLayer.hidden = true;
  document.getElementById("radio-dock").classList.remove("is-on");
  attachSession(session);
  plant.focusOverview();
}

function chooseRun(mode) {
  if (!state.session) return;
  state.session.chooseRun(mode);
  els.runLayer.hidden = true;
  renderAll(state.lang, state.session, els);
}

document.getElementById("btn-start").addEventListener("click", startLot);
document.getElementById("btn-run-auto").addEventListener("click", () => chooseRun("auto"));
document.getElementById("btn-run-step").addEventListener("click", () => chooseRun("step"));
document.getElementById("start-layer").addEventListener("click", (e) => {
  const card = e.target.closest("[data-product]");
  if (card) {
    state.productId = card.dataset.product;
    state.briefing = true;
    renderCatalog(state.lang, { selectedId: state.productId, briefing: true });
    return;
  }
  if (e.target.closest("#btn-catalog-back")) {
    state.briefing = false;
    renderCatalog(state.lang, { selectedId: state.productId, briefing: false });
  }
});
document.getElementById("btn-restart").addEventListener("click", () => {
  els.doneLayer.hidden = true;
  els.runLayer.hidden = true;
  els.startLayer.hidden = false;
  state.session = null;
  state.briefing = false;
  plant.watch(null);
  plant.holdId = null;
  plant.cancelSolo();
  plant.endLive();
  plant.clearStatuses();
  plant.workpiece?.setMark?.("HBX-100");
  plant.showLot("bank", "IQC-11", "FOUP");
  plant.focusOverview();
  plant.setOpsFocus(null);
  opsElapsed = 0;
  renderCatalog(state.lang, { selectedId: state.productId, briefing: false });
  renderAll(state.lang, null, els);
  syncOps(true);
});

document.getElementById("intensity-row").addEventListener("click", (e) => {
  const b = e.target.closest("[data-intensity]");
  if (!b) return;
  state.intensity = b.dataset.intensity;
  document.querySelectorAll("[data-intensity]").forEach((x) => {
    x.setAttribute("aria-pressed", String(x === b));
  });
});

document.getElementById("start-role-row").addEventListener("click", (e) => {
  const b = e.target.closest("[data-start-role]");
  if (!b) return;
  state.startRole = b.dataset.startRole;
  document.querySelectorAll("[data-start-role]").forEach((x) => {
    x.setAttribute("aria-pressed", String(x === b));
  });
});

els.btnAdvance.addEventListener("click", () => {
  if (plant.mode === "solo" || plant.mode === "soloHold") plant.cancelSolo();
  state.session?.advance();
});
els.btnPrev.addEventListener("click", () => state.session?.prevBeat());
els.btnAuto.addEventListener("click", () => {
  if (!state.session) return;
  if (plant.mode === "solo" || plant.mode === "soloHold") plant.cancelSolo();
  state.session.setAuto(!state.session.auto);
});
els.btnReplay.addEventListener("click", () => replayStation());

document.querySelector(".lot-dock").addEventListener("click", (e) => {
  const mode = e.target.closest("[data-mode]");
  if (mode && state.session) {
    state.session.setMode(mode.dataset.mode);
    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b === mode));
    });
  }
  const spd = e.target.closest("[data-speed]");
  if (spd && state.session) {
    state.session.setSpeed(Number(spd.dataset.speed));
    document.querySelectorAll("[data-speed]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b === spd));
    });
  }
});

document.querySelector(".topbar").addEventListener("click", (e) => {
  const role = e.target.closest("[data-role]");
  if (role) {
    state.startRole = role.dataset.role;
    state.session?.setRole(role.dataset.role);
    plant.setAvatarRole(role.dataset.role);
    document.querySelectorAll("header [data-role]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b === role));
    });
  }
});

els.btnLang.addEventListener("click", () => {
  const i = LANGS.indexOf(state.lang);
  state.lang = LANGS[(i + 1) % LANGS.length];
  applyStaticI18n(state.lang);
  plant.setTranslator((k, vars) => t(state.lang, k, vars || {}), state.lang);
  syncThemeUi();
  syncLayerUi();
  hud.refresh();
  renderCatalog(state.lang, { selectedId: state.productId, briefing: state.briefing && !state.session });
  renderAll(state.lang, state.session, els);
  syncOps(true);
  if (state.selectedTool) showTool(state.lang, state.session, els, state.selectedTool);
  syncWalkHint();
});

document.getElementById("hold-actions").addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || !state.session) return;
  state.session.resolve(b.dataset.action);
});

document.getElementById("tool-close").addEventListener("click", () => {
  state.selectedTool = null;
  hideTool(els);
  hud.hide("tool-dock");
});
document.getElementById("btn-jump-tool").addEventListener("click", () => {
  if (state.selectedTool) {
    if (plant.walking) plant.exitWalk({ overview: false });
    plant.setFollow(false);
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    plant.focusTool(state.selectedTool);
  }
});

let walkHintOpen = true;
function syncWalkHint() {
  const el = document.getElementById("walk-hint");
  const btn = document.getElementById("walk-hint-toggle");
  if (!el || !btn) return;
  el.hidden = !plant.walking;
  el.classList.toggle("is-tucked", !walkHintOpen);
  btn.textContent = t(state.lang, walkHintOpen ? "walkHintHide" : "walkHintShow");
}
document.getElementById("walk-hint-toggle").addEventListener("click", () => {
  walkHintOpen = !walkHintOpen;
  syncWalkHint();
});
plant.onWalk = (on) => {
  document.getElementById("btn-cam-walk").setAttribute("aria-pressed", String(on));
  if (on) {
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    document.getElementById("btn-cam-crane").setAttribute("aria-pressed", "false");
  }
  syncWalkHint();
};
plant.onInspect = (id) => {
  if (!id || !plant.walking) return;
  state.selectedTool = id;
  showTool(state.lang, state.session, els, id);
  hud.show("tool-dock");
};

document.getElementById("btn-cam-overview").addEventListener("click", () => {
  if (plant.walking) plant.exitWalk();
  plant.setFollow(false);
  document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
  document.getElementById("btn-cam-crane").setAttribute("aria-pressed", "false");
  if (!plant.walking) plant.focusOverview();
  plant.setOpsFocus(null);
});
document.getElementById("btn-cam-walk").addEventListener("click", () => {
  if (plant.walking) plant.exitWalk();
  else plant.enterWalk();
});
document.getElementById("btn-cam-follow").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
  document.getElementById("btn-cam-crane").setAttribute("aria-pressed", "false");
  plant.setFollow(on ? "lot" : false);
});
document.getElementById("btn-cam-crane").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
  document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
  plant.setFollow(on ? "crane" : false);
});
document.getElementById("btn-cam-tool").addEventListener("click", () => {
  if (!state.session) return;
  if (plant.walking) plant.exitWalk({ overview: false });
  plant.setFollow(false);
  document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
  plant.focusTool(state.session.step().tool);
  plant.setOpsFocus(state.session.step().tool);
});

document.getElementById("oht-modes").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-oht]");
  if (!btn || !state.session) return;
  state.session.facility.setMode(btn.dataset.oht);
  renderFacility(state.lang, state.session);
  state.session.change();
});
document.getElementById("btn-call").addEventListener("click", () => {
  const session = state.session;
  if (!session) return;
  const carrierId = document.getElementById("oht-src").value;
  const to = document.getElementById("oht-dst").value;
  const res = session.facility.requestMove({ carrierId, to });
  if (!res.ok) showToast(state.lang, "moveRefused", { reason: res.reason || "refused" });
  renderFacility(state.lang, session);
});
document.getElementById("btn-dispatch").addEventListener("click", () => {
  const session = state.session;
  if (!session) return;
  const res = session.facility.dispatchQueued();
  if (!res.ok) showToast(state.lang, "moveRefused", { reason: res.reason || "refused" });
  renderFacility(state.lang, session);
});
document.getElementById("btn-return-stock").addEventListener("click", () => {
  const session = state.session;
  if (!session) return;
  const id = session.facility.lotCarrierId || document.getElementById("oht-src").value;
  const res = session.facility.returnToStock(id);
  if (!res.ok) showToast(state.lang, "moveRefused", { reason: res.reason || "refused" });
  renderFacility(state.lang, session);
});

document.getElementById("stage-rail").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-station]");
  if (!chip) return;
  plant.setFollow(false);
  document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
  replayStation(chip.dataset.station);
});

// Click vs drag on the canvas
let down = null;
canvas.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
  if (!down) return;
  const dx = e.clientX - down.x;
  const dy = e.clientY - down.y;
  down = null;
  if (dx * dx + dy * dy > 16) return;
  if (plant.walking && plant.pointerLocked) return;
  const id = plant.pick(e.clientX, e.clientY);
  if (id) {
    state.selectedTool = id;
    showTool(state.lang, state.session, els, id);
    hud.show("tool-dock");
  }
  if (plant.walking) plant.requestLook();
});
canvas.addEventListener("pointermove", (e) => plant.hover(e.clientX, e.clientY));

window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (els.runLayer.hidden === false) {
    e.preventDefault();
    return;
  }
  if (els.startLayer.hidden === false) {
    if ((e.code === "Enter" || e.code === "Space") && state.briefing) {
      e.preventDefault();
      startLot();
    }
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    state.session?.advance();
  } else if (e.key === "r" || e.key === "R") {
    replayStation();
  } else if (e.key === "f" || e.key === "F") {
    const btn = document.getElementById("btn-cam-follow");
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    document.getElementById("btn-cam-crane").setAttribute("aria-pressed", "false");
    plant.setFollow(on ? "lot" : false);
  } else if (e.key === "3") {
    const btn = document.getElementById("btn-cam-crane");
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    plant.setFollow(on ? "crane" : false);
  } else if (e.key === "1") {
    if (plant.walking) plant.exitWalk();
    plant.setFollow(false);
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    document.getElementById("btn-cam-crane").setAttribute("aria-pressed", "false");
    if (!plant.walking) plant.focusOverview();
    plant.setOpsFocus(null);
  } else if (e.key === "2") {
    if (!state.session) return;
    if (plant.walking) plant.exitWalk({ overview: false });
    plant.focusTool(state.session.step().tool);
    plant.setOpsFocus(state.session.step().tool);
  }
});

window.addEventListener("resize", () => plant.resize());

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.session) {
    plant.lotMorph = state.session.morph;
    plant.holdId = state.session.hold?.id || null;
  }
  state.session?.tick(dt);
  opsElapsed += dt;
  opsTick += dt;
  if (opsTick >= 0.35) {
    opsTick = 0;
    syncOps();
  }
  const spd = state.session ? state.session.speed : 1;
  plant.update(dt, spd);
  renderFacility(state.lang, state.session);
  paintMorph();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__apex = { plant, state, els, t };
