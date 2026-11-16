import * as THREE from "three";
import { box, cyl, mat } from "./mat.js";
import { motion, specForMorph } from "./morph.js";

const FONT = "600 54px 'Sora','WenQuanYi Micro Hei','Droid Sans Fallback','Noto Sans CJK TC','Microsoft JhengHei',sans-serif";

function fadeMaterial(material, op) {
  const o = Math.min(1, Math.max(0, op));
  material.opacity = o;
  material.transparent = true;
  material.depthWrite = o > 0.85;
  return o > 0.04;
}

function fadeMat(color, opts = {}) {
  const m = mat(color, { ...opts, transparent: true, opacity: opts.opacity ?? 1 });
  m.userData.fade = true;
  return m;
}

export class Workpiece {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "hbx-workpiece";
    this.compact = false;
    this._caption = "";
    this._build();
  }

  _build() {
    const g = this.group;

    this.waferMat = fadeMat(0xb7c4ce, { metalness: 0.82, roughness: 0.16 });
    this.wafer = new THREE.Group();
    const disc = cyl(this.wafer, 0.9, 0.9, 0.045, this.waferMat, 0, 0, 0, 40);
    disc.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.02, 8, 40), this.waferMat);
    rim.rotation.x = Math.PI / 2;
    this.wafer.add(rim);
    this.ringMat = fadeMat(0xff6b7a, { emissive: 0xff6b7a, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.1 });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 32), this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.04;
    this.wafer.add(this.ring);
    this.fidMat = fadeMat(0xe6c36a, { emissive: 0x8a5a12, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.3 });
    this.fiducials = new THREE.Group();
    for (const [x, z] of [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.16], [0.2, 0.16]]) {
      box(this.fiducials, 0.06, 0.012, 0.06, this.fidMat, x, 0.035, z);
    }
    this.wafer.add(this.fiducials);
    g.add(this.wafer);

    this.tapeMat = fadeMat(0x2a4d8a, { roughness: 0.55, metalness: 0.05, opacity: 0.8 });
    this.tape = cyl(g, 1.02, 1.02, 0.02, this.tapeMat, 0, 0.02, 0, 40);
    this.frameMat = fadeMat(0xd5dbe2, { metalness: 0.75, roughness: 0.28 });
    this.frame = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.045, 10, 40), this.frameMat);
    this.frame.rotation.x = Math.PI / 2;
    this.frame.position.y = 0.04;
    g.add(this.frame);

    this.kerfMat = mat(0xd7f4ff, { emissive: 0x9fd4ff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });
    this.kerfX = box(g, 1.9, 0.02, 0.035, this.kerfMat, 0, 0.09, 0);
    this.kerfZ = box(g, 0.035, 0.02, 1.9, this.kerfMat, 0, 0.095, 0);

    this.pocketMat = fadeMat(0x4a3a28, { roughness: 0.7, metalness: 0.15 });
    this.pockets = new THREE.Group();
    const pocketAt = [
      [-0.55, 0.22],
      [-0.55, -0.28],
      [-0.55, -0.62],
      [-0.12, -0.28],
      [-0.12, 0.22],
    ];
    this.pocketMeshes = pocketAt.map(([x, z], i) => {
      const p = box(this.pockets, i === 0 ? 0.5 : 0.36, 0.025, i === 0 ? 0.44 : 0.3, this.pocketMat, x, 0.02, z);
      return p;
    });
    g.add(this.pockets);

    this.stack = new THREE.Group();
    this.couponMat = fadeMat(0x9aabb4, { metalness: 0.65, roughness: 0.28 });
    this.coupon = box(this.stack, 0.52, 0.04, 0.46, this.couponMat, 0, 0.02, 0);
    this.bond = new THREE.Group();
    box(this.bond, 0.56, 0.012, 0.5, mat(0x5c4328, { metalness: 0.5, roughness: 0.4 }), 0, 0, 0);
    this.bondGlowMat = mat(0xffd27a, {
      metalness: 0.65, roughness: 0.2, emissive: 0xe0a040, emissiveIntensity: 0.85,
    });
    box(this.bond, 0.5, 0.02, 0.44, this.bondGlowMat, 0, 0.016, 0);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.018, 8, 28),
      mat(0xffd27a, { metalness: 0.6, roughness: 0.25, emissive: 0xe0a040, emissiveIntensity: 0.7 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.03;
    this.bond.add(halo);
    this.stack.add(this.bond);
    this.logicMat = mat(0xd7ebe7, { roughness: 0.38, metalness: 0.28 });
    this.logic = box(this.stack, 0.4, 0.075, 0.34, this.logicMat, 0, 0, 0);
    this.hbmMat = mat(0x3ee0c0, { roughness: 0.35, metalness: 0.35, emissive: 0x0a3a32, emissiveIntensity: 0.35 });
    this.hbms = [0, 1, 2, 3].map(() => box(this.stack, 0.3, 0.055, 0.2, this.hbmMat, 0, 0, 0));
    this.filletMat = fadeMat(0x8a6244, { roughness: 0.28, metalness: 0.08, emissive: 0x4a3018, emissiveIntensity: 0.2 });
    this.fillet = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 28), this.filletMat);
    this.fillet.rotation.x = Math.PI / 2;
    this.fillet.position.y = 0.04;
    this.stack.add(this.fillet);
    this.mark = makeMark("HBX-100");
    this.stack.add(this.mark);
    g.add(this.stack);

    this.cloneMat = {
      coupon: fadeMat(0x9aabb4, { metalness: 0.65, roughness: 0.28 }),
      bond: fadeMat(0xe6c36a, { metalness: 0.7, roughness: 0.25, emissive: 0x8a5a12, emissiveIntensity: 0.4 }),
      die: fadeMat(0xd7ebe7, { roughness: 0.4, metalness: 0.25 }),
      hbm: fadeMat(0x3ee0c0, { roughness: 0.35, metalness: 0.35, emissive: 0x0a3a32, emissiveIntensity: 0.35 }),
    };
    this.clones = [0, 1, 2].map(() => {
      const c = new THREE.Group();
      box(c, 0.36, 0.035, 0.32, this.cloneMat.coupon, 0, 0.02, 0);
      box(c, 0.28, 0.016, 0.24, this.cloneMat.bond, 0, 0.045, 0);
      box(c, 0.26, 0.06, 0.22, this.cloneMat.die, 0, 0.09, 0);
      box(c, 0.18, 0.04, 0.14, this.cloneMat.hbm, 0, 0.15, 0);
      g.add(c);
      return c;
    });

    this.subMat = fadeMat(0xd3925a, { roughness: 0.42, metalness: 0.45, emissive: 0x3a2410, emissiveIntensity: 0.12 });
    this.sub = new THREE.Group();
    this.subSeg = [-0.58, 0, 0.58].map((x) => box(this.sub, 0.58, 0.1, 1.2, this.subMat, x, 0.08, 0));
    for (let i = 0; i < 5; i++) {
      box(this.sub, 0.08, 0.02, 0.1, mat(0xf0d2a4, { metalness: 0.6, roughness: 0.3 }), -0.7 + i * 0.18, 0.135, 0.66);
    }
    g.add(this.sub);

    this.ballMat = mat(0xf2d48a, { metalness: 0.86, roughness: 0.18 });
    this.balls = new THREE.Group();
    this.ballMeshes = [];
    const pitch = 0.2;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), this.ballMat);
        s.position.set((col - 2.5) * pitch, 0.04, (row - 2.5) * pitch);
        s.castShadow = false;
        this.balls.add(s);
        this.ballMeshes.push({ mesh: s, row });
      }
    }
    g.add(this.balls);

    this.voidMat = fadeMat(0x2a1020, { emissive: 0x6a1848, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.05, opacity: 0.9 });
    this.voidBubble = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), this.voidMat);
    g.add(this.voidBubble);

    this.trayMat = fadeMat(0x14181e, { roughness: 0.55, metalness: 0.25 });
    this.tray = new THREE.Group();
    box(this.tray, 2.05, 0.07, 1.5, this.trayMat, 0, 0.04, 0);
    const trayRim = mat(0x2a3138, { roughness: 0.5, metalness: 0.3 });
    trayRim.userData.fade = true;
    trayRim.transparent = true;
    box(this.tray, 2.05, 0.06, 0.06, trayRim, 0, 0.09, 0.72);
    box(this.tray, 2.05, 0.06, 0.06, trayRim, 0, 0.09, -0.72);
    box(this.tray, 0.06, 0.06, 1.5, trayRim, 0.99, 0.09, 0);
    box(this.tray, 0.06, 0.06, 1.5, trayRim, -0.99, 0.09, 0);
    const pocket = mat(0x0c1014, { roughness: 0.6, metalness: 0.2 });
    pocket.userData.fade = true;
    pocket.transparent = true;
    box(this.tray, 0.7, 0.02, 0.7, pocket, 0, 0.08, 0);
    g.add(this.tray);

    this.caption = makeCaption();
    this.caption.position.set(0, 0.02, 1.28);
    this.caption.scale.set(1.7, 0.34, 1);
    g.add(this.caption);
  }

  setCaption(text) {
    if (text === this._caption) return;
    this._caption = text;
    this.caption.userData.redraw(text);
  }

  applyPose(pose, compact = this.compact) {
    this.compact = compact;
    const hideScenery = compact ? 0 : 1;

    this.wafer.position.set(pose.wafer.x, pose.wafer.y, pose.wafer.z);
    const ws = Math.max(0.001, pose.wafer.s);
    const thin = pose.thin || 0;
    this.wafer.scale.set(ws, Math.max(0.22, ws * (1 - thin * 0.72)), ws);
    this.wafer.visible = fadeMaterial(this.waferMat, pose.wafer.op);
    this.ring.visible = fadeMaterial(this.ringMat, pose.ring);
    this.fiducials.visible = fadeMaterial(this.fidMat, pose.fiducial);

    this.tape.visible = fadeMaterial(this.tapeMat, pose.tapeOp * hideScenery);
    this.frame.visible = fadeMaterial(this.frameMat, pose.frameOp * hideScenery);

    this.kerfX.visible = !compact && pose.kerfX > 0.03;
    this.kerfZ.visible = !compact && pose.kerfZ > 0.03;
    this.kerfX.scale.set(Math.max(0.001, pose.kerfX), 1, 1);
    this.kerfZ.scale.set(1, 1, Math.max(0.001, pose.kerfZ));

    this.pockets.visible = fadeMaterial(this.pocketMat, pose.pockets * hideScenery);
    if (pose.alarm > 0.5 && pose.pockets > 0.6) {
      this.pocketMat.emissive.setHex(0xff6b7a);
      this.pocketMat.emissiveIntensity = 0.55;
    } else {
      this.pocketMat.emissive.setHex(0x000000);
      this.pocketMat.emissiveIntensity = 0;
    }

    this.stack.position.set(pose.stack.x, pose.stack.y, pose.stack.z);
    const ss = Math.max(0.001, pose.stack.s);
    const stackThin = 1 - (pose.thin || 0) * 0.38;
    this.stack.scale.set(ss, ss * stackThin, ss);
    this.logic.position.set(pose.logic.x, pose.logic.y, pose.logic.z);
    pose.hbms.forEach((h, i) => this.hbms[i].position.set(h.x, h.y, h.z));
    this.bond.position.set(pose.bond.x, pose.bond.y, pose.bond.z);
    const bs = Math.max(0.001, pose.bond.s);
    this.bond.scale.setScalar(bs);
    this.bond.visible = pose.bond.op > 0.05 && pose.bond.s > 0.04;
    if (this.bondGlowMat) this.bondGlowMat.emissiveIntensity = 0.75 + (pose.bondGlow || 0) * 1.35;
    const fillet = pose.fillet || 0;
    this.fillet.visible = fadeMaterial(this.filletMat, fillet);
    this.fillet.scale.setScalar(0.55 + fillet * 0.55);
    this.filletMat.roughness = 0.22 + (pose.filletCure || 0) * 0.5;
    this.filletMat.emissiveIntensity = fillet * (0.12 + (pose.filletCure || 0) * 0.45);
    this.mark.visible = (pose.mark || 0) > 0.35;
    this.mark.position.set(pose.logic.x, pose.logic.y + 0.08, pose.logic.z);
    this.coupon.visible = fadeMaterial(this.couponMat, pose.couponOp);
    if (pose.ring > 0.45) {
      this.logicMat.emissive.setHex(0x8a2030);
      this.logicMat.emissiveIntensity = 0.45;
    } else {
      this.logicMat.emissive.setHex(0x000000);
      this.logicMat.emissiveIntensity = 0;
    }

    const corners = [[0.64, 0.58], [-0.64, -0.58], [0.64, -0.58]];
    this.clones.forEach((c, i) => {
      const x = corners[i][0] * pose.cloneSpread;
      const z = corners[i][1] * pose.cloneSpread;
      c.position.set(x, pose.stack.y * (1 - pose.cloneSpread) + 0.02 * pose.cloneSpread, z);
      c.scale.setScalar(0.62);
      c.visible = pose.cloneOp > 0.04;
    });
    for (const m of Object.values(this.cloneMat)) fadeMaterial(m, pose.cloneOp);

    this.sub.position.set(pose.sub.x, pose.sub.y, pose.sub.z);
    this.sub.visible = fadeMaterial(this.subMat, pose.sub.op);
    const warp = pose.sub.warp;
    this.subSeg[0].rotation.z = warp * 0.42;
    this.subSeg[2].rotation.z = -warp * 0.42;
    this.subSeg[1].position.y = 0.08 + warp * 0.14;
    this.subSeg[0].position.y = 0.08;
    this.subSeg[2].position.y = 0.08;
    if (warp > 0.45) {
      this.subMat.emissive.setHex(0xff6b7a);
      this.subMat.emissiveIntensity = 0.35;
    } else {
      this.subMat.emissive.setHex(0x3a2410);
      this.subMat.emissiveIntensity = 0.12;
    }

    this.balls.position.set(pose.sub.x, 0.2 + pose.sub.y, pose.sub.z);
    this.balls.visible = pose.balls > 0.02;
    for (const b of this.ballMeshes) {
      const s = Math.min(1, Math.max(0, pose.balls * 6 - b.row));
      b.mesh.scale.setScalar(Math.max(0.001, s));
      b.mesh.visible = s > 0.05;
    }

    this.voidBubble.position.set(pose.stack.x, pose.stack.y + 0.12, pose.stack.z);
    this.voidBubble.scale.setScalar(Math.max(0.001, pose.voidS));
    this.voidBubble.visible = fadeMaterial(this.voidMat, pose.voidS);

    this.tray.position.set(pose.trayX, 0, 0);
    const trayOn = fadeMaterial(this.trayMat, pose.trayOp * hideScenery);
    this.tray.visible = trayOn;
    this.tray.traverse((obj) => {
      if (obj.material?.userData?.fade && obj.material !== this.trayMat) {
        fadeMaterial(obj.material, pose.trayOp * hideScenery);
      }
    });

    this.caption.visible = !compact && !!this._caption;
  }

  showMorph(morph) {
    const spec = specForMorph(morph);
    const m = motion(spec.station, spec.t, spec.fault);
    this.applyPose(m.pose, this.compact);
  }
}

function makeMark(text) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = "#f4efe4";
  g.font = "700 36px 'Sora', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(0.42, 0.1, 1);
  return sprite;
}

function makeCaption() {
  const cv = document.createElement("canvas");
  cv.width = 640;
  cv.height = 128;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.5, 0.5, 1);
  sprite.userData.redraw = (text) => {
    g.clearRect(0, 0, 640, 128);
    g.fillStyle = "rgba(8,16,20,0.78)";
    roundRect(g, 16, 28, 608, 78, 18);
    g.fill();
    g.strokeStyle = "rgba(211,146,90,0.75)";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#f0e2cc";
    g.font = FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text || "", 320, 68);
    tex.needsUpdate = true;
  };
  return sprite;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
