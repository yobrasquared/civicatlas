"use client";

import { useMemo, useState } from "react";
import type { Member, RollCallVote } from "../lib/types";
import { fmtDate } from "../lib/status";
import { STATE_NAMES } from "../lib/states";

export const POSITION_META: Record<string, { label: string; color: string; bg: string }> = {
  Y: { label: "Yea", color: "#2dd4bf", bg: "rgba(45,212,191,0.12)" },
  N: { label: "Nay", color: "#fb7185", bg: "rgba(251,113,133,0.12)" },
  P: { label: "Present", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  X: { label: "Not voting", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

export function PositionBadge({ pos, size = "sm" }: { pos: string; size?: "sm" | "xs" }) {
  const meta = POSITION_META[pos] ?? POSITION_META.X;
  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]"
      }`}
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}33` }}
    >
      {meta.label}
    </span>
  );
}

export function KindChip({ kind }: { kind: RollCallVote["kind"] }) {
  const label = {
    passage: "Passage vote",
    amendment: "Amendment",
    nomination: "Nomination",
    procedural: "Procedural",
    other: "Other",
  }[kind];
  const highlight = kind === "passage";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{
        color: highlight ? "#818cf8" : "#64748b",
        background: highlight ? "rgba(129,140,248,0.12)" : "rgba(100,116,139,0.1)",
        border: `1px solid ${highlight ? "rgba(129,140,248,0.3)" : "rgba(100,116,139,0.25)"}`,
      }}
    >
      {label}
    </span>
  );
}

export function VoteBar({ totals }: { totals: { y: number; n: number; o: number } }) {
  const total = Math.max(1, totals.y + totals.n + totals.o);
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[rgba(148,163,184,0.1)]">
        <div style={{ width: `${(totals.y / total) * 100}%`, background: "#2dd4bf" }} />
        <div style={{ width: `${(totals.n / total) * 100}%`, background: "#fb7185" }} />
        <div style={{ width: `${(totals.o / total) * 100}%`, background: "rgba(148,163,184,0.35)" }} />
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-[#8fa1bb]">
        <span><strong style={{ color: "#2dd4bf" }}>{totals.y}</strong> yea</span>
        <span><strong style={{ color: "#fb7185" }}>{totals.n}</strong> nay</span>
        <span><strong>{totals.o}</strong> present / not voting</span>
      </div>
    </div>
  );
}

type RosterEntry = Pick<Member, "id" | "name" | "party" | "state">;

function matchesRosterQuery(entry: RosterEntry, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const state = entry.state.toLowerCase();
  const stateName = (STATE_NAMES[entry.state] ?? "").toLowerCase();
  if (/^[a-z]{2}$/.test(q)) return state === q;
  return entry.name.toLowerCase().includes(q) || stateName.includes(q) || state === q;
}

export function VoteCard({ vote, roster }: { vote: RollCallVote; roster: RosterEntry[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const byId = new Map(roster.map((r) => [r.id, r]));
    const groups: Record<string, { entry: RosterEntry; pos: string }[]> = { Y: [], N: [], P: [], X: [] };
    for (const [id, pos] of Object.entries(vote.positions)) {
      const entry = byId.get(id);
      if (!entry) continue;
      if (!matchesRosterQuery(entry, q)) continue;
      (groups[pos] ?? groups.X).push({ entry, pos });
    }
    for (const g of Object.values(groups)) g.sort((a, b) => a.entry.name.localeCompare(b.entry.name));
    return groups;
  }, [vote.positions, roster, q]);

  const hasPositions = Object.keys(vote.positions).length > 0;

  return (
    <div className="rounded-xl border border-[rgba(148,163,184,0.12)] bg-[rgba(148,163,184,0.04)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KindChip kind={vote.kind} />
            <span className="text-[10px] text-[#64748b]">
              {vote.chamber} roll call #{vote.number} · {fmtDate(vote.date)} · {vote.required} required
            </span>
          </div>
          <div className="mt-1.5 text-[13px] leading-snug text-[#dbe5f1]">{vote.question}</div>
        </div>
      </div>
      <div className="mt-2.5">
        <VoteBar totals={vote.totals} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
          style={{
            color: vote.passed ? "#34d399" : "#fb923c",
            background: vote.passed ? "rgba(52,211,153,0.1)" : "rgba(251,146,60,0.1)",
          }}
        >
          {vote.result}
        </span>
        {hasPositions && (
          <button
            onClick={() => setOpen(!open)}
            className="text-[11px] text-[#7dd3fc] transition-colors hover:text-[#5eead4]"
          >
            {open ? "Hide member positions ▲" : `See how all ${Object.keys(vote.positions).length} members voted ▼`}
          </button>
        )}
        {vote.official_url && (
          <a
            href={vote.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] text-[#64748b] transition-colors hover:text-[#34d399]"
          >
            🏛 Official record ↗
          </a>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-[rgba(148,163,184,0.12)] pt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name or state…"
            className="mb-3 w-full rounded-lg border border-[rgba(148,163,184,0.15)] bg-transparent px-3 py-1.5 text-[12px] text-[#e6edf7] placeholder-[#64748b] outline-none focus:border-[rgba(94,234,212,0.4)]"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {(["Y", "N", "P", "X"] as const).map(
              (pos) =>
                grouped[pos].length > 0 && (
                  <div key={pos}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <PositionBadge pos={pos} />
                      <span className="text-[10px] text-[#64748b]">{grouped[pos].length}</span>
                    </div>
                    <div className="scroll-slim max-h-48 space-y-0.5 overflow-y-auto pr-1">
                      {grouped[pos].map(({ entry }) => (
                        <a
                          key={entry.id}
                          href={`/official/${entry.id}`}
                          className="block truncate rounded px-1.5 py-0.5 text-[11px] text-[#b9c7da] transition-colors hover:bg-[rgba(148,163,184,0.08)] hover:text-[#5eead4]"
                        >
                          {entry.name} <span className="text-[#64748b]">({entry.party?.[0] ?? "?"}–{entry.state})</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
