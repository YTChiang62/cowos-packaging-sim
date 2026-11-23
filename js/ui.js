import { PRODUCTS } from "./catalog.js";
import { orderLots } from "./dispatch.js";
import { t, applyStaticI18n, LANG_LABEL } from "./i18n.js";
import { buildKpiFromSession } from "./kpi.js";
import { BEATS, STEPS } from "./mes.js";
import { MODULES, PORTS, STATIONS, moduleById, recipeById, stageById } from "./route.js";
import { afterActionFigures, buildAfterAction, scenariosForProduct } from "./scenario.js";


export function bindUI() {
  return {
    lotId: document.getElementById("lot-id"),
    lotProduct: document.getElementById("lot-product"),
    lotStatus: document.getElementById("lot-status"),
    lotStep: document.getElementById("lot-step"),
    lotTool: document.getElementById("lot-tool"),
    lotCarrier: document.getElementById("lot-carrier"),
    lotRecipe: document.getElementById("lot-recipe"),
    lotParams: document.getElementById("lot-params"),
    lotSites: document.getElementById("lot-sites"),
    lotYield: document.getElementById("lot-yield"),
    lotMorph: document.getElementById("lot-morph"),
    genealogy: document.getElementById("genealogy"),
    beats: document.getElementById("beat-row"),
    stageRail: document.getElementById("stage-flow"),
    radio: document.getElementById("radio-dock"),
    toolDock: document.getElementById("tool-dock"),
    toolName: document.getElementById("tool-name"),
    toolGroup: document.getElementById("tool-group"),
    toolRecipe: document.getElementById("tool-recipe"),
    toolParams: document.getElementById("tool-params"),
    toolLot: document.getElementById("tool-lot"),
    toolState: document.getElementById("tool-state"),
    toolCarrier: document.getElementById("tool-carrier"),
    toolMorph: document.getElementById("tool-morph"),
    toolHold: document.getElementById("tool-hold"),
    toolContract: document.getElementById("tool-contract"),
    holdLayer: document.getElementById("hold-layer"),
    holdKicker: document.getElementById("hold-kicker"),
    holdTitle: document.getElementById("hold-title"),
    holdSym: document.getElementById("hold-sym"),
    holdActions: document.getElementById("hold-actions"),
    startLayer: document.getElementById("start-layer"),
    catalogList: document.getElementById("catalog-list"),
    catalogBrief: document.getElementById("catalog-brief"),
    runLayer: document.getElementById("run-layer"),
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
  paintProduct(lang, session);
  if (!session) return;
  const snap = session.snapshot();
  renderLot(lang, session, snap, els);
  renderBeats(lang, snap, els);
  renderStages(lang, snap, els, session.flow);
  renderHold(lang, session, els);
  const waiting = snap.runChoice == null;
  const terminal = snap.status === "DONE" || snap.status === "SCRAP";
  els.btnAdvance.textContent = t(lang, snap.mode === "beat" ? "btnAdvanceBeat" : "btnAdvance");
  els.btnAuto.setAttribute("aria-pressed", String(!!snap.auto));
  els.btnAuto.textContent = t(lang, snap.auto ? "autoOn" : "autoOff");
  els.btnAuto.disabled = waiting || terminal;
  els.btnPrev.disabled = waiting || snap.mode !== "beat" || snap.busy || !!snap.hold || terminal;
  els.btnAdvance.disabled = waiting || terminal || !!snap.hold || !!snap.busy;
  const assist = document.getElementById("btn-clear-assist-lot");
  if (assist) {
    const eq = snap.eq?.[snap.step.tool];
    assist.hidden = eq !== "ASSIST";
  }
  renderDispatch(lang, session);
}

function paintProduct(lang, session) {
  const hdr = document.getElementById("hdr-product");
  if (!hdr) return;
  hdr.textContent = session ? t(lang, session.product.nameKey) : t(lang, "hdrNoLot");
}

export function renderCatalog(lang, { selectedId = null, briefing = false, scenario = "first" } = {}) {
  const list = document.getElementById("catalog-list");
  const brief = document.getElementById("catalog-brief");
  if (!list || !brief) return;
  list.hidden = briefing;
  brief.hidden = !briefing;
  const options = document.getElementById("start-options");
  if (options) options.hidden = !briefing;
  const start = document.getElementById("btn-start");
  if (start) start.disabled = !briefing;
  if (!briefing) {
    list.replaceChildren();
    const kicker = document.createElement("div");
    kicker.className = "kicker";
    kicker.textContent = t(lang, "catalogKicker");
    const title = document.createElement("h1");
    title.textContent = t(lang, "catalogTitle");
    const lede = document.createElement("p");
    lede.className = "lede";
    lede.textContent = t(lang, "catalogLede");
    list.append(kicker, title, lede);
    for (const product of PRODUCTS) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "catalog-card";
      card.dataset.product = product.id;
      card.setAttribute("aria-pressed", String(product.id === selectedId));
      const name = document.createElement("strong");
      name.textContent = t(lang, product.nameKey);
      const blurb = document.createElement("span");
      blurb.textContent = t(lang, product.blurbKey);
      const facts = document.createElement("span");
      facts.className = "catalog-facts";
      for (const fact of [
        t(lang, "factSteps", { n: product.steps }),
        t(lang, "factBays", { n: product.bays.length }),
        t(lang, "factTools", { n: product.toolsUsed }),
        ...product.materials.map((key) => t(lang, key)),
      ]) {
        const chip = document.createElement("em");
        chip.textContent = fact;
        facts.append(chip);
      }
      card.append(name, blurb, facts);
      list.append(card);
    }
    return;
  }
  const product = PRODUCTS.find((item) => item.id === selectedId) || PRODUCTS[0];
  brief.replaceChildren();
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ghost-btn";
  back.id = "btn-catalog-back";
  back.textContent = t(lang, "briefBack");
  const kicker = document.createElement("div");
  kicker.className = "kicker";
  kicker.textContent = product.flowId;
  const title = document.createElement("h1");
  title.textContent = t(lang, product.nameKey);
  const story = document.createElement("p");
  story.className = "lede";
  story.textContent = t(lang, product.storyKey);
  const facts = document.createElement("div");
  facts.className = "catalog-facts";
  for (const fact of [
    t(lang, "factSteps", { n: product.steps }),
    t(lang, "factBays", { n: product.bays.length }),
    t(lang, "factTools", { n: product.toolsUsed }),
  ]) {
    const chip = document.createElement("em");
    chip.textContent = fact;
    facts.append(chip);
  }
  const matLabel = document.createElement("span");
  matLabel.className = "field-label";
  matLabel.textContent = t(lang, "briefMaterials");
  const mats = document.createElement("div");
  mats.className = "catalog-facts";
  for (const key of product.materials) {
    const chip = document.createElement("em");
    chip.textContent = t(lang, key);
    mats.append(chip);
  }
  const bayLabel = document.createElement("span");
  bayLabel.className = "field-label";
  bayLabel.textContent = t(lang, "bayList");
  const bays = document.createElement("div");
  bays.className = "catalog-facts";
  for (const bay of product.bays) {
    const chip = document.createElement("em");
    chip.textContent = t(lang, "bay_" + bay);
    bays.append(chip);
  }
  const stepLabel = document.createElement("span");
  stepLabel.className = "field-label";
  stepLabel.textContent = t(lang, "briefSteps");
  const steps = document.createElement("ol");
  steps.className = "brief-steps";
  const seenStages = [];
  product.flow.forEach((step) => {
    if (seenStages.includes(step.stage)) return;
    seenStages.push(step.stage);
    const stage = stageById(step.stage);
    const count = product.flow.filter((item) => item.stage === step.stage).length;
    const li = document.createElement("li");
    const name = stage ? stage.name[lang === "en" ? 2 : lang === "zh-CN" ? 1 : 0] : step.stage;
    li.textContent = `${stage?.code || ""} ${name} · ${count}`;
    steps.append(li);
  });
  const note = document.createElement("p");
  note.className = "help-hint";
  note.textContent = product.skippedTools.length ? t(lang, "unusedNote") : "";
  brief.append(back, kicker, title, story, facts, matLabel, mats, bayLabel, bays, stepLabel, steps, note);
  renderScenarioChoices(lang, product, scenario);
}

