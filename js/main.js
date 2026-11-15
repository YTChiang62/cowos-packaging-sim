import { LANGS, t, applyStaticI18n } from "./i18n.js";
import { Session, STEPS } from "./mes.js";
import { Plant } from "./plant.js";
import {
  bindUI, renderAll, showTool, hideTool, showToast, showRadio, showDone,
} from "./ui.js";

const canvas = document.getElementById("view");
const els = bindUI();

const state = {
  lang: "zh-TW",
  intensity: "few",
  startRole: "MFG",
  session: null,
  selectedTool: null,
};

const plant = new Plant(canvas);
plant.setTranslator((k) => t(state.lang, k), state.lang);
plant.focusOverview();

applyStaticI18n(state.lang);
els.btnLang.textContent = "繁";

function attachSession(session) {
  state.session = session;
  session.on("change", () => {
    renderAll(state.lang, session, els);
    syncPlantStatus();
  });
  session.on("transport", ({ to, carrier }) => {
    plant.moveTo(to.tool, carrier || session.travelCarrier()).then(() => session.transportDone());
  });
  session.on("process", ({ step, fault }) => {
    plant.beginLive(step.id, fault);
  });
  session.on("progress", (p) => plant.setLiveT(p));
  session.on("toast", ({ key, vars }) => showToast(state.lang, key, vars));
  session.on("radio", (key) => showRadio(state.lang, key));
  session.on("hold", () => {
    plant.freeze();
    plant.focusWork(session.step().tool);
    plant.setFollow(false);
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    renderAll(state.lang, session, els);
    syncPlantStatus();
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
  plant.showLot(session.morph, session.step().tool, session.displayCarrier());
  syncPlantStatus();
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
    const step = stationId ? STEPS.find((x) => x.id === stationId) : s.step();
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
    const st = STEPS.find((x) => x.id === plant.solo.stationId);
    text = t(lang, "morphDemo", { name: t(lang, "morph_" + (st?.morphOut || s.morph)) });
    live = true;
  } else if (s.hold) {
    text = `${t(lang, "morph_" + s.morph)} · HOLD`;
  } else if (plant.mode === "live" && plant.live && plant.live.t < 0.98) {
    const st = STEPS.find((x) => x.id === plant.live.stationId);
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
  const session = new Session({ intensity: state.intensity, role: state.startRole });
  document.querySelectorAll("[data-role]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.role === state.startRole));
  });
  els.startLayer.hidden = true;
  els.doneLayer.hidden = true;
  els.holdLayer.hidden = true;
  document.getElementById("radio-dock").classList.remove("is-on");
  attachSession(session);
  plant.focusOverview();
}

document.getElementById("btn-start").addEventListener("click", startLot);
document.getElementById("btn-restart").addEventListener("click", () => {
  els.doneLayer.hidden = true;
  els.startLayer.hidden = false;
  state.session = null;
  plant.cancelSolo();
  plant.endLive();
  plant.clearStatuses();
  plant.showLot("bank", "DBK-02", "FOUP");
  plant.focusOverview();
  renderAll(state.lang, null, els);
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
    document.querySelectorAll("header [data-role]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b === role));
    });
  }
});

els.btnLang.addEventListener("click", () => {
  const i = LANGS.indexOf(state.lang);
  state.lang = LANGS[(i + 1) % LANGS.length];
  applyStaticI18n(state.lang);
  plant.setTranslator((k) => t(state.lang, k), state.lang);
  renderAll(state.lang, state.session, els);
  if (state.selectedTool) showTool(state.lang, state.session, els, state.selectedTool);
});

document.getElementById("hold-actions").addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || !state.session) return;
  state.session.resolve(b.dataset.action);
});

document.getElementById("tool-close").addEventListener("click", () => {
  state.selectedTool = null;
  hideTool(els);
});
document.getElementById("btn-jump-tool").addEventListener("click", () => {
  if (state.selectedTool) {
    plant.setFollow(false);
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    plant.focusTool(state.selectedTool);
  }
});

document.getElementById("btn-cam-overview").addEventListener("click", () => {
  plant.setFollow(false);
  document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
  plant.focusOverview();
});
document.getElementById("btn-cam-follow").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
  plant.setFollow(on);
});
document.getElementById("btn-cam-tool").addEventListener("click", () => {
  if (!state.session) return;
  plant.setFollow(false);
  document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
  plant.focusTool(state.session.step().tool);
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
  const id = plant.pick(e.clientX, e.clientY);
  if (id) {
    state.selectedTool = id;
    showTool(state.lang, state.session, els, id);
  }
});
canvas.addEventListener("pointermove", (e) => plant.hover(e.clientX, e.clientY));

window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (els.startLayer.hidden === false) {
    if (e.code === "Enter" || e.code === "Space") {
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
    plant.setFollow(on);
  } else if (e.key === "1") {
    plant.setFollow(false);
    document.getElementById("btn-cam-follow").setAttribute("aria-pressed", "false");
    plant.focusOverview();
  } else if (e.key === "2") {
    if (state.session) plant.focusTool(state.session.step().tool);
  }
});

window.addEventListener("resize", () => plant.resize());

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.session?.tick(dt);
  const spd = state.session ? state.session.speed : 1;
  plant.update(dt, spd);
  paintMorph();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
