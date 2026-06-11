import type { BillStatus } from "./types";

export const STATUS_META: Record<BillStatus, { label: string; color: string; dim: string }> = {
  introduced: { label: "Introduced", color: "#94a3b8", dim: "rgba(148,163,184,.14)" },
  committee: { label: "In Committee", color: "#60a5fa", dim: "rgba(96,165,250,.14)" },
  passed_one: { label: "Passed One Chamber", color: "#2dd4bf", dim: "rgba(45,212,191,.14)" },
  passed_both: { label: "Passed Both Chambers", color: "#818cf8", dim: "rgba(129,140,248,.16)" },
  law: { label: "Became Law", color: "#34d399", dim: "rgba(52,211,153,.16)" },
  agreed: { label: "Agreed To (Resolution)", color: "#4ade80", dim: "rgba(74,222,128,.13)" },
  vetoed: { label: "Vetoed", color: "#fb923c", dim: "rgba(251,146,60,.15)" },
  stalled: { label: "Stalled", color: "#64748b", dim: "rgba(100,116,139,.15)" },
  failed: { label: "Failed", color: "#64748b", dim: "rgba(100,116,139,.15)" },
};

/** Index on the Introduced → Law stepper; -1 means off-track (vetoed/stalled/failed). */
export function stepIndex(status: BillStatus): number {
  switch (status) {
    case "introduced": return 0;
    case "committee": return 1;
    case "passed_one": return 2;
    case "passed_both": return 3;
    case "law": return 4;
    default: return -1;
  }
}

export const STEPS = ["Introduced", "Committee", "Passed One Chamber", "Passed Both", "Law"];

export const TOPIC_LABELS: Record<string, string> = {
  housing: "Housing", healthcare: "Healthcare", education: "Education", taxes: "Taxes",
  environment: "Environment", immigration: "Immigration", economy: "Economy & Jobs",
  defense: "Defense & Veterans", justice: "Justice & Policing", technology: "Technology",
  transportation: "Transportation", energy: "Energy", agriculture: "Agriculture",
  elections: "Elections", "civil-rights": "Civil Rights", budget: "Budget", other: "Other",
};

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