export function renderLot(lang, session, snap, els) {
  const { lot, step, status, stepIndex } = snap;
  els.lotId.textContent = lot.id;
  els.lotProduct.textContent = t(lang, session.product.nameKey);
  els.lotStatus.textContent = status;
  els.lotStatus.className = `badge badge-${status}`;
  const stage = stageById(step.stage);
  const mod = moduleById(step.module);
  const langIndex = lang === "en" ? 2 : lang === "zh-CN" ? 1 : 0;
  const stageName = stage ? stage.name[langIndex] : "";
  const modName = mod ? mod.name[langIndex] : "";
  els.lotStep.textContent = `${modName} · ${step.code} ${stageName} · ${stepIndex + 1}/${session.flow.length} ${t(lang, "step_" + step.id)}`;
  const eq = snap.eq?.[step.tool];
  els.lotTool.textContent = eq ? `${step.tool} · ${t(lang, "eq_" + eq)}` : step.tool;
  if (els.lotYield) {
    const test = lot.tests?.[lot.tests.length - 1];
    els.lotYield.textContent = test
      ? t(lang, "yieldLine", { y: test.yieldPct, bins: test.bins, grade: test.grade })
      : t(lang, "yieldPending");
  }
  els.lotRecipe.textContent = step.recipe;
  if (els.lotParams) fillParams(lang, step.recipe, els.lotParams, session.product.recipes);
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

function paramLabel(lang, param) {
  const key = "p_" + param.id;
  const label = t(lang, key);
  return label === key ? param.name : label;
}

export function fillParams(lang, recipeId, el, recipes) {
  el.replaceChildren();
  const recipe = (recipes && recipes[recipeId]) || recipeById(recipeId);
  if (!recipe) return;
  for (const param of recipe.params) {
    const row = document.createElement("span");
    row.className = "param";
    const unit = param.unit ? ` ${param.unit}` : "";
    row.textContent = `${paramLabel(lang, param)}  ${param.value}${unit}`;
    el.append(row);
  }
}

let flowPin = null;
let flowPinStep = null;

export function renderStages(lang, snap, els, flow = STEPS) {
  const current = flow[Math.min(snap.stepIndex, flow.length - 1)];
  if (!current) return;
  if (flowPinStep !== current.id) {
    flowPin = null;
    flowPinStep = current.id;
  }
  const moduleId = flowPin?.module || current.module;
  const stageId = flowPin?.module === current.module || !flowPin ? (flowPin?.stage || current.stage) : (
    flow.find((step) => step.module === moduleId)?.stage
  );
  els.stageRail.innerHTML = "";
  const mods = document.createElement("div");
  mods.className = "flow-mods";
  const moduleIds = [];
  for (const step of flow) {
    if (!moduleIds.includes(step.module)) moduleIds.push(step.module);
  }
  for (const id of moduleIds) {
    const mod = MODULES.find((item) => item.id === id) || moduleById(id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flow-mod";
    if (id === moduleId) btn.classList.add("is-current");
    const done = flow.filter((step) => step.module === id && (flow.indexOf(step) < snap.stepIndex || snap.status === "DONE")).length;
    const total = flow.filter((step) => step.module === id).length;
    const name = mod ? t(lang, "bay_" + id) : id;
    btn.textContent = `${name} ${done}/${total}`;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const first = flow.find((step) => step.module === id);
      flowPin = { module: id, stage: first?.stage };
      renderStages(lang, snap, els, flow);
    });
    mods.append(btn);
  }
  els.stageRail.append(mods);
  const stages = document.createElement("div");
  stages.className = "flow-stages";
  const stageIds = [];
  for (const step of flow) {
    if (step.module === moduleId && !stageIds.includes(step.stage)) stageIds.push(step.stage);
  }
  for (const id of stageIds) {
    const stage = stageById(id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flow-stage";
    if (id === stageId) btn.classList.add("is-current");
    const name = stage ? stage.name[lang === "en" ? 2 : lang === "zh-CN" ? 1 : 0] : id;
    btn.textContent = `${stage?.code || ""} ${name}`;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      flowPin = { module: moduleId, stage: id };
      renderStages(lang, snap, els, flow);
    });
    stages.append(btn);
  }
  els.stageRail.append(stages);
  const steps = document.createElement("div");
  steps.className = "flow-steps";
  let focus = null;
  flow.forEach((step, index) => {
    if (step.stage !== stageId) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stage-chip";
    btn.dataset.station = step.id;
    btn.textContent = `${step.code} ${t(lang, "step_" + step.id)}`;
    if (index === snap.stepIndex && snap.status !== "DONE") {
      btn.classList.add("is-current");
      focus = btn;
    } else if (index < snap.stepIndex || snap.status === "DONE") btn.classList.add("is-done");
    if (snap.status === "HOLD" && index === snap.stepIndex) {
      btn.classList.add("is-hold");
      btn.classList.remove("is-current");
      focus = btn;
    }
    steps.append(btn);
  });
  els.stageRail.append(steps);
  focus?.scrollIntoView({ block: "nearest", inline: "center" });
}

