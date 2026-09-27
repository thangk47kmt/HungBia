import type { BeerDef, LevelDef } from "@/game/catalog";
import { levelTarget } from "@/game/catalog";

export type Item = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  pace: "slow" | "norm" | "fast";
  alive: boolean;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
};

export type Floater = {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
};

export type SimEvent = { type: "catch" | "miss" | "clear" | "fail"; gain?: number };

export type Sim = {
  w: number;
  h: number;
  bucketX: number;
  bucketW: number;
  bucketH: number;
  bucketY: number;
  floor: number;
  moveX: number;
  pointerX: number | null;
  items: Item[];
  particles: Particle[];
  floaters: Floater[];
  spawnTotal: number;
  spawnEvery: number;
  spawnAcc: number;
  spawned: number;
  baseSpeed: number;
  paceGap: number;
  lives: number;
  score: number;
  combo: number;
  caught: number;
  target: number;
  nextId: number;
  shake: number;
  flash: number;
  squash: number;
  status: "play" | "clear" | "fail";
  grace: number;
  kind: BeerDef["kind"];
  body: string;
  label: string;
  cap: string;
  mark: string;
  points: number;
  time: number;
};

const events: SimEvent[] = [];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function floorOf(h: number) {
  return h - (h < 560 ? 96 : 132);
}

export function createSim(w: number, h: number, level: LevelDef, beer: BeerDef): Sim {
  const bucketW = Math.max(112, Math.min(156, w * 0.34));
  const bucketH = 58;
  const floor = floorOf(h);
  const bottle = beer.kind === "bottle";
  return {
    w,
    h,
    bucketX: w / 2,
    bucketW,
    bucketH,
    bucketY: floor - bucketH + 12,
    floor,
    moveX: 0,
    pointerX: null,
    items: [],
    particles: [],
    floaters: [],
    spawnTotal: level.spawn,
    spawnEvery: level.every,
    spawnAcc: 0,
    spawned: 0,
    baseSpeed: level.speed,
    paceGap: 2,
    lives: 3,
    score: 0,
    combo: 0,
    caught: 0,
    target: levelTarget(level),
    nextId: 1,
    shake: 0,
    flash: 0,
    squash: 0,
    status: "play",
    grace: 0.65,
    kind: bottle ? "bottle" : "can",
    body: beer.body,
    label: beer.label,
    cap: beer.cap,
    mark: beer.mark,
    points: beer.points,
    time: 0,
  };
}

export function resizeSim(sim: Sim, w: number, h: number) {
  if (sim.w > 0) {
    const sx = w / sim.w;
    sim.bucketX *= sx;
    for (const item of sim.items) item.x *= sx;
  }
  sim.w = w;
  sim.h = h;
  sim.floor = floorOf(h);
  sim.bucketY = sim.floor - sim.bucketH + 12;
  const half = sim.bucketW / 2;
  sim.bucketX = clamp(sim.bucketX, half, Math.max(half, w - half));
}

function burst(sim: Sim, x: number, y: number, color: string) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 160;
    sim.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.35 + Math.random() * 0.25,
      max: 0.6,
      r: 2 + Math.random() * 3,
      color,
    });
  }
  if (sim.particles.length > 80) sim.particles.splice(0, sim.particles.length - 80);
}

function floater(sim: Sim, x: number, y: number, text: string) {
  sim.floaters.push({ x, y, text, life: 0.7, max: 0.7 });
  if (sim.floaters.length > 8) sim.floaters.shift();
}

function nextFall(sim: Sim): { vy: number; pace: Item["pace"]; spin: number } {
  sim.paceGap -= 1;
  let pace: Item["pace"] = "norm";
  let mul = 0.92 + Math.random() * 0.16;
  if (sim.paceGap <= 0) {
    pace = Math.random() < 0.5 ? "slow" : "fast";
    mul = pace === "slow" ? 0.48 + Math.random() * 0.2 : 1.55 + Math.random() * 0.45;
    sim.paceGap = 2 + Math.floor(Math.random() * 3);
  }
  const spin = (Math.random() - 0.5) * (pace === "fast" ? 2.6 : 1.2);
  return { vy: sim.baseSpeed * mul, pace, spin };
}

