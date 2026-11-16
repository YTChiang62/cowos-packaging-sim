import { t, applyStaticI18n, LANG_LABEL } from "./i18n.js";
import { BEATS, STEPS } from "./mes.js";


export function bindUI() {
  return {
    lotId: document.getElementById("lot-id"),
    lotProduct: document.getElementById("lot-product"),
    lotStatus: document.getElementById("lot-status"),
    lotStep: document.getElementById("lot-step"),
    lotTool: document.getElementById("lot-tool"),
    lotCarrier: document.getElementById("lot-carrier"),
    lotRecipe: document.getElementById("lot-recipe"),
    lotSites: document.getElementById("lot-sites"),
    lotMorph: document.getElementById("lot-morph"),
    genealogy: document.getElementById("genealogy"),
    beats: document.getElementById("mes-beats"),
    stageRail: document.getElementById("stage-rail"),
    radio: document.getElementById("radio-dock"),
    toolDock: document.getElementById("tool-dock"),
    toolName: document.getElementById("tool-name"),
    toolGroup: document.getElementById("tool-group"),
    toolRecipe: document.getElementById("tool-recipe"),
    toolLot: document.getElementById("tool-lot"),
    toolContract: document.getElementById("tool-contract"),
    holdLayer: document.getElementById("hold-layer"),
    holdKicker: document.getElementById("hold-kicker"),
    holdTitle: document.getElementById("hold-title"),
    holdSym: document.getElementById("hold-sym"),
    holdActions: document.getElementById("hold-actions"),
    startLayer: document.getElementById("start-layer"),
    doneLayer: document.getElementById("done-layer"),
    doneSummary: document.getElementById("done-summary"),
    toast: document.getElementById("toast"),
    btnAdvance: document.getElementById("btn-advance"),
    btnPrev: document.getElementById("btn-prev"),
    btnAuto: document.getElementById("btn-auto"),
    btnReplay: document.getElementById("btn-replay"),
    btnLang: document.getElementById("btn-lang"),
  };
}

export function renderAll(lang, session, els) {
  applyStaticI18n(lang);
  document.documentElement.lang = lang === "en" ? "en" : lang === "zh-CN" ? "zh-Hans" : "zh-Hant";
  els.btnLang.textContent = LANG_LABEL[lang];
  if (!session) return;
  const snap = session.snapshot();
  renderLot(lang, session, snap, els);
  renderBeats(lang, snap, els);
  renderStages(lang, snap, els);
  renderHold(lang, session, els);
  els.btnAdvance.textContent = t(lang, snap.mode === "beat" ? "btnAdvanceBeat" : "btnAdvance");
  els.btnAuto.setAttribute("aria-pressed", String(!!snap.auto));
  els.btnAuto.textContent = t(lang, snap.auto ? "autoOn" : "autoOff");
  els.btnPrev.disabled = snap.mode !== "beat" || snap.busy || !!snap.hold || snap.status === "DONE";
  els.btnAdvance.disabled = snap.status === "DONE" || !!snap.hold || !!snap.busy;
}

export function renderLot(lang, session, snap, els) {
  const { lot, step, status, stepIndex } = snap;
  els.lotId.textContent = lot.id;
  els.lotProduct.textContent = t(lang, "productName");
  els.lotStatus.textContent = status;
  els.lotStatus.className = `badge badge-${status}`;
  els.lotStep.textContent = `${stepIndex + 1}/${STEPS.length}  ${t(lang, "step_" + step.id)}`;
  els.lotTool.textContent = step.tool;
  els.lotRecipe.textContent = step.recipe;
  els.lotSites.textContent = t(lang, "sitesLine", {
    good: lot.goodSites,
    total: lot.totalSites,
    scrap: lot.scrap,
  });
  els.lotCarrier.textContent = t(lang, "carrier_" + session.carrierStation().id);
  if (els.lotMorph && !els.lotMorph.dataset.live) {
    els.lotMorph.textContent = t(lang, "morph_" + snap.morph);
  }

  els.genealogy.innerHTML = "";
  for (const row of session.genealogy()) {
    const li = document.createElement("li");
    const k = document.createElement("span");
    k.className = "g-k";
    k.textContent = t(lang, row.key);
    const v = document.createElement("span");
    v.className = "g-v";
    const value = typeof row.value === "string" && (row.value === "gen_pending" || row.value.startsWith("gen_"))
      ? t(lang, row.value)
      : row.value;
    v.textContent = value;
    li.append(k, v);
    els.genealogy.append(li);
  }
}

