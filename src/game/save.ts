import { BEERS, STAFF } from "@/game/catalog";

export const SAVE_VERSION = 1;
const KEY = "hung-bia-save";

export type Progress = {
  nextLevel: number;
  runScore: number;
  bestByLevel: Record<string, number>;
};

export type Save = {
  version: number;
  name: string;
  adult: boolean;
  staffId: string;
  beerId: string;
  muted: boolean;
  names: Record<string, string>;
  byStaff: Record<string, Progress>;
};

export function emptyProgress(): Progress {
  return { nextLevel: 1, runScore: 0, bestByLevel: {} };
}

export function defaultSave(): Save {
  return {
    version: SAVE_VERSION,
    name: "",
    adult: false,
    staffId: STAFF[0]!.id,
    beerId: BEERS[0]!.id,
    muted: false,
    names: {},
    byStaff: {},
  };
}

function mergeProgress(raw: Partial<Progress> | undefined): Progress {
  const base = emptyProgress();
  if (!raw) return base;
  return {
    nextLevel: typeof raw.nextLevel === "number" ? raw.nextLevel : base.nextLevel,
    runScore: typeof raw.runScore === "number" ? raw.runScore : 0,
    bestByLevel: raw.bestByLevel && typeof raw.bestByLevel === "object" ? raw.bestByLevel : {},
  };
}

export function loadSave(): Save {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(`${KEY}:bak`);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Save>;
    const byStaff: Record<string, Progress> = {};
    if (parsed.byStaff && typeof parsed.byStaff === "object") {
      for (const [id, prog] of Object.entries(parsed.byStaff)) {
        byStaff[id] = mergeProgress(prog);
      }
    }
    return {
      ...base,
      ...parsed,
      version: SAVE_VERSION,
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 24) : "",
      adult: parsed.adult === true,
      staffId: typeof parsed.staffId === "string" ? parsed.staffId : base.staffId,
      beerId: typeof parsed.beerId === "string" ? parsed.beerId : base.beerId,
      muted: parsed.muted === true,
      names: parsed.names && typeof parsed.names === "object" ? parsed.names : {},
      byStaff,
    };
  } catch {
    return base;
  }
}

export function writeSave(save: Save) {
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(`${KEY}:bak`, prev);
    localStorage.setItem(KEY, JSON.stringify({ ...save, version: SAVE_VERSION }));
  } catch {
    /* private mode / quota — keep playing in memory */
  }
}

export function progressOf(save: Save, staffId: string): Progress {
  return mergeProgress(save.byStaff[staffId]);
}

export function displayName(save: Save, staffId: string, fallback: string): string {
  const custom = save.names[staffId]?.trim();
  return custom || fallback;
}
