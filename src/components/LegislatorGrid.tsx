"use client";

import { useMemo, useState } from "react";
import type { StateLegislator } from "../lib/types";
import { PartyChip } from "./cards";

export default function LegislatorGrid({ upper, lower }: { upper: StateLegislator[]; lower: StateLegislator[] }) {
  const [q, setQ] = useState("");
  const [chamber, setChamber] = useState<"upper" | "lower">("upper");

  const list = chamber === "upper" ? upper : lower;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = n
      ? list.filter((l) => l.name.toLowerCase().includes(n) || l.district.toLowerCase().includes(n))
      : list;
    return [...base].sort((a, b) => {
      const da = parseInt(a.district, 10);
      const db = parseInt(b.district, 10);
      if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
      return a.district.localeCompare(b.district) || a.name.localeCompare(b.name);
    });
  }, [list, q]);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-[rgba(148,163,184,0.07)] p-1">
          {(["upper", "lower"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChamber(c)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                chamber === c ? "bg-[rgba(45,212,191,0.15)] text-[#5eead4]" : "text-[#8fa1bb] hover:text-[#cbd5e1]"
              }`}
            >
              {c === "upper" ? `Senate (${upper.length})` : `House / Assembly (${lower.length})`}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name or district…"
          className="min-w-44 flex-1 rounded-xl border border-[rgba(148,163,184,0.15)] bg-transparent px-3 py-2 text-[12px] text-[#e6edf7] placeholder-[#64748b] outline-none focus:border-[rgba(94,234,212,0.4)]"
        />
      </div>

      <div className="scroll-slim mt-3 grid max-h-[28rem] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {filtered.map((l) => (
          <a
            key={l.id}
            href={l.openstates_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-[rgba(148,163,184,0.1)] bg-[rgba(148,163,184,0.03)] px-2.5 py-2 transition-colors hover:border-[rgba(94,234,212,0.3)]"
          >
            <LegislatorAvatar legislator={l} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12px] font-medium text-[#e6edf7]">{l.name}</span>
                <PartyChip party={l.party} />
              </span>
              <span className="block truncate text-[10px] text-[#8fa1bb]">
                District {l.district}
              </span>
            </span>
            <span className="text-[10px] text-[#475569]">↗</span>
          </a>
        ))}
        {filtered.length === 0 && (
          <p className="px-1 py-3 text-xs text-[#64748b]">No legislators match that filter.</p>
        )}
      </div>
      <p className="mt-2 text-[9px] text-[#475569]">
        Profiles link to Open States, which aggregates each legislator’s official record.
      </p>
    </div>
  );
}

function LegislatorAvatar({ legislator }: { legislator: StateLegislator }) {
  const [broken, setBroken] = useState(false);
  if (!legislator.image || broken) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#312e81] text-[10px] font-semibold text-[#bcd3ee]">
        {legislator.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={legislator.image}
      alt={legislator.name}
      onError={() => setBroken(true)}
      className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-[rgba(148,163,184,0.25)]"
    />
  );
}
