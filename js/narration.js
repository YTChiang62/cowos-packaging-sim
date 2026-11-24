/**
 * Per-step training narration.
 * Scripts use the same module, stage, step, carrier, and morph labels as the HUD.
 * Speech is the browser's speechSynthesis. There is no cloud TTS and no extra runtime.
 * A missing engine shows the same line on the traveler and opens the gate after a short read.
 * Speech mode keeps the live utterance on the narration instance. Chrome can collect
 * a local utterance or drop onend; tick() then opens the same gate after a generous read.
 */

import { t } from "./i18n.js";
import { moduleById, stageById } from "./route.js";

export const FALLBACK_READ_SEC = 2.4;

const FEMALE = /female|woman|\bZira\b|\bSamantha\b|\bVictoria\b|\bKaren\b|\bMoira\b|\bTessa\b|\bFiona\b|\bSusan\b|\bKathy\b|\bSerena\b|\bAria\b|\bJenny\b|\bSonia\b|\bHuihui\b|\bYaoyao\b|\bXiaoxiao\b|\bXiaoyi\b|\bXiaohan\b|\bHanhan\b|\bYating\b|\bHsiao\b|\bMei-Jia\b|\bSin-Ji\b|\bTing-Ting\b|女声|女聲/i;
const MALE = /\bmale\b|\bDavid\b|\bMark\b|\bAlex\b|\bDaniel\b|\bFred\b|\bRishi\b|\bGuy\b|\bKangkang\b|\bZhiwei\b|\bYunyang\b|\bYunxi\b|男声|男聲/i;

export function langIndex(lang) {
  if (lang === "en") return 2;
  if (lang === "zh-CN") return 1;
  return 0;
}

export function bcp47(lang) {
  if (lang === "en") return "en-US";
  if (lang === "zh-CN") return "zh-CN";
  return "zh-TW";
}

/** Modest pace change. 4× does not truncate the spoken line. */
export function speechRateFor(speed) {
  const s = Number(speed) || 1;
  if (s <= 0.5) return 0.92;
  if (s >= 4) return 1.15;
  if (s >= 2) return 1.08;
  return 1;
}

const WATCHDOG_MIN_SEC = 8;
const WATCHDOG_MAX_SEC = 90;
const WATCHDOG_FACTOR = 1.5;
const WATCHDOG_PAD_SEC = 3;
/** ~150 words/min at rate 1, before the generous factor. */
const EN_SEC_PER_WORD = 0.4;
/** ~4 characters/sec at rate 1, before the generous factor. */
const ZH_SEC_PER_CHAR = 0.25;

/**
 * How long speech mode waits for onend before the step is treated as spoken.
 * English is estimated per word, Chinese per character, then stretched by 1.5
 * plus a few seconds. Clamped so a short line cannot expire immediately and a
 * huge line cannot hold the lot forever.
 */
export function speechWatchdogSec(text, lang, rate) {
  const pace = Math.max(0.5, Number(rate) || 1);
  const spoken = String(text || "");
  const english = lang === "en" || String(lang || "").toLowerCase().startsWith("en-");
  let base;
  if (english) {
    const words = spoken.trim() ? spoken.trim().split(/\s+/).length : 1;
    base = (words * EN_SEC_PER_WORD) / pace;
  } else {
    const chars = Array.from(spoken.replace(/\s+/g, "")).length || 1;
    base = (chars * ZH_SEC_PER_CHAR) / pace;
  }
  const padded = base * WATCHDOG_FACTOR + WATCHDOG_PAD_SEC;
  return Math.min(WATCHDOG_MAX_SEC, Math.max(WATCHDOG_MIN_SEC, padded));
}

export function voiceScore(voice, lang) {
  if (!voice) return -1;
  const name = `${voice.name || ""} ${voice.voiceURI || ""}`;
  const vlang = String(voice.lang || "").toLowerCase().replace(/_/g, "-");
  let score = 0;
  if (lang === "en") {
    if (vlang.startsWith("en")) score += 50;
  } else if (lang === "zh-CN") {
    if (vlang.startsWith("zh-cn") || vlang.includes("hans")) score += 50;
    else if (vlang.startsWith("zh") && !vlang.includes("tw") && !vlang.includes("hk") && !vlang.includes("hant")) score += 42;
  } else {
    if (vlang.startsWith("zh-tw") || vlang.includes("hant")) score += 50;
    else if (vlang.startsWith("zh-hk")) score += 44;
    else if (vlang.startsWith("zh")) score += 18;
  }
  const female = voice.gender === "female" || FEMALE.test(name);
  const male = voice.gender === "male" || (MALE.test(name) && !female);
  if (female) score += 20;
  if (male) score -= 5;
  return score;
}

