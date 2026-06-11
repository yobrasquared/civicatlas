"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bill, Member } from "../lib/types";
import { STATE_NAMES } from "../lib/states";
import { StatusBadge } from "./cards";

type Props = {
  members: Member[];
  bills: Bill[];
  onPickState: (abbr: string) => void;
  onPickMember: (m: Member) => void;
  onLookup: (q: { zip?: string; address?: string }) => Promise<string | null>; // returns error message or null
};

export default function SearchBox({ members, bills, onPickState, onPickMember, onLookup }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const norm = q.trim().toLowerCase();
  const isZip = /^\d{5}(-\d{4})?$/.test(norm);
  // "H.R. 9238", "S. 47", "H.Res. 1335" etc. are bill lookups, not street addresses
  const looksLikeBillNumber = /^(h|s)\.?\s*(r|j|con)?\.?\s*(res)?\.?\s*\d+$/i.test(norm.replace(/\s+/g, " "));
  const looksLikeAddress = !isZip && !looksLikeBillNumber && /\d/.test(norm) && norm.length > 8;

  const results = useMemo(() => {
    if (norm.length < 2 || isZip) return { members: [], bills: [], states: [] };
    const stateHits = Object.entries(STATE_NAMES)
      .filter(([abbr, name]) => name.toLowerCase().startsWith(norm) || abbr.toLowerCase() === norm)
      .slice(0, 3);
    const memberHits = members
      .filter((m) => m.name.toLowerCase().includes(norm) || m.last.toLowerCase().startsWith(norm))
      .slice(0, 5);
    const billNorm = norm.replace(/[.\s]/g, "");
    const billHits = bills
      .filter(
        (b) =>
          b.number.toLowerCase().replace(/[.\s]/g, "").includes(billNorm) ||
          b.title.toLowerCase().includes(norm)
      )
      .slice(0, 6);
    return { members: memberHits, bills: billHits, states: stateHits };
  }, [norm, isZip, members, bills]);

  async function runLookup() {
    setBusy(true);
    setError(null);
    const err = await onLookup(isZip ? { zip: norm } : { address: q.trim() });
    setBusy(false);
    if (err) setError(err);
    else {
      setOpen(false);
      setQ("");
    }
  }

  return (
    <div ref={boxRef} className="pointer-events-auto relative w-full max-w-xl">
      <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2.5 md:px-4 md:py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#5eead4]">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (isZip || looksLikeAddress)) runLookup();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search a bill, representative, state — or enter your ZIP / address"
          className="w-full bg-transparent text-[13px] text-[#e6edf7] placeholder-[#64748b] outline-none"
        />
        {busy && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#2dd4bf] border-t-transparent" />}
      </div>

      {open && (norm.length >= 2 || error) && (
        <div className="glass scroll-slim absolute top-full z-30 mt-2 max-h-[60vh] w-full overflow-y-auto rounded-2xl p-2">
          {error && <div className="px-3 py-2 text-xs text-[#fb923c]">{error}</div>}

          {(isZip || looksLikeAddress) && (
            <button
              onClick={runLookup}
              disabled={busy}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(45,212,191,0.08)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(45,212,191,0.12)] text-sm">📍</span>
              <span>
                <span className="block text-[13px] text-[#e6edf7]">
                  Find my district for {isZip ? `ZIP ${norm}` : `“${q.trim()}”`}
                </span>
                <span className="block text-[10px] text-[#8fa1bb]">
                  Located via U.S. Census geocoder · your {isZip ? "ZIP" : "address"} is not stored
                </span>
              </span>
            </button>
          )}

          {results.states.length > 0 && <GroupLabel>States</GroupLabel>}
          {results.states.map(([abbr, name]) => (
            <ResultRow key={abbr} icon="🗺" title={name} sub="Zoom to state" onClick={() => { onPickState(abbr); setOpen(false); setQ(""); }} />
          ))}

          {results.members.length > 0 && <GroupLabel>Officials</GroupLabel>}
          {results.members.map((m) => (
            <ResultRow
              key={m.id}
              icon="👤"
              title={m.name}
              sub={`${m.title} · ${STATE_NAMES[m.state] ?? m.state}${m.chamber === "House" && (m.district ?? 0) > 0 ? ` District ${m.district}` : ""}`}
              onClick={() => { onPickMember(m); setOpen(false); setQ(""); }}
            />
          ))}

          {results.bills.length > 0 && <GroupLabel>Legislation</GroupLabel>}
          {results.bills.map((b) => (
            <button
              key={b.id}
              onClick={() => { router.push(`/bill/${b.id}`); setOpen(false); }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(148,163,184,0.07)]"
            >
              <span className="mt-0.5 font-mono text-[10px] font-semibold text-[#7dd3fc]">{b.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[#e6edf7]">{b.title}</span>
              </span>
              <StatusBadge bill={b} />
            </button>
          ))}

          {!isZip && !looksLikeAddress && results.states.length + results.members.length + results.bills.length === 0 && !error && (
            <div className="px-3 py-3 text-xs text-[#64748b]">
              No matches in the current data window. Try a bill number (e.g. “H.R. 1”), an official’s name, a state — or a 5-digit ZIP.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#475569]">{children}</div>;
}

function ResultRow({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(148,163,184,0.07)]">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(148,163,184,0.08)] text-sm">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-[#e6edf7]">{title}</span>
        <span className="block truncate text-[10px] text-[#8fa1bb]">{sub}</span>
      </span>
    </button>
  );
}
