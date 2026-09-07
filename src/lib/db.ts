/* ScholarAI — persistence layer.
   In production this maps 1:1 onto MongoDB collections (users, authors, papers,
   metrics_history, polling_logs, api_usage, deleted_authors) via Motor/PyMongo.
   In this sandbox build the same document shapes are persisted to localStorage. */

import type { DBShape } from "./core";
import { buildSeed } from "./seed";

const KEY = "scholarai.db.v6";

let cache: DBShape | null = null;

export function getDB(): DBShape {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DBShape;
      if (parsed && parsed.version === 6) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    /* corrupted storage → reseed */
  }
  cache = buildSeed();
  saveDB();
  return cache;
}

export function saveDB(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full — keep in-memory copy */
  }
}

export function resetDB(): DBShape {
  cache = buildSeed();
  saveDB();
  return cache;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
