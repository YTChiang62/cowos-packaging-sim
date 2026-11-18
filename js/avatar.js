/**
 * Low-poly cleanroom trainee. One body, tinted by the selected process role.
 * Built from primitives so GitHub Pages does not need a character pack.
 */
import * as THREE from "three";
import { box, mat } from "./mat.js";

const ROLE_TINT = {
  MFG: 0xd3925a,
  EE: 0x3ee0c0,
  PE: 0x9eb6ff,
};

export function buildAvatar(role = "MFG") {
  const root = new THREE.Group();
  root.name = "trainee";
  const rig = new THREE.Group();
  root.add(rig);

  const suit = mat(0xb7c6cb, { roughness: 0.68, metalness: 0.04 });
  const seam = mat(0x5d7278, { roughness: 0.6, metalness: 0.08 });
  const visorMat = mat(0x10262c, {
    roughness: 0.08,
    metalness: 0.55,
    transparent: true,
    opacity: 0.78,
  });
  const bootMat = mat(0x141c20, { roughness: 0.5, metalness: 0.25 });
  const tint = ROLE_TINT[role] || ROLE_TINT.MFG;
  const badgeMat = mat(tint, { emissive: tint, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.2 });

  box(rig, 0.4, 0.46, 0.22, suit, 0, 1.2, 0);
  box(rig, 0.42, 0.06, 0.24, seam, 0, 0.98, 0);
  box(rig, 0.16, 0.05, 0.02, badgeMat, 0, 1.28, 0.12);
  box(rig, 0.36, 0.04, 0.015, badgeMat, 0, 1.46, 0.1);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12), suit);
  hood.scale.set(1, 1.08, 1.02);
  hood.position.set(0, 1.58, 0);
  hood.castShadow = true;
  rig.add(hood);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), visorMat);
  visor.scale.set(1.2, 0.55, 0.42);
  visor.position.set(0, 1.56, 0.09);
  rig.add(visor);

  function limb(x, y, z, w, h, d, material) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    rig.add(pivot);
    return pivot;
  }

  const armL = limb(-0.26, 1.36, 0, 0.1, 0.4, 0.1, suit);
  const armR = limb(0.26, 1.36, 0, 0.1, 0.4, 0.1, suit);
  const legL = limb(-0.1, 0.94, 0, 0.12, 0.46, 0.13, suit);
  const legR = limb(0.1, 0.94, 0, 0.12, 0.46, 0.13, suit);
  box(legL, 0.13, 0.07, 0.18, bootMat, 0, -0.48, 0.02);
  box(legR, 0.13, 0.07, 0.18, bootMat, 0, -0.48, 0.02);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 16),
    mat(0x071016, { transparent: true, opacity: 0.35, roughness: 1, metalness: 0 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  root.userData.rig = rig;
  root.userData.badgeMat = badgeMat;
  root.userData.armL = armL;
  root.userData.armR = armR;
  root.userData.legL = legL;
  root.userData.legR = legR;
  root.visible = false;
  return root;
}

export function setAvatarRole(avatar, role) {
  const tint = ROLE_TINT[role] || ROLE_TINT.MFG;
  const badge = avatar?.userData?.badgeMat;
  if (!badge) return;
  badge.color.setHex(tint);
  badge.emissive.setHex(tint);
}

export function poseAvatar(avatar, phase, moving) {
  if (!avatar) return;
  const swing = moving ? Math.sin(phase) : Math.sin(phase) * 0.12;
  const amp = moving ? 0.65 : 0.08;
  avatar.userData.legL.rotation.x = swing * amp;
  avatar.userData.legR.rotation.x = -swing * amp;
  avatar.userData.armL.rotation.x = -swing * amp * 0.7;
  avatar.userData.armR.rotation.x = swing * amp * 0.7;
  avatar.userData.rig.position.y = moving ? Math.abs(Math.sin(phase)) * 0.025 : 0;
}
