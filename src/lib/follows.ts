"use client";

import { useEffect, useState } from "react";

/**
 * Device-local follows. Deliberately NOT synced anywhere — CivicAtlas does not
 * store users' civic interests server-side (see README principles).
 */
const KEY = "civicatlas:follows";
const EVENT = "civicatlas:follows-changed";

export type Follows = { bills: string[]; members: string[] };
const EMPTY: Follows = { bills: [], members: [] };

export function getFollows(): Follows {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
    };
  } catch {
    return EMPTY;
  }
}

export function isFollowing(kind: keyof Follows, id: string): boolean {
  return getFollows()[kind].includes(id);
}

export function toggleFollow(kind: keyof Follows, id: string): Follows {
  const cur = getFollows();
  const list = cur[kind].includes(id) ? cur[kind].filter((x) => x !== id) : [...cur[kind], id];
  const next = { ...cur, [kind]: list };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — follows just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
  return next;
}

/** Live view of follows; updates across components and browser tabs. */
export function useFollows(): Follows {
  const [follows, setFollows] = useState<Follows>(EMPTY);
  useEffect(() => {
    const sync = () => setFollows(getFollows());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return follows;
}
