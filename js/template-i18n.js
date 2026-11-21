/**
 * Copy for the CoWoS-S template. Traditional Chinese first.
 * Parameters on screen are typical training values, not a production recipe.
 */
import { MODULES, STAGES, STEPS } from "./flow-data.js";

const MORPH = {
  bank: ["未加工矽片", "未加工硅片", "Bare silicon"],
  bumped: ["已植 μBump", "已植 μBump", "Bumped interposer"],
  issued: ["已發 KGD", "已发 KGD", "KGD issued"],
  bonded: ["CoW 已鍵合", "CoW 已键合", "CoW bonded"],
  cowfill: ["CoW 已底填", "CoW 已底填", "CoW underfilled"],
  os: ["已貼載板", "已贴载板", "On substrate"],
  underfilled: ["二次底填", "二次底填", "Second underfill"],
  balled: ["已植球", "已植球", "Balled"],
  molded: ["已模塑", "已模塑", "Molded"],
  marked: ["已打標", "已打标", "Marked"],
  packed: ["已包裝", "已包装", "Packed"],
};

function build(lang, index) {
  const out = {};
  for (const mod of MODULES) {
    out[`bay_${mod.id}`] = `M${mod.id.slice(1)} ${mod.name[index]}`;
    out[`opsBay_${mod.id}`] = out[`bay_${mod.id}`];
  }
  for (const stage of STAGES) {
    out[`stage_${stage.id}`] = `${stage.code} ${stage.name[index]}`;
  }
  for (const step of STEPS) {
    out[`step_${step.id}`] = step.name[index];
    out[`chg_${step.id}`] = index === 2
      ? `${step.name[2]}. Typical training value, not a production recipe.`
      : index === 1
        ? `${step.name[1]}。培训典型值，不是量产配方。`
        : `${step.name[0]}。培訓典型值，不是量產配方。`;
    out[`out_${step.id}`] = index === 2
      ? `Out: ${MORPH[step.morphOut][2]}.`
      : `出去：${MORPH[step.morphOut][index]}。`;
    out[`carrier_${step.id}`] = step.carrier === "TRAY"
      ? (index === 2 ? "JEDEC tray" : "JEDEC tray")
      : step.carrier === "MAG"
        ? (index === 2 ? "Substrate magazine" : index === 1 ? "载板 magazine" : "載板 magazine")
        : "FOUP";
  }
  out.step_s12_issue = index === 2 ? "KGD issue" : index === 1 ? "KGD 发料" : "KGD 發料";
  out.step_s12_attach = index === 2 ? "Die on substrate" : index === 1 ? "晶粒贴载板" : "晶粒貼載板";
  out.chg_s12_issue = out.chg_s213;
  out.chg_s12_attach = out.chg_s412;
  out.out_s12_issue = out.out_s213;
  out.out_s12_attach = out.out_s412;
  out.carrier_s12_issue = index === 2 ? "KGD tray" : "KGD 托盤";
  out.carrier_s12_attach = "JEDEC tray";
  for (const [morph, names] of Object.entries(MORPH)) {
    out[`morph_${morph}`] = names[index];
    out[`cap_${morph}`] = names[index];
  }
  const note = index === 2
    ? "Parameters are typical training values from a public reference template, not a production recipe. This is not a TSMC plant."
    : index === 1
      ? "参数是公开参考模板的行业典型值，仅供培训，不是量产配方。这里不是台积电厂房。"
      : "參數是公開參考模板的行業典型值，僅供培訓，不是量產配方。這裡不是台積電廠房。";
  out.trainNote = note;
  out.tagline = index === 2
    ? `CoWoS-S training route · 5 modules, 18 stages, 86 steps. ${note}`
    : index === 1
      ? `CoWoS-S 培训路线 · 5 个模块、18 段、86 步。${note}`
      : `CoWoS-S 培訓路線 · 5 個模組、18 段、86 步。${note}`;
  out.helpHint = index === 2
    ? `Space advances · R replays · the flow bar is Module → Stage → Step. ${note}`
    : index === 1
      ? `空格推进 · R 重播 · 流程列是模块 → 工序段 → 工步。${note}`
      : `空白鍵推進 · R 重播 · 流程列是模組 → 工序段 → 工步。${note}`;
  out.prod_hbx100_blurb = index === 2
    ? "Full CoWoS-S template: interposer, 1 GPU + 8 HBM3E, ABF, μBump and TCB. 86 steps."
    : index === 1
      ? "完整 CoWoS-S 模板：中介层、1 颗 GPU + 8 颗 HBM3E、ABF、μBump 与 TCB。86 步。"
      : "完整 CoWoS-S 模板：中介層、1 顆 GPU + 8 顆 HBM3E、ABF、μBump 與 TCB。86 步。";
  out.prod_hbx100_story = out.prod_hbx100_blurb;
  out.prod_hbx240_blurb = index === 2
    ? "Same 86-step backbone. More KGD, tighter align and warpage, a different ball map, test program, and mark."
    : index === 1
      ? "同一条 86 步。KGD 更多，对位和翘曲更紧，锡球、终测程式和印字不同。"
      : "同一條 86 步。KGD 更多，對位和翹曲更緊，錫球、終測程式和印字不同。";
  out.prod_hbx240_story = out.prod_hbx240_blurb;
  out.prod_hbxs12_blurb = index === 2
    ? "Single-die substrate route. Skips interposer fab and CoW. Keeps die and substrate prep, attach, underfill, BGA, and a final-test subset."
    : index === 1
      ? "单晶粒基板路线。跳过中介层制备和 CoW。保留晶粒与载板准备、贴装、底填、BGA 和一段封测。"
      : "單晶粒基板路線。跳過中介層製備和 CoW。保留晶粒與載板準備、貼裝、底填、BGA 和一段封測。";
  out.prod_hbxs12_story = out.prod_hbxs12_blurb;
  out.hold_overlay_title = index === 2 ? "Bond offset · shift metrology" : index === 1 ? "键合偏移 · 贴装量测" : "鍵合偏移 · 貼裝量測";
  out.hold_overlay_sym = index === 2
    ? "The stack sits off the bond target. Rework returns to thermocompression. Later morphs stay uncommitted."
    : index === 1
      ? "叠晶偏离键合目标。重做回到热压。后面的形态先不提交。"
      : "疊晶偏離鍵合目標。重做回到熱壓。後面的形態先不提交。";
  out.hold_overlay_rework = index === 2 ? "Rework at TCB" : index === 1 ? "回到热压重做" : "回到熱壓重做";
  out.hold_overlay_rework_s = index === 2
    ? "Return to the thermocompression step, then cooldown and shift metrology."
    : index === 1
      ? "回到热压，再冷却、再量测偏移。"
      : "回到熱壓，再冷卻、再量測偏移。";
  out.hold_warpage_sym = index === 2
    ? "The substrate is bent. Balls stay off. Rework returns to the CoW attach, then underfill and cure."
    : index === 1
      ? "载板是翘的。锡球先不出现。重做回到贴装，再底填、固化。"
      : "載板是翹的。錫球先不出現。重做回到貼裝，再底填、固化。";
  out.hold_warpage_rework = index === 2 ? "Rework at attach" : index === 1 ? "回到贴装重做" : "回到貼裝重做";
  out.hold_void_sym = index === 2
    ? "The fillet has a void. Cure stays uncommitted until this dispense is redone."
    : index === 1
      ? "胶里有空洞。这步点胶重做之前，固化先不提交。"
      : "膠裡有空洞。這步點膠重做之前，固化先不提交。";
  out.scenarioToast_overlay = index === 2
    ? "Shift metrology is already holding this lot for bond offset."
    : index === 1
      ? "贴装偏移量测已经把这批停在键合偏移。"
      : "貼裝偏移量測已經把這批停在鍵合偏移。";
  out.scenarioToast_warpage = index === 2
    ? "Warpage metrology is already holding this lot. Balls stay off."
    : index === 1
      ? "翘曲量测已经把这批停住。锡球还不会出现。"
      : "翹曲量測已經把這批停住。錫球還不會出現。";
  out.aarHappened_overlay = index === 2
    ? "Shift metrology caught a bond offset. The lot stayed there."
    : index === 1
      ? "贴装偏移量测抓到键合偏移，这批锁在当站。"
      : "貼裝偏移量測抓到鍵合偏移，這批鎖在當站。";
  out.aarShould_overlay = index === 2
    ? "Rework at thermocompression, or ask PE to sign off."
    : index === 1
      ? "回到热压重做，或请 PE 签核后才放行。"
      : "回到熱壓重做，或請 PE 簽核後才放行。";
  out.aarHappened_warpage = index === 2
    ? "Warpage metrology saw a bent substrate. Balls did not appear."
    : index === 1
      ? "翘曲量测看到载板是翘的，锡球没有出现。"
      : "翹曲量測看到載板是翹的，錫球沒有出現。";
  out.aarHappened_first = index === 2
    ? "This lot walked the CoWoS-S template without a hold stopping it."
    : index === 1
      ? "这批走完 CoWoS-S 模板，没有 HOLD 把它停住。"
      : "這批走完 CoWoS-S 模板，沒有 HOLD 把它停住。";
  out.opsAdvice_queue_tcb = index === 2
    ? "TCB {tool} has the longest queue, {queue} lots. The bonder is the bottleneck."
    : index === 1
      ? "TCB {tool} 前面排了 {queue} 批，键合是瓶颈。"
      : "TCB {tool} 前面排了 {queue} 批，鍵合是瓶頸。";
  out.opsAdvice_hold_overlay = index === 2
    ? "Shift metrology {tool} is holding a bond offset. Clear it before the lot moves on."
    : index === 1
      ? "贴装量测 {tool} 开着键合偏移。先处理这张 HOLD。"
      : "貼裝量測 {tool} 開著鍵合偏移。先處理這張 HOLD。";
  out.opsAdvice_hold_kgd = index === 2
    ? "Probe {tool} cannot issue KGD. Replenish the die bank first."
    : index === 1
      ? "探针 {tool} 发不出 KGD。先补晶粒仓。"
      : "探針 {tool} 發不出 KGD。先補晶粒倉。";
  out.opsAdvice_kgd = index === 2
    ? "DBK is locked, so prep cannot issue KGD. No other tool is down because of this."
    : index === 1
      ? "晶粒仓锁着，准备区发不出 KGD。其他机台没有因此当机。"
      : "晶粒倉鎖著，準備區發不出 KGD。其他機台沒有因此當機。";
  out.opsAdvice_hold_warpage = index === 2
    ? "Warpage metrology {tool} is holding this lot. Balls stay off."
    : index === 1
      ? "翘曲量测 {tool} 把这批停住。锡球先不要上。"
      : "翹曲量測 {tool} 把這批停住。錫球先不要上。";
  out.startLede = out.tagline;
  out.productBlurb = out.prod_hbx100_blurb;
  return out;
}

export const TEMPLATE_COPY = {
  "zh-TW": build("zh-TW", 0),
  "zh-CN": build("zh-CN", 1),
  en: build("en", 2),
};
