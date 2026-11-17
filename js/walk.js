/**
 * Floor walker for the APEX-3D trainer.
 * Pure math: no Three.js and no DOM. The plant owns the avatar and the camera.
 * js/route.js stays the process contract; this module only answers
 * "can the trainee stand here, and which tool is in reach?"
 */
import { STATIONS, STOCKER } from "./route.js";

export const PERSON_RADIUS = 0.32;
export const WALK_SPEED = 2.15;
export const SPRINT_SPEED = 4.05;
export const INSPECT_REACH = 2.65;
export const EYE_HEIGHT = 1.62;

/** Aisle just east of the stocker, on the incoming end of the line. */
export const WALK_SPAWN = { x: -42.4, z: 4.6, yaw: 0.4 };

/** Local tool body, including the load port. Face +1 looks toward +Z. */
export const TOOL_HALF_X = 1.38;
export const TOOL_Z_MIN = -1.22;
export const TOOL_Z_MAX = 1.86;

export function toolSolid(place, id) {
  const face = place.face >= 0 ? 1 : -1;
  const z0 = place.z + face * TOOL_Z_MIN;
  const z1 = place.z + face * TOOL_Z_MAX;
  return {
    id,
    kind: "tool",
    minX: place.x - TOOL_HALF_X,
    maxX: place.x + TOOL_HALF_X,
    minZ: Math.min(z0, z1),
    maxZ: Math.max(z0, z1),
    ax: place.x,
    az: place.z + face * 1.42,
  };
}

export function stockerSolid() {
  const x = STOCKER.place.x;
  const z = STOCKER.place.z;
  const minX = x - 3.7;
  const maxX = x + 3.9;
  const minZ = z - 2.7;
  const maxZ = z + 2.7;
  const east = { ax: maxX + 0.02, az: z };
  const southGlass = { ax: x + 2.4, az: maxZ + 0.04 };
  return {
    id: "stocker",
    kind: "stocker",
    minX,
    maxX,
    minZ,
    maxZ,
    ax: east.ax,
    az: east.az,
    points: [east, southGlass],
  };
}

export function wallSolids() {
  return [
    { id: "wall-n", kind: "wall", minX: -49.4, maxX: 47.2, minZ: -39.4, maxZ: -38.6 },
    { id: "wall-s", kind: "wall", minX: -49.4, maxX: 47.2, minZ: 38.6, maxZ: 39.4 },
    { id: "wall-w", kind: "wall", minX: -48.4, maxX: -47.6, minZ: -39.4, maxZ: 39.4 },
    { id: "wall-e", kind: "wall", minX: 45.6, maxX: 46.4, minZ: -39.4, maxZ: 39.4 },
  ];
}

export function buildSolids(stations = STATIONS) {
  return [
    ...stations.map((station) => toolSolid(station.place, station.tool)),
    stockerSolid(),
    ...wallSolids(),
  ];
}

export function overlaps(x, z, solid, radius = PERSON_RADIUS) {
  return (
    x > solid.minX - radius &&
    x < solid.maxX + radius &&
    z > solid.minZ - radius &&
    z < solid.maxZ + radius
  );
}

export function blockedAt(x, z, solids, radius = PERSON_RADIUS) {
  return solids.some((solid) => overlaps(x, z, solid, radius));
}

export function distPoint(x, z, ax, az) {
  return Math.hypot(x - ax, z - az);
}

/**
 * Camera policy shared by the plant and the acceptance test.
 * Walk and follow are exclusive. Leaving walk restores the overview orbit.
 */
export function nextCameraMode(state, action) {
  const current = {
    mode: state?.mode || "overview",
    follow: state?.follow || false,
    controls: state?.controls !== false,
  };
  if (action === "enter-walk") return { mode: "walk", follow: false, controls: false };
  if (action === "exit-walk") return { mode: "overview", follow: false, controls: true };
  if (action === "follow-lot") return { mode: "follow-lot", follow: "lot", controls: false };
  if (action === "follow-crane") return { mode: "follow-crane", follow: "crane", controls: false };
  if (action === "overview") return { mode: "overview", follow: false, controls: true };
  return current;
}

export class WalkController {
  constructor(solids = buildSolids()) {
    this.solids = solids;
    this.active = false;
    this.x = WALK_SPAWN.x;
    this.z = WALK_SPAWN.z;
    this.yaw = WALK_SPAWN.yaw;
    this.pitch = -0.08;
    this.inspectId = null;
    this.camera = nextCameraMode(null, "overview");
  }

  blocked(x, z) {
    return blockedAt(x, z, this.solids);
  }

  enter() {
    this.active = true;
    this.x = WALK_SPAWN.x;
    this.z = WALK_SPAWN.z;
    this.yaw = WALK_SPAWN.yaw;
    this.pitch = -0.08;
    this.inspectId = null;
    this.camera = nextCameraMode(this.camera, "enter-walk");
    if (this.blocked(this.x, this.z)) {
      this.x = -40.2;
      this.z = 6.4;
    }
    return { x: this.x, z: this.z, yaw: this.yaw };
  }

  exit() {
    this.active = false;
    this.inspectId = null;
    this.camera = nextCameraMode(this.camera, "exit-walk");
    return this.camera;
  }

  /**
   * Move by a world delta. If the destination is solid, slide on X and then Z
   * so a glancing approach follows the face instead of sticking.
   */
  tryMove(dx, dz) {
    const nx = this.x + dx;
    const nz = this.z + dz;
    if (!this.blocked(nx, nz)) {
      this.x = nx;
      this.z = nz;
      return { x: this.x, z: this.z, moved: dx !== 0 || dz !== 0, blocked: false };
    }
    let moved = false;
    if (dx !== 0 && !this.blocked(nx, this.z)) {
      this.x = nx;
      moved = true;
    }
    if (dz !== 0 && !this.blocked(this.x, nz)) {
      this.z = nz;
      moved = true;
    }
    return {
      x: this.x,
      z: this.z,
      moved,
      blocked: !moved && (dx !== 0 || dz !== 0),
    };
  }

  /**
   * forward +1 walks the way the avatar faces. strafe +1 is to the avatar's right.
   * yaw is a Three.js Y rotation: local -Z is forward.
   */
  step({ forward = 0, strafe = 0, sprint = false, yaw = this.yaw, dt = 0 } = {}) {
    this.yaw = yaw;
    const speed = (sprint ? SPRINT_SPEED : WALK_SPEED) * dt;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    return this.tryMove(
      (fx * forward + rx * strafe) * speed,
      (fz * forward + rz * strafe) * speed,
    );
  }

  updateInspect(reach = INSPECT_REACH) {
    let best = null;
    let bestD = reach;
    for (const solid of this.solids) {
      if (solid.kind === "wall") continue;
      const points = solid.points || (solid.ax == null ? [] : [{ ax: solid.ax, az: solid.az }]);
      for (const point of points) {
        const d = distPoint(this.x, this.z, point.ax, point.az);
        if (d < bestD) {
          bestD = d;
          best = solid.id;
        }
      }
    }
    this.inspectId = best;
    return best;
  }
}