/** Female voice in the UI language, or the best voice that actually speaks that language. */
export function selectVoice(voices, lang) {
  const list = Array.isArray(voices) ? voices.filter(Boolean) : [];
  let best = null;
  let bestScore = 39;
  for (const voice of list) {
    const score = voiceScore(voice, lang);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

function paramPhrase(lang, product, step) {
  const recipe = product?.recipes?.[step.recipe];
  const params = recipe?.params || [];
  if (!params.length) return "";
  const joiner = lang === "en" ? ", " : "、";
  return params.slice(0, 4).map((param) => {
    const key = "p_" + param.id;
    const label = t(lang, key);
    const name = label === key ? param.name : label;
    const unit = param.unit ? ` ${param.unit}` : "";
    return `${name} ${param.value}${unit}`;
  }).join(joiner);
}

/**
 * Spoken training line for one runnable step.
 * Labels are the same strings the traveler prints for this UI language.
 */
export function narrationScript(lang, step, product) {
  if (!step) return "";
  const ui = lang === "en" || lang === "zh-CN" || lang === "zh-TW" ? lang : "zh-TW";
  const index = langIndex(ui);
  const mod = moduleById(step.module);
  const stage = stageById(step.stage);
  const modName = mod ? mod.name[index] : t(ui, "bay_" + step.module);
  const stageName = stage ? stage.name[index] : "";
  const stageCode = stage?.code || step.code;
  const stepName = t(ui, "step_" + step.id);
  const change = t(ui, "chg_" + step.id);
  const note = change.startsWith(stepName)
    ? change.slice(stepName.length).replace(/^[.\s。]+/, "")
    : change;
  const carrier = t(ui, "carrier_" + step.id);
  const morphIn = t(ui, "morph_" + step.morphIn);
  const morphOut = t(ui, "morph_" + step.morphOut);
  const params = paramPhrase(ui, product, step);
  const spokenNote = note ? `${note} ` : "";
  if (ui === "en") {
    const recipe = params ? ` Recipe ${step.recipe}: ${params}.` : "";
    return `${modName}. Stage ${stageCode} ${stageName}. Step ${step.code} ${stepName}, tool ${step.tool}. ${spokenNote}Carrier ${carrier}. Incoming ${morphIn}, outgoing ${morphOut}.${recipe}`;
  }
  if (ui === "zh-CN") {
    const recipe = params ? `配方 ${step.recipe}：${params}。` : "";
    return `${modName}。阶段 ${stageCode} ${stageName}。工步 ${step.code} ${stepName}，机台 ${step.tool}。${spokenNote}载具 ${carrier}。进站 ${morphIn}，出站 ${morphOut}。${recipe}`;
  }
  const recipe = params ? `配方 ${step.recipe}：${params}。` : "";
  return `${modName}。階段 ${stageCode} ${stageName}。工步 ${step.code} ${stepName}，機台 ${step.tool}。${spokenNote}載具 ${carrier}。進站 ${morphIn}，出站 ${morphOut}。${recipe}`;
}

export function requiredNarrationIds(product) {
  return (product?.flow || []).map((step) => step.id);
}

function makeUtterance(text, synth) {
  if (!synth?.fake && typeof SpeechSynthesisUtterance === "function") {
    return new SpeechSynthesisUtterance(text);
  }
  return { text, lang: "", rate: 1, voice: null, onend: null, onerror: null };
}

function browserSynth() {
  if (typeof window === "undefined") return null;
  const synth = window.speechSynthesis;
  if (!synth || typeof synth.speak !== "function" || typeof window.SpeechSynthesisUtterance !== "function") return null;
  return synth;
}

/**
 * Gate plus the speech engine.
 * `doneFor(step, lang)` stays false until the current utterance ends, mute skips it,
 * the speech watchdog elapses, or the silent-browser read timer elapses.
 */
export class Narration {
  constructor(synth) {
    this.synth = synth === undefined ? browserSynth() : synth;
    this.enabled = true;
    this.mode = this.synth ? "speech" : "fallback";
    this.caption = "";
    this.speaking = false;
    this.paused = false;
    this.interrupted = false;
    this.gateStepId = null;
    this.gateLang = null;
    this.gateDone = false;
    this.speakCount = 0;
    this.lastText = "";
    this.lastLang = "";
    this.lastRate = 1;
    this.lastVoice = "";
    this.oncaption = null;
    this._token = 0;
    this._endToken = null;
    this._utter = null;
    this._watchGate = false;
    this._acc = 0;
    this._need = FALLBACK_READ_SEC;
    this._aside = false;
    this._gateStep = null;
    this._gateProduct = null;
    this._gateSpeed = 1;
    this._retriedVoice = false;
    this._listenVoices();
  }

  doneFor(stepId, lang) {
    if (this.enabled === false) return true;
    return this.gateDone === true && this.gateStepId === stepId && this.gateLang === lang;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) {
      this._token += 1;
      this._stopAudio();
      this.speaking = false;
      this.paused = false;
      this._aside = false;
      this.gateDone = true;
      this.interrupted = false;
    }
  }

  /** Cancel audio. The step is not marked spoken, so a later start can say it again. */
  halt() {
    this._token += 1;
    this._stopAudio();
    this.speaking = false;
    this.paused = false;
    this._aside = false;
    this.interrupted = true;
  }

  /** Drop lot state. The on/off choice stays. */
  reset() {
    this.halt();
    this.interrupted = false;
    this.gateDone = false;
    this.gateStepId = null;
    this.gateLang = null;
    this.caption = "";
    this._gateStep = null;
    this._acc = 0;
  }

  finish() {
    this.gateDone = true;
    this.speaking = false;
    this.paused = false;
    this._acc = this._need;
  }

  tick(dt) {
    if (!this.enabled || this.gateDone || this.paused) return;
    const step = Math.max(0, Number(dt) || 0);
    if (!step) return;
    if (this.mode === "fallback") {
      this._acc += step;
      if (this._acc >= this._need) this.finish();
      return;
    }
    if (this.mode !== "speech" || !this.speaking) return;
    this._acc += step;
    if (this._acc >= this._need) this._expireWatchdog();
  }

  pause() {
    if (!this.speaking || this.gateDone) return;
    this.paused = true;
    try { this.synth?.pause?.(); } catch { /* ignore */ }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    try { this.synth?.resume?.(); } catch { /* ignore */ }
  }

  speakStep(step, product, lang, speed, opts = {}) {
    if (!step) return;
    const ui = lang || "zh-TW";
    const text = narrationScript(ui, step, product);
    this.caption = text;
    this._gateStep = step;
    this._gateProduct = product;
    this._gateSpeed = speed;
    if (!this.enabled) {
      if (this.gateStepId === step.id && this.gateLang === ui && this.gateDone && this.caption === text) return;
      this.gateStepId = step.id;
      this.gateLang = ui;
      this.gateDone = true;
      this.interrupted = false;
      this.oncaption?.();
      return;
    }
    const same = this.gateStepId === step.id && this.gateLang === ui;
    const fallbackRunning = same && this.mode === "fallback" && !this.gateDone;
    if (!opts.force && !this._aside && same && (this.speaking || this.gateDone || fallbackRunning)) return;
    if (this.gateStepId !== step.id) this._retriedVoice = false;
    this.gateStepId = step.id;
    this.gateLang = ui;
    this.gateDone = false;
    this.interrupted = false;
    this._aside = false;
    this.paused = false;
    this._token += 1;
    if (!this.synth) this._armFallback(text);
    else this._armSpeech(text, ui, speed, true);
    this.oncaption?.();
  }

  speakAside(step, product, lang, speed) {
    if (!this.enabled || !step) return;
    const ui = lang || this.gateLang || "zh-TW";
    if (this.gateStepId === step.id && this.gateLang === ui && this.speaking && !this._aside) return;
    const text = narrationScript(ui, step, product);
    this.caption = text;
    this._aside = true;
    this._token += 1;
    if (!this.synth) {
      this.oncaption?.();
      return;
    }
    this._armSpeech(text, ui, speed, false);
    this.oncaption?.();
  }

  resumeGate() {
    if (!this.enabled || !this._gateStep || this.gateDone) {
      this._aside = false;
      return;
    }
    if (this.speaking && !this._aside) return;
    this.speakStep(this._gateStep, this._gateProduct, this.gateLang, this._gateSpeed, { force: true });
  }

  _armFallback(text) {
    this.mode = "fallback";
    this.speaking = false;
    this.paused = false;
    this._acc = 0;
    const extra = Math.min(1.4, String(text || "").length / 220);
    this._need = FALLBACK_READ_SEC + extra;
  }

  _armSpeech(text, lang, speed, gate) {
    this.mode = "speech";
    const token = this._token;
    try {
      const utter = makeUtterance(text, this.synth);
      utter.lang = bcp47(lang);
      utter.rate = speechRateFor(speed);
      const voice = selectVoice(this.synth.getVoices?.() || [], lang);
      if (voice) utter.voice = voice;
      utter.onend = () => this._ended(token, gate);
      utter.onerror = (event) => this._onSpeechError(token, gate, event);
      this._stopAudio();
      // Keep the utterance reachable. Chrome collects a local const and then never fires onend.
      this._utter = utter;
      this._watchGate = !!gate;
      this._acc = 0;
      this._need = speechWatchdogSec(text, lang, utter.rate);
      this.synth.speak(utter);
      this.speaking = true;
      this.paused = false;
      this.speakCount += 1;
      this.lastText = text;
      this.lastLang = utter.lang;
      this.lastRate = utter.rate;
      this.lastVoice = voice?.name || "";
    } catch {
      this._stopAudio();
      if (gate) this._armFallback(text);
      else this._ended(token, false);
    }
  }

  /** onend never arrived. Same release as a finished utterance, for this token only. */
  _expireWatchdog() {
    if (!this.speaking || this.gateDone) return;
    const token = this._token;
    const gate = this._watchGate;
    this._stopAudio();
    this.speaking = false;
    this.paused = false;
    this._ended(token, gate);
  }

  _ended(token, gate) {
    if (token !== this._token || this._endToken === token) return;
    this._endToken = token;
    this._dropUtterance();
    this._acc = 0;
    this.speaking = false;
    this.paused = false;
    if (!gate) {
      this._aside = false;
      if (this.enabled && this._gateStep && !this.gateDone && !this.interrupted) {
        this.speakStep(this._gateStep, this._gateProduct, this.gateLang, this._gateSpeed, { force: true });
      }
      return;
    }
    this.gateDone = true;
  }

  _onSpeechError(token, gate, event) {
    if (token !== this._token || this._endToken === token) return;
    const reason = String(event?.error || "").toLowerCase();
    // cancel() reports interrupted/canceled. That is our own stop, not a finished line.
    if (reason === "interrupted" || reason === "canceled" || reason === "cancelled") return;
    this._dropUtterance();
    this._acc = 0;
    this._ended(token, gate);
  }

  _dropUtterance() {
    const utter = this._utter;
    this._utter = null;
    if (!utter) return;
    utter.onend = null;
    utter.onerror = null;
  }

  _stopAudio() {
    this._dropUtterance();
    if (this.mode === "speech") this._acc = 0;
    try { this.synth?.cancel?.(); } catch { /* ignore */ }
  }

  _listenVoices() {
    const synth = this.synth;
    if (!synth || typeof synth.addEventListener !== "function") return;
    synth.addEventListener("voiceschanged", () => {
      if (this._retriedVoice || !this.speaking || this._aside || !this._gateStep) return;
      if (this.lastVoice) return;
      const voice = selectVoice(synth.getVoices?.() || [], this.gateLang || "zh-TW");
      if (!voice) return;
      this._retriedVoice = true;
      this.speakStep(this._gateStep, this._gateProduct, this.gateLang, this._gateSpeed, { force: true });
    });
  }
}

export function createNarration(synth) {
  return new Narration(synth);
}

/** Node tests drive onend / onerror without audio hardware. */
export function createFakeSynth(voices = []) {
  const synth = {
    fake: true,
    speaking: false,
    paused: false,
    voices: voices.slice(),
    speakCount: 0,
    current: null,
    getVoices() { return this.voices; },
    cancel() {
      this.speaking = false;
      this.paused = false;
      const utter = this.current;
      this.current = null;
      if (!utter || utter._cancelled) return;
      utter._cancelled = true;
      // Chrome reports a cancel as an utterance error. Handlers cleared first must not run.
      try { utter.onerror?.({ error: "canceled" }); } catch { /* ignore */ }
    },
    pause() { this.paused = true; },
    resume() { this.paused = false; },
    speak(utter) {
      this.current = utter;
      this.speaking = true;
      this.paused = false;
      this.speakCount += 1;
    },
    end() {
      const utter = this.current;
      if (!utter || utter._cancelled) return;
      this.speaking = false;
      this.current = null;
      utter.onend?.();
    },
    fail(error = "synthesis-failed") {
      const utter = this.current;
      if (!utter || utter._cancelled) return;
      this.speaking = false;
      this.current = null;
      utter.onerror?.({ error });
    },
  };
  return synth;
}