const DISP_RANK = { rework: 0, scrap: 1, release: 2 };

export function renderHold(lang, session, els) {
  const hold = session.hold;
  const phase = document.getElementById("hold-phase");
  if (!hold || hold.waiting) {
    els.holdLayer.hidden = true;
    if (phase) phase.textContent = "";
    return;
  }
  els.holdLayer.hidden = false;
  els.holdKicker.textContent = t(lang, "holdKicker");
  els.holdTitle.textContent = t(lang, `hold_${hold.id}_title`);
  els.holdSym.textContent = t(lang, `hold_${hold.id}_sym`);
  if (phase) {
    phase.textContent = t(lang, hold.phase === "disposition" ? "holdPhaseChoose" : "holdPhaseContain");
  }
  els.holdActions.innerHTML = "";
  if (hold.phase !== "disposition") {
    const contain = document.createElement("button");
    contain.type = "button";
    contain.dataset.action = "contain";
    contain.className = "primary-btn";
    contain.innerHTML = `${t(lang, "dispContain")}<small>${t(lang, "dispContainHint")}</small>`;
    els.holdActions.append(contain);
    return;
  }
  const actions = [...hold.actions].sort((a, b) => (DISP_RANK[a.id] ?? 9) - (DISP_RANK[b.id] ?? 9));
  for (const act of actions) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.action = act.id;
    b.className = act.role === "PE" ? "pe-btn" : "ghost-btn";
    const label = DISP_RANK[act.id] != null ? t(lang, act.id === "rework" ? "dispRework" : act.id === "scrap" ? "dispScrap" : "dispRelease") : t(lang, act.label);
    b.innerHTML = `${label}<small>${t(lang, act.hint)}${act.role ? " · " + act.role : ""}</small>`;
    els.holdActions.append(b);
  }
}