function spawnItem(sim: Sim) {
  const bottle = sim.kind === "bottle";
  const w = bottle ? 32 : 36;
  const h = bottle ? 70 : 52;
  const margin = w / 2 + 10;
  const span = Math.max(1, sim.w - margin * 2);
  const fall = nextFall(sim);
  sim.items.push({
    id: sim.nextId++,
    x: margin + Math.random() * span,
    y: -h,
    w,
    h,
    vx: (Math.random() - 0.5) * 36,
    vy: fall.vy,
    rot: (Math.random() - 0.5) * 0.4,
    spin: fall.spin,
    pace: fall.pace,
    alive: true,
  });
  sim.spawned += 1;
}

function catchItem(sim: Sim, item: Item) {
  item.alive = false;
  sim.caught += 1;
  sim.combo += 1;
  const mult = 1 + Math.min(sim.combo - 1, 8) * 0.12;
  const points = Math.round(sim.points * mult);
  sim.score += points;
  sim.squash = 0.16;
  sim.shake = Math.min(1, sim.shake + 0.22);
  burst(sim, item.x, sim.bucketY, sim.label);
  floater(sim, item.x, sim.bucketY - 8, `+${points}`);
  events.push({ type: "catch", gain: points });
}

export function revive(sim: Sim) {
  sim.lives = 1;
  sim.status = "play";
  sim.grace = 0.5;
  sim.flash = 0;
  sim.shake = 0;
  sim.items = sim.items.filter((item) => item.alive && item.y < sim.bucketY - item.h * 0.5);
}

function missItem(sim: Sim, item: Item) {
  item.alive = false;
  sim.lives = Math.max(0, sim.lives - 1);
  sim.combo = 0;
  sim.flash = 0.45;
  sim.shake = 0.65;
  floater(sim, item.x, sim.floor - 20, "Rơi");
  events.push({ type: "miss" });
}

function decay(sim: Sim, dt: number) {
  sim.time += dt;
  sim.shake = Math.max(0, sim.shake - dt * 2.5);
  sim.flash = Math.max(0, sim.flash - dt * 1.7);
  sim.squash = Math.max(0, sim.squash - dt * 1.5);
  for (let i = sim.particles.length - 1; i >= 0; i--) {
    const p = sim.particles[i]!;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 380 * dt;
    if (p.life <= 0) sim.particles.splice(i, 1);
  }
  for (let i = sim.floaters.length - 1; i >= 0; i--) {
    const f = sim.floaters[i]!;
    f.life -= dt;
    f.y -= 36 * dt;
    if (f.life <= 0) sim.floaters.splice(i, 1);
  }
}

export function step(sim: Sim, dt: number): readonly SimEvent[] {
  events.length = 0;
  decay(sim, dt);
  if (sim.status !== "play") return events;

  const half = sim.bucketW / 2;
  if (sim.pointerX != null) {
    const target = clamp(sim.pointerX, half, sim.w - half);
    sim.bucketX += (target - sim.bucketX) * Math.min(1, dt * 16);
  } else {
    sim.bucketX += sim.moveX * 720 * dt;
  }
  sim.bucketX = clamp(sim.bucketX, half, Math.max(half, sim.w - half));

  sim.grace -= dt;
  if (sim.grace <= 0 && sim.spawned < sim.spawnTotal) {
    sim.spawnAcc += dt;
    while (sim.spawnAcc >= sim.spawnEvery && sim.spawned < sim.spawnTotal) {
      sim.spawnAcc -= sim.spawnEvery;
      spawnItem(sim);
    }
  }

  const reach = sim.bucketW * 0.5;
  const opening = sim.bucketY + 10;
  for (const item of sim.items) {
    if (!item.alive) continue;
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    item.rot += item.spin * dt;
    const pad = item.w / 2;
    if (item.x < pad || item.x > sim.w - pad) item.vx *= -1;
    const inMouth =
      item.y + item.h * 0.28 >= opening &&
      item.y < opening + sim.bucketH &&
      Math.abs(item.x - sim.bucketX) < reach;
    if (inMouth) catchItem(sim, item);
    else if (sim.caught < sim.target && item.y > sim.floor + 8) missItem(sim, item);
    if (sim.caught >= sim.target) break;
  }
  if (sim.items.some((item) => !item.alive)) sim.items = sim.items.filter((item) => item.alive);

  if (sim.caught >= sim.target) {
    sim.status = "clear";
    events.push({ type: "clear" });
  } else if (sim.lives <= 0) {
    sim.status = "fail";
    events.push({ type: "fail" });
  }
  return events;
}
