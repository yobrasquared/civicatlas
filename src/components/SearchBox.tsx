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

type StateHit = [abbr: string, name: string];
type SearchAction =
  | { key: string; group: "States"; kind: "state"; title: string; sub: string; icon: string; run: () => void }
  | { key: string; group: "Officials"; kind: "member"; title: string; sub: string; icon: string; run: () => void }
  | { key: string; group: "Legislation"; kind: "bill"; bill: Bill; run: () => void }
  | { key: string; group: null; kind: "lookup"; title: string; sub: string; icon: string; run: () => void | Promise<void> };

const STARTER_STATES = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));

export default function SearchBox({ members, bills, onPickState, onPickMember, onLookup }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
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
    if (norm.length < 2 || isZip) return { members: [], bills: [], states: [], hasExactState: false, hasExactMember: false };
    const allStateHits = Object.entries(STATE_NAMES)
      .filter(([abbr, name]) => name.toLowerCase().startsWith(norm) || abbr.toLowerCase() === norm)
      .sort(([abbrA, nameA], [abbrB, nameB]) => {
        const score = (abbr: string, name: string) =>
          abbr.toLowerCase() === norm || name.toLowerCase() === norm ? 0 : name.toLowerCase().startsWith(norm) ? 1 : 2;
        return score(abbrA, nameA) - score(abbrB, nameB) || nameA.localeCompare(nameB);
      });
    const stateHits = allStateHits.slice(0, 3) as StateHit[];
    const hasExactState = allStateHits.some(([abbr, name]) => abbr.toLowerCase() === norm || name.toLowerCase() === norm);
    const memberHits = members
      .filter((m) => m.name.toLowerCase().includes(norm) || m.last.toLowerCase().startsWith(norm))
      .sort((a, b) => {
        const score = (m: Member) =>
          m.name.toLowerCase() === norm ? 0 : m.last.toLowerCase() === norm ? 1 : m.last.toLowerCase().startsWith(norm) ? 2 : 3;
        return score(a) - score(b) || a.name.localeCompare(b.name);
      })
      .slice(0, 5);
    const hasExactMember = memberHits.some((m) => m.name.toLowerCase() === norm || m.last.toLowerCase() === norm);
    const billNorm = norm.replace(/[.\s]/g, "");
    const billLimit = hasExactState || hasExactMember ? 2 : 5;
    const billHits = bills
      .filter(
        (b) =>
          b.number.toLowerCase().replace(/[.\s]/g, "").includes(billNorm) ||
          b.title.toLowerCase().includes(norm)
      )
      .slice(0, billLimit);
    return { members: memberHits, bills: billHits, states: stateHits, hasExactState, hasExactMember };
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

  function pickState(abbr: string) {
    onPickState(abbr);
    setOpen(false);
    setQ("");
    setActiveIndex(0);
  }

  function pickMember(m: Member) {
    onPickMember(m);
    setOpen(false);
    setQ("");
    setActiveIndex(0);
  }

  function pickBill(b: Bill) {
    router.push(`/bill/${b.id}`);
    setOpen(false);
    setActiveIndex(0);
  }

  const actions: SearchAction[] = [];
  if (isZip || looksLikeAddress) {
    actions.push({
      key: "lookup",
      group: null,
      kind: "lookup",
      title: `Find my district for ${isZip ? `ZIP ${norm}` : q.trim()}`,
      sub: `Located via U.S. Census geocoder; your ${isZip ? "ZIP" : "address"} is not stored`,
      icon: "⌖",
      run: runLookup,
    });
  }
  for (const [abbr, name] of results.states) {
    actions.push({ key: `state-${abbr}`, group: "States", kind: "state", title: name, sub: "Zoom to state", icon: "ST", run: () => pickState(abbr) });
  }
  for (const m of results.members) {
    actions.push({
      key: `member-${m.id}`,
      group: "Officials",
      kind: "member",
      title: m.name,
      sub: `${m.title} · ${STATE_NAMES[m.state] ?? m.state}${m.chamber === "House" && (m.district ?? 0) > 0 ? ` District ${m.district}` : ""}`,
      icon: m.party?.[0]?.toUpperCase() ?? "?",
      run: () => pickMember(m),
    });
  }
  for (const b of results.bills) actions.push({ key: `bill-${b.id}`, group: "Legislation", kind: "bill", bill: b, run: () => pickBill(b) });

  const groupedActions = actions.reduce<Record<string, SearchAction[]>>((acc, action) => {
    const group = action.group ?? "Lookup";
    acc[group] ??= [];
    acc[group].push(action);
    return acc;
  }, {});
  const hasSearchContent = actions.length > 0;
  const showStarter = open && norm.length === 0 && !error;
  const showResults = open && (norm.length >= 2 || error);

  function moveActive(delta: number) {
    if (actions.length === 0) return;
    setActiveIndex((i) => (i + delta + actions.length) % actions.length);
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
            setActiveIndex(0);
          }}
          onPointerDown={() => setOpen(true)}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onClick={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              moveActive(1);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              moveActive(-1);
            }
            if (e.key === "Enter") {
              const action = actions[Math.min(activeIndex, actions.length - 1)];
              if (action) {
                e.preventDefault();
                action.run();
              } else if (isZip || looksLikeAddress) {
                e.preventDefault();
                runLookup();
              }
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Enter ZIP/address, pick a state, or search bills and officials"
          className="w-full bg-transparent text-[13px] text-[#e6edf7] placeholder-[#64748b] outline-none"
        />
        {busy && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#2dd4bf] border-t-transparent" />}
      </div>

      {showStarter && (
        <div className="glass scroll-slim absolute top-full z-30 mt-2 max-h-[60vh] w-full overflow-y-auto rounded-2xl p-2">
          <div className="rounded-xl border border-[rgba(45,212,191,0.22)] bg-[rgba(45,212,191,0.08)] px-3 py-2.5">
            <div className="text-[12px] font-semibold text-[#d8fff8]">Start with your place</div>
            <div className="mt-0.5 text-[10px] leading-relaxed text-[#8fa1bb]">
              Enter a ZIP or street address to find your district, or pick a state below.
            </div>
          </div>
          <GroupLabel>Pick a state</GroupLabel>
          <div className="grid grid-cols-4 gap-1 px-1 pb-1 sm:grid-cols-6">
            {STARTER_STATES.map(([abbr, name]) => (
              <button
                key={abbr}
                onClick={() => pickState(abbr)}
                className="rounded-lg border border-[rgba(148,163,184,0.12)] bg-[rgba(148,163,184,0.05)] px-2 py-1.5 text-[11px] font-semibold text-[#dbe5f1] transition-colors hover:border-[rgba(94,234,212,0.35)] hover:bg-[rgba(45,212,191,0.08)] hover:text-[#5eead4]"
                title={name}
              >
                {abbr}
              </button>
            ))}
          </div>
        </div>
      )}

      {showResults && (
        <div className="glass scroll-slim absolute top-full z-30 mt-2 max-h-[60vh] w-full overflow-y-auto rounded-2xl p-2">
          {error && <div className="px-3 py-2 text-xs text-[#fb923c]">{error}</div>}

          {Object.entries(groupedActions).map(([group, groupActions]) => (
            <div key={group}>
              {group !== "Lookup" && <GroupLabel>{group}</GroupLabel>}
              {groupActions.map((action) => {
                const index = actions.findIndex((a) => a.key === action.key);
                const active = index === activeIndex;
                if (action.kind === "bill") return <BillResult key={action.key} bill={action.bill} active={active} onClick={action.run} onMouseEnter={() => setActiveIndex(index)} />;
                return (
                  <ResultRow
                    key={action.key}
                    icon={action.icon}
                    title={action.title}
                    sub={action.sub}
                    active={active}
                    disabled={action.kind === "lookup" && busy}
                    onClick={action.run}
                    onMouseEnter={() => setActiveIndex(index)}
                  />
                );
              })}
            </div>
          ))}

          {!isZip && !looksLikeAddress && !hasSearchContent && !error && (
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

function ResultRow({
  icon,
  title,
  sub,
  active,
  disabled,
  onClick,
  onMouseEnter,
}: {
  icon: string;
  title: string;
  sub: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={disabled}
      data-active={active ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
        active ? "bg-[rgba(45,212,191,0.1)]" : "hover:bg-[rgba(148,163,184,0.07)]"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(148,163,184,0.08)] text-[10px] font-semibold text-[#5eead4]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-[#e6edf7]">{title}</span>
        <span className="block truncate text-[10px] text-[#8fa1bb]">{sub}</span>
      </span>
    </button>
  );
}

function BillResult({ bill, active, onClick, onMouseEnter }: { bill: Bill; active: boolean; onClick: () => void; onMouseEnter: () => void }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-active={active ? "true" : undefined}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
        active ? "bg-[rgba(45,212,191,0.1)]" : "hover:bg-[rgba(148,163,184,0.07)]"
      }`}
    >
      <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold text-[#7dd3fc]">{bill.number}</span>
      <span className="min-w-0 flex-1">
        <span className="block line-clamp-1 text-[12px] leading-snug text-[#e6edf7]">{bill.title}</span>
        {bill.sponsor && (
          <span className="mt-0.5 block truncate text-[10px] text-[#8fa1bb]">
            {bill.sponsor.name} ({bill.sponsor.state}) · {bill.status_date}
          </span>
        )}
      </span>
      <StatusBadge bill={bill} />
    </button>
  );
}