function dockedHere(session, toolId) {
  const carriers = session?.facility?.snapshot?.().carriers || [];
  return carriers.filter((c) => c.location === `tool:${toolId}` || String(c.location).startsWith(`port:${toolId}`));
}

function writeLive(els, lang, { state, carrier, morph, hold, lot }) {
  if (els.toolState) els.toolState.textContent = state;
  if (els.toolCarrier) els.toolCarrier.textContent = carrier;
  if (els.toolMorph) els.toolMorph.textContent = morph;
  if (els.toolHold) els.toolHold.textContent = hold;
  if (els.toolLot) els.toolLot.textContent = lot;
}

export function showTool(lang, session, els, toolId) {
  const flow = session?.flow || STEPS;
  const step = (session && session.step().tool === toolId)
    ? session.step()
    : flow.find((s) => s.tool === toolId);
  const equipped = STATIONS.find((s) => s.tool === toolId);
  els.toolDock.classList.add("is-on");
  const assistBtn = document.getElementById("btn-clear-assist");
  if (toolId === "stocker") {
    if (assistBtn) assistBtn.hidden = true;
    const carriers = session?.facility?.snapshot?.().carriers || [];
    const atIo = carriers.filter((c) => String(c.location).startsWith("io:"));
    els.toolName.textContent = t(lang, "stockerName");
    els.toolGroup.textContent = t(lang, "whKicker");
    els.toolRecipe.textContent = "—";
    if (els.toolParams) els.toolParams.replaceChildren();
    if (els.toolContract) {
      els.toolContract.textContent = ["DBK", "INT", "SUB", "FG"].map((id) => {
        const n = carriers.filter((c) => c.zone === id && c.qty > 0 && String(c.location).startsWith("bin:")).length;
        return `${id} ${n}`;
      }).join(" · ");
    }
    writeLive(els, lang, {
      state: t(lang, "state_idle"),
      carrier: atIo.length ? atIo.map((c) => `${c.id} ${c.type}`).join(" · ") : t(lang, "toolCarrierNone"),
      morph: "—",
      hold: session?.hold ? t(lang, `hold_${session.hold.id}_title`) : t(lang, "toolHoldNone"),
      lot: session ? session.lot.id : "—",
    });
    return;
  }
  els.toolName.textContent = toolId;
  const onTool = !!(session && session.step().tool === toolId);
  if (step) {
    els.toolGroup.textContent = t(lang, "bay_" + step.bay);
    els.toolRecipe.textContent = step.recipe;
    if (els.toolParams) fillParams(lang, step.recipe, els.toolParams, session?.product?.recipes);
    if (els.toolContract) {
      els.toolContract.textContent = `${t(lang, "chg_" + step.id)} ${t(lang, "out_" + step.id)}`;
    }
  } else if (equipped) {
    els.toolGroup.textContent = t(lang, "bay_" + equipped.bay);
    els.toolRecipe.textContent = "—";
    if (els.toolParams) els.toolParams.replaceChildren();
    if (els.toolContract) els.toolContract.textContent = t(lang, "toolOffRoute");
  } else {
    els.toolGroup.textContent = "—";
    els.toolRecipe.textContent = "—";
    if (els.toolParams) els.toolParams.replaceChildren();
    if (els.toolContract) els.toolContract.textContent = "";
  }
  const docked = dockedHere(session, toolId);
  const eq = session?.eqState?.(toolId) || "IDLE";
  if (assistBtn) {
    assistBtn.hidden = eq !== "ASSIST";
    assistBtn.dataset.tool = toolId;
  }
  writeLive(els, lang, {
    state: t(lang, "eq_" + eq),
    carrier: docked.length
      ? docked.map((c) => `${c.type}${c.lotId ? " · " + c.lotId : ""}`).join(" · ")
      : t(lang, "toolCarrierNone"),
    morph: onTool ? t(lang, "morph_" + session.morph) : "—",
    hold: onTool && session.hold ? t(lang, `hold_${session.hold.id}_title`) : t(lang, "toolHoldNone"),
    lot: onTool && session.status !== "QUEUE" ? session.lot.id : t(lang, "idleTool"),
  });
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
  if (vars?.state) {
    const named = t(lang, "eq_" + vars.state);
    if (named !== `eq_${vars.state}`) text = t(lang, key, { ...vars, state: named });
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => { el.hidden = true; }, 3200);
}