export function renderBeats(lang, snap, els) {
  const wrap = document.createElement("div");
  wrap.className = "beats";
  BEATS.forEach((b, i) => {
    const s = document.createElement("span");
    s.className = "beat";
    if (snap.status === "DONE" || i < snap.beatIndex) s.classList.add("is-done");
    if (snap.status !== "DONE" && i === snap.beatIndex) s.classList.add("is-current");
    s.textContent = t(lang, "beat_" + b);
    wrap.append(s);
  });
  els.beats.replaceChildren(wrap);
}

export function renderStages(lang, snap, els) {
  els.stageRail.innerHTML = "";
  for (let i = 0; i < STEPS.length; i++) {
    const st = STEPS[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stage-chip";
    btn.dataset.station = st.id;
    btn.dataset.stage = st.id;
    btn.textContent = t(lang, "stage_" + st.stage);
    if (i === snap.stepIndex && snap.status !== "DONE") btn.classList.add("is-current");
    else if (i < snap.stepIndex || snap.status === "DONE") btn.classList.add("is-done");
    if (snap.status === "HOLD" && i === snap.stepIndex) {
      btn.classList.add("is-hold");
      btn.classList.remove("is-current");
    }
    els.stageRail.append(btn);
  }
}

export function renderHold(lang, session, els) {
  const hold = session.hold;
  if (!hold || hold.waiting) {
    els.holdLayer.hidden = true;
    return;
  }
  els.holdLayer.hidden = false;
  els.holdKicker.textContent = t(lang, "holdKicker");
  els.holdTitle.textContent = t(lang, `hold_${hold.id}_title`);
  els.holdSym.textContent = t(lang, `hold_${hold.id}_sym`);
  els.holdActions.innerHTML = "";
  for (const act of hold.actions) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.action = act.id;
    b.className = act.role === "PE" ? "pe-btn" : "ghost-btn";
    b.innerHTML = `${t(lang, act.label)}<small>${t(lang, act.hint)}${act.role ? " · " + act.role : ""}</small>`;
    if (hold.waiting) b.disabled = true;
    els.holdActions.append(b);
  }
}

export function showTool(lang, session, els, toolId) {
  const step = STEPS.find((s) => s.tool === toolId);
  els.toolDock.classList.add("is-on");
  els.toolName.textContent = toolId;
  els.toolGroup.textContent = step ? t(lang, "bay_" + (step.stage === "grind" ? "grind" : step.stage)) : "—";
  // grind stage uses bay_grind
  if (step) {
    const bayKey = step.stage === "incoming" ? "bay_incoming"
      : step.stage === "cow" ? "bay_cow"
      : step.stage === "grind" ? "bay_grind"
      : step.stage === "dice" ? "bay_dice"
      : step.stage === "wos" ? "bay_wos"
      : step.stage === "test" ? "bay_test"
      : "bay_pack";
    els.toolGroup.textContent = t(lang, bayKey);
    els.toolRecipe.textContent = step.recipe;
    if (els.toolContract) {
      els.toolContract.textContent = `${t(lang, "chg_" + step.id)} ${t(lang, "out_" + step.id)}`;
    }
  } else {
    els.toolRecipe.textContent = "—";
    if (els.toolContract) els.toolContract.textContent = "";
  }
  const onThis = session && session.step().tool === toolId && session.status !== "QUEUE";
  els.toolLot.textContent = onThis ? session.lot.id : t(lang, "idleTool");
}

export function hideTool(els) {
  els.toolDock.classList.remove("is-on");
}

export function showToast(lang, key, vars) {
  const el = document.getElementById("toast");
  let text = t(lang, key, vars || {});
  // If vars.step was a key, translate it
  if (vars?.step && String(vars.step).startsWith("step_")) {
    text = t(lang, key, { ...vars, step: t(lang, vars.step) });
  }
  if (vars?.reason) {
    text = t(lang, key, { ...vars, reason: t(lang, "reason_" + vars.reason) });
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => { el.hidden = true; }, 3200);
}

export function showRadio(lang, key) {
  const el = document.getElementById("radio-dock");
  el.innerHTML = t(lang, key);
  el.classList.add("is-on");
}

function locationText(lang, location) {
  const loc = location || "";
  if (loc.startsWith("bin:")) {
    const [, zone, slot] = loc.split(":");
    return `${t(lang, "loc_bin")} ${zone}/${slot}`;
  }
  if (loc.startsWith("io:")) return `${t(lang, "loc_io")} ${loc.slice(3)}`;
  if (loc.startsWith("transit:")) return `${t(lang, "loc_transit")} ${loc.slice(8)}`;
  if (loc.startsWith("port:")) return `${t(lang, "loc_port")} ${loc.slice(5)}`;
  if (loc.startsWith("tool:")) return `${t(lang, "loc_tool")} ${loc.slice(5)}`;
  if (loc === "stacker") return t(lang, "loc_stacker");
  return loc || "—";
}

