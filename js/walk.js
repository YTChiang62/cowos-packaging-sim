/**
 * Floor walker for the APEX-3D trainer.
 * Pure math: no Three.js and no DOM. The plant owns the avatar and the camera.
 * js/route.js stays the process contract; this module only answers
 * "can the trainee stand here, and which tool is in reach?"
 */
import { LOAD_LOCAL_Z, STOCKER, TOOLS } from "./route.js";

export const PERSON_RADIUS = 0.32;
export const WALK_SPEED = 2.15;
export const SPRINT_SPEED = 4.05;
export const INSPECT_REACH = 2.65;
export const EYE_HEIGHT = 1.62;

/**
 * Shared with the plant meshes. Tool groups scale around the machine origin
 * and then shift along Z so the load port stays on the ceiling-rail node.
 * 1.55 keeps a gap on the 5 m pack pitch and does not close the aisle.
 */
export const TOOL_VISUAL_SCALE = 1.55;

/**
 * Outer cleanroom slab. Grown just enough for the return-air bands and the
 * perimeter rooms. Still shorter than the old 80 m apron.
 */
export const PLANT_FLOOR = { minX: -64.6, maxX: 52.8, minZ: -34.8, maxZ: 34.8 };

/** Glass boundary just inside the slab. Collision slabs are centered on these planes. */
export const PLANT_WALLS = { north: -33.4, south: 33.4, west: -63.0, east: 51.2 };

/**
 * Default 總覽. A high oblique — still 3D, not a flat plan — frames the five
 * color parks, both return-air bands, the perimeter rooms, the stocker, and
 * every tool on desktop aspects (about 1.6 and 16:9).
 */
export const OVERVIEW_CAMERA = {
  fov: 42,
  position: [-3, 110, 53],
  target: [-7, 0.4, -1],
};

/** Thickness of perimeter-room walls. Meshes and walk solids share this. */
export const ROOM_WALL_T = 0.36;

/**
 * Support rooms around the process floor. Not a sixth bay and not FEOL.
 * AHU and the duty room are solid footprints. Gowning is walls plus an
 * east door onto the aisle beside the stocker.
 */
export const FACILITY_ROOMS = [
  { id: "ahu-nw", kind: "ahu", labelKey: "room_ahu", minX: -61.8, maxX: -53.2, minZ: -32.2, maxZ: -24.0, door: "east" },
  { id: "ahu-ne", kind: "ahu", labelKey: "room_ahu", minX: 43.2, maxX: 50.0, minZ: -32.2, maxZ: -24.0, door: "west" },
  { id: "ahu-sw", kind: "ahu", labelKey: "room_ahu", minX: -61.8, maxX: -53.2, minZ: 24.0, maxZ: 32.2, door: "east" },
  { id: "ahu-se", kind: "ahu", labelKey: "room_ahu", minX: 43.2, maxX: 50.0, minZ: 24.0, maxZ: 32.2, door: "west" },
  { id: "ahu-w", kind: "ahu", labelKey: "room_ahu", minX: -61.8, maxX: -54.4, minZ: -22.6, maxZ: -6.6, door: "east" },
  { id: "gowning", kind: "gowning", labelKey: "room_gowning", minX: -61.6, maxX: -47.4, minZ: 3.6, maxZ: 11.15, door: "east", doorWidth: 2.5 },
  { id: "duty", kind: "duty", labelKey: "room_duty", minX: -61.6, maxX: -54.6, minZ: 13.8, maxZ: 21.0, door: "east" },
];

/** North and south 回風夾道. Facility bands outside the process parks. Not walkable. */
export const RETURN_AIR = [
  { id: "return-n", kind: "return", labelKey: "room_return", minX: -53.4, maxX: 43.4, minZ: -32.0, maxZ: -24.2 },
  { id: "return-s", kind: "return", labelKey: "room_return", minX: -53.4, maxX: 43.4, minZ: 24.2, maxZ: 32.0 },
];

/** Z added to a tool group's position after a uniform visual scale. Face +1 looks toward +Z. */
export function toolScaleShiftZ(face, scale = TOOL_VISUAL_SCALE) {
  const sign = face >= 0 ? -1 : 1;
  return sign * LOAD_LOCAL_Z * (scale - 1);
}