export function showRadio(lang, key) {
  const el = document.getElementById("radio-dock");
  const body = document.getElementById("radio-body");
  if (body) body.innerHTML = t(lang, key);
  else el.innerHTML = t(lang, key);
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

export function renderFacility(lang, session, snap = null) {
  const dock = document.getElementById("facility-dock");
  if (!dock) return;
  if (dock.classList.contains("is-hud-hidden")) {
    if (dock.dataset.sig) dock.dataset.sig = "";
    return;
  }
  if (!snap) snap = session?.facility?.snapshot?.();
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
  const ports = Object.keys(PORTS);
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

export function renderOps(lang, snapshot) {
  const card = document.getElementById("ops-card");
  const advice = document.getElementById("ops-advice");
  const stats = document.getElementById("ops-stats");
  if (!card || !advice || !stats) return;
  if (!snapshot?.bottleneck) {
    card.hidden = true;
    advice.textContent = "";
    stats.replaceChildren();
    return;
  }
  const bottleneck = snapshot.bottleneck;
  const vars = { ...bottleneck.adviceVars };
  if (vars.bayKey) vars.bay = t(lang, vars.bayKey);
  advice.textContent = t(lang, bottleneck.adviceKey, vars);
  stats.replaceChildren();
  for (const item of (bottleneck.stats || []).slice(0, 2)) {
    const pill = document.createElement("span");
    pill.className = `ops-stat is-${item.tone || "load"}`;
    pill.textContent = t(lang, item.key, item.vars || {});
    stats.append(pill);
  }
  card.hidden = false;
}

export function renderKpi(lang, kpi) {
  const card = document.getElementById("kpi-card");
  const cycle = document.getElementById("kpi-cycle");
  const throughput = document.getElementById("kpi-throughput");
  const availability = document.getElementById("kpi-availability");
  const target = document.getElementById("kpi-target");
  if (!cycle || !throughput || !availability) return;
  if (card) card.hidden = !kpi;
  if (!kpi) {
    cycle.textContent = "—";
    throughput.textContent = "—";
    availability.textContent = "—";
    if (target) target.textContent = "—";
    return;
  }
  cycle.textContent = t(lang, "kpiCycleValue", { n: kpi.cycleMin });
  throughput.textContent = t(lang, "kpiThroughputValue", { n: kpi.throughput });
  availability.textContent = t(lang, "kpiAvailabilityValue", { n: kpi.availability });
  if (target) {
    target.textContent = t(lang, "kpiTargetActual", {
      target: kpi.targetOut ?? "—",
      actual: kpi.actualOut ?? kpi.throughput,
    });
  }
}

export function renderDispatch(lang, session) {
  const rule = session?.dispatchRule || "FIFO";
  document.querySelectorAll("[data-dispatch]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.dispatch === rule));
  });
  const now = document.getElementById("dispatch-now");
  if (now) now.textContent = t(lang, rule === "HOT" ? "dispatchHot" : "dispatchFifo");
}

function hotButton(lang, id, on) {
  const mark = document.createElement("i");
  mark.dataset.hot = id;
  mark.className = on ? "is-hot" : "";
  mark.textContent = on ? t(lang, "hotMark") : t(lang, "hotMarkOff");
  return mark;
}

export function renderCompanions(lang, companions, selectedId, session = null) {
  const list = document.getElementById("companion-list");
  if (!list) return;
  const heroId = session?.lot?.id || "";
  const hot = session?.hotLots;
  const rows = session
    ? orderLots([
      {
        id: heroId,
        arrival: 100,
        hot: !!hot?.has?.(heroId),
        hero: true,
        tool: session.step?.().tool || "",
      },
      ...(companions || []).map((lot, index) => ({
        ...lot,
        arrival: index,
        hot: !!hot?.has?.(lot.id),
      })),
    ], session.dispatchRule || "FIFO")
    : [
      { id: heroId, hero: true, hot: false, tool: "" },
      ...(companions || []).map((lot) => ({ ...lot, hero: false, hot: false })),
    ];
  list.replaceChildren();
  rows.forEach((lot, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "companion-chip";
    if (lot.hero) {
      btn.dataset.lot = "";
      btn.setAttribute("aria-pressed", String(!selectedId));
    } else {
      btn.dataset.lot = lot.id;
      btn.setAttribute("aria-pressed", String(selectedId === lot.id));
    }
    const label = document.createElement("span");
    const name = lot.hero ? t(lang, "companionHero") : `${lot.id} · ${lot.tool}`;
    label.textContent = `${index + 1} ${name}`;
    btn.append(label);
    if (session && (lot.hero ? heroId : lot.id)) btn.append(hotButton(lang, lot.hero ? heroId : lot.id, !!lot.hot));
    list.append(btn);
  });
  const kicker = document.querySelector(".companion-kicker");
  if (kicker && session) {
    kicker.textContent = `${t(lang, "companionKicker")} · ${t(lang, session.dispatchRule === "HOT" ? "dispatchHot" : "dispatchFifo")}`;
  }
}

export function renderScenarioChoices(lang, product, selected) {
  const row = document.getElementById("scenario-row");
  if (!row) return;
  const options = scenariosForProduct(product);
  row.replaceChildren();
  for (const id of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.scenario = id;
    btn.textContent = t(lang, `scenario_${id}`);
    btn.setAttribute("aria-pressed", String(id === selected));
    row.append(btn);
  }
}

const CHOICE_WORD = { rework: "dispRework", scrap: "dispScrap", release: "dispRelease", contain: "dispContain", wait: "hold_kgd_wait", partial: "hold_kgd_partial", bake: "hold_warpage_bake" };

export function showDone(lang, session, els, elapsed = 0) {
  const lot = session.lot;
  const scrapped = lot.outcome === "scrap";
  els.doneLayer.hidden = false;
  const title = document.getElementById("done-title");
  if (title) title.textContent = t(lang, scrapped ? "doneTitleScrap" : "doneTitle");
  els.doneSummary.textContent = scrapped
    ? t(lang, "doneSummaryScrap", {
      lot: lot.id,
      step: session.holdsResolved.filter((row) => row.action === "scrap").map((row) => row.id).join(", ") || "—",
      scrap: lot.scrap,
    })
    : t(lang, "doneSummary", {
      lot: lot.id,
      good: lot.goodSites,
      scrap: lot.scrap,
      holds: session.holdsResolved.length,
      sn: lot.unit,
    });
  const happened = document.getElementById("aar-happened");
  const guidance = document.getElementById("aar-guidance");
  const stats = document.getElementById("aar-stats");
  const choices = document.getElementById("aar-choices");
  const yieldLine = document.getElementById("aar-yield");
  if (!happened || !guidance || !stats) return;
  const selected = null;
  const review = buildAfterAction(session, buildKpiFromSession(session, elapsed, selected));
  happened.textContent = scrapped
    ? t(lang, "aarScrap", { id: review.choices.filter((row) => row.action === "scrap").map((row) => row.id).join(", ") || "—" })
    : t(lang, review.happenedKey);
  guidance.textContent = t(lang, review.guidanceKey);
  stats.replaceChildren();
  for (const item of afterActionFigures(review)) {
    const pill = document.createElement("span");
    pill.className = "ops-stat";
    pill.textContent = t(lang, item.key, { n: item.n });
    stats.append(pill);
  }
  if (review.targetOut != null) {
    const pill = document.createElement("span");
    pill.className = "ops-stat";
    pill.textContent = t(lang, "kpiTargetActual", { target: review.targetOut, actual: review.actualOut });
    stats.append(pill);
  }
  if (choices) {
    choices.textContent = review.choices.length
      ? review.choices.map((row) => {
        const word = CHOICE_WORD[row.action] ? t(lang, CHOICE_WORD[row.action]) : row.action;
        const contained = row.contained ? `${t(lang, "dispContain")} · ` : "";
        return t(lang, "aarChoice", { id: `${contained}${row.id}`, action: word });
      }).join("  ")
      : "";
  }
  if (yieldLine) {
    yieldLine.textContent = review.yield
      ? t(lang, "aarYield", { step: review.yield.stepId, y: review.yield.yieldPct, bins: review.yield.bins })
      : "";
  }
}