export function renderFacility(lang, session) {
  const dock = document.getElementById("facility-dock");
  if (!dock) return;
  const snap = session?.facility?.snapshot?.();
  if (!snap) {
    dock.dataset.sig = "";
    return;
  }
  const sig = [
    snap.mode,
    snap.vehicles.map((v) => `${v.id}:${v.state}:${v.carrying || ""}:${v.waiting ? 1 : 0}`).join("|"),
    snap.carriers.map((c) => `${c.id}:${c.location}:${c.status}:${c.qty}`).join("|"),
    snap.log.map((e) => e.seq).join(","),
  ].join("~");
  if (dock.dataset.sig === sig && dock.dataset.lang === lang) return;
  dock.dataset.sig = sig;
  dock.dataset.lang = lang;

  const zones = document.getElementById("wh-zones");
  zones.replaceChildren();
  for (const id of ["DBK", "INT", "SUB", "FG"]) {
    const chip = document.createElement("span");
    const rows = snap.carriers.filter((c) => c.zone === id && String(c.location).startsWith(`bin:${id}`));
    const locked = rows.some((c) => c.status === "locked" || c.qty <= 0);
    chip.className = `zone-chip${locked && id === "DBK" ? " is-locked" : ""}`;
    chip.textContent = `${t(lang, "zone_" + id)} ${rows.filter((c) => c.qty > 0).length}`;
    zones.append(chip);
  }

  const body = document.getElementById("wh-body");
  body.replaceChildren();
  for (const carrier of snap.carriers) {
    const tr = document.createElement("tr");
    if (carrier.status === "locked") tr.className = "is-locked";
    if (carrier.status === "transit") tr.className = "is-transit";
    const cells = [
      locationText(lang, carrier.location),
      carrier.lotId || "—",
      carrier.type,
      String(carrier.qty),
      t(lang, "st_" + carrier.status),
    ];
    for (const text of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    body.append(tr);
  }

  document.querySelectorAll("#oht-modes [data-oht]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.oht === snap.mode));
  });
  const fleet = document.getElementById("oht-vehicles");
  fleet.replaceChildren();
  for (const vehicle of snap.vehicles) {
    const row = document.createElement("div");
    row.className = `veh veh-${vehicle.state}`;
    const name = document.createElement("b");
    name.textContent = vehicle.id;
    const state = document.createElement("span");
    state.textContent = t(lang, "veh_" + vehicle.state);
    const load = document.createElement("em");
    load.textContent = vehicle.carrying || (vehicle.waiting ? "…" : "");
    row.append(name, state, load);
    fleet.append(row);
  }

  const src = document.getElementById("oht-src");
  const dst = document.getElementById("oht-dst");
  const keepSrc = src.value;
  const keepDst = dst.value;
  src.replaceChildren();
  for (const carrier of snap.carriers) {
    const opt = document.createElement("option");
    opt.value = carrier.id;
    opt.textContent = `${carrier.id} · ${carrier.type}`;
    src.append(opt);
  }
  if ([...src.options].some((o) => o.value === keepSrc)) src.value = keepSrc;
  const ports = ["io:DBK", "io:INT", "io:SUB", "io:FG", "DBK-02", "DBK-02:tray", "HB-21", "DIC-81", "WOS-04", "WOS-04:unit", "WOS-04:out", "BPK-05"];
  if (!dst.options.length) {
    for (const port of ports) {
      const opt = document.createElement("option");
      opt.value = port;
      opt.textContent = port;
      dst.append(opt);
    }
  }
  if (keepDst) dst.value = keepDst;

  const dispatch = document.getElementById("btn-dispatch");
  dispatch.hidden = snap.mode === "AUTO";
  dispatch.disabled = snap.mode === "PAUSE" || snap.queued.length === 0;

  const log = document.getElementById("wh-log");
  log.replaceChildren();
  for (const entry of [...snap.log].reverse()) {
    const li = document.createElement("li");
    const kind = t(lang, "log_" + entry.kind);
    const why = entry.reason ? ` · ${t(lang, "reason_" + entry.reason)}` : "";
    li.textContent = `${kind} ${entry.carrierId || entry.zone || ""}${entry.type ? " " + entry.type : ""}${why}`;
    log.append(li);
  }
}

export function showDone(lang, session, els) {
  const lot = session.lot;
  els.doneLayer.hidden = false;
  els.doneSummary.textContent = t(lang, "doneSummary", {
    lot: lot.id,
    good: lot.goodSites,
    scrap: lot.scrap,
    holds: session.holdsResolved.length,
    sn: lot.unit,
  });
}