/** World XZ of the load port after the visual scale. Matches the unscaled rail node. */
export function preservedLoadPort(place, scale = TOOL_VISUAL_SCALE) {
  const face = place.face >= 0 ? 1 : -1;
  const shift = toolScaleShiftZ(face, scale);
  const z = face > 0
    ? place.z + shift + LOAD_LOCAL_Z * scale
    : place.z + shift - LOAD_LOCAL_Z * scale;
  return { x: place.x, z };
}

/** Aisle just east of the stocker, on the incoming end of the line. */
export const WALK_SPAWN = { x: -42.4, z: 4.6, yaw: 0.4 };

/** Local tool body, including the load port. Face +1 looks toward +Z. */
export const TOOL_HALF_X = 1.38;
export const TOOL_Z_MIN = -1.22;
export const TOOL_Z_MAX = 1.86;

export function toolSolid(place, id, scale = TOOL_VISUAL_SCALE) {
  const face = place.face >= 0 ? 1 : -1;
  const shift = toolScaleShiftZ(face, scale);
  const along = (zLocal) => (face > 0 ? shift + zLocal * scale : shift - zLocal * scale);
  const z0 = place.z + along(TOOL_Z_MIN);
  const z1 = place.z + along(TOOL_Z_MAX);
  const half = TOOL_HALF_X * scale;
  const port = preservedLoadPort(place, scale);
  return {
    id,
    kind: "tool",
    minX: place.x - half,
    maxX: place.x + half,
    minZ: Math.min(z0, z1),
    maxZ: Math.max(z0, z1),
    ax: port.x,
    az: port.z,
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
  const { north, south, west, east } = PLANT_WALLS;
  const t = 0.4;
  return [
    { id: "wall-n", kind: "wall", minX: west - 1, maxX: east + 1, minZ: north - t, maxZ: north + t },
    { id: "wall-s", kind: "wall", minX: west - 1, maxX: east + 1, minZ: south - t, maxZ: south + t },
    { id: "wall-w", kind: "wall", minX: west - t, maxX: west + t, minZ: north - 1, maxZ: south + 1 },
    { id: "wall-e", kind: "wall", minX: east - t, maxX: east + t, minZ: north - 1, maxZ: south + 1 },
  ];
}

function gowningSolids(room) {
  const t = ROOM_WALL_T;
  const { minX, maxX, minZ, maxZ } = room;
  const width = room.doorWidth || 2.5;
  const mid = (minZ + maxZ) / 2;
  const z0 = mid - width / 2;
  const z1 = mid + width / 2;
  return [
    { id: `${room.id}-n`, kind: "room-wall", minX, maxX, minZ, maxZ: minZ + t },
    { id: `${room.id}-s`, kind: "room-wall", minX, maxX, minZ: maxZ - t, maxZ },
    { id: `${room.id}-w`, kind: "room-wall", minX, maxX: minX + t, minZ, maxZ },
    { id: `${room.id}-e1`, kind: "room-wall", minX: maxX - t, maxX, minZ, maxZ: z0 },
    { id: `${room.id}-e2`, kind: "room-wall", minX: maxX - t, maxX, minZ: z1, maxZ },
    {
      id: `${room.id}-bench`,
      kind: "room-wall",
      minX: minX + t,
      maxX: minX + t + 0.85,
      minZ: minZ + 0.9,
      maxZ: maxZ - 0.9,
    },
  ];
}

/** AHU, duty, gowning walls, and the return-air bands. Tools and the stocker are separate. */
export function facilitySolids() {
  const solids = [];
  for (const room of FACILITY_ROOMS) {
    if (room.kind === "gowning") solids.push(...gowningSolids(room));
    else solids.push({ id: room.id, kind: room.kind, minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ });
  }
  for (const band of RETURN_AIR) {
    solids.push({ id: band.id, kind: band.kind, minX: band.minX, maxX: band.maxX, minZ: band.minZ, maxZ: band.maxZ });
  }
  return solids;
}

export function buildSolids(stations = TOOLS) {
  const seen = new Set();
  const tools = [];
  for (const station of stations) {
    const id = station.tool || station.id;
    if (seen.has(id)) continue;
    seen.add(id);
    tools.push(toolSolid(station.place, id));
  }
  return [
    ...tools,
    stockerSolid(),
    ...wallSolids(),
    ...facilitySolids(),
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
