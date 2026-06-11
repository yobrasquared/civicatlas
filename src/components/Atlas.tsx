"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CivicMap, { type HoverInfo, type MapHandle, type ViewContext } from "./CivicMap";
import SidePanel from "./SidePanel";
import SearchBox from "./SearchBox";
import type { Bill, BillsFile, Member, MembersFile, RollCallVote, VotesFile } from "../lib/types";
import { parseGeoid, districtLabel } from "../lib/states";
import { TOPIC_LABELS } from "../lib/status";
import { PartyChip } from "./cards";

export type Selection = {
  state: string;
  district: number | null; // null = statewide view
  geoid: string | null;
  source: "pin" | "view"; // pin = explicit (click/search/zip), view = derived from panning
} | null;

// Zoom thresholds for the panel following the viewport
const STATE_ZOOM = 4.3;
const DISTRICT_ZOOM = 5.8;

const TOPIC_ORDER = [
  "healthcare", "economy", "housing", "education", "environment", "taxes", "immigration",
  "defense", "justice", "technology", "energy", "transportation", "agriculture",
  "elections", "civil-rights", "budget",
];

export default function Atlas() {
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [votes, setVotes] = useState<RollCallVote[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/data/members.json").then((r) => r.json() as Promise<MembersFile>),
      fetch("/data/bills.json").then((r) => r.json() as Promise<BillsFile>),
      fetch("/data/votes.json")
        .then((r) => r.json() as Promise<VotesFile>)
        .catch((): VotesFile => ({ fetched_at: "", source: "", votes: [] })),
    ]).then(([m, b, v]) => {
      setMembers(m.members);
      setBills(b.bills);
      setVotes(v.votes);
      setFetchedAt(b.fetched_at);
    });
  }, []);

  const filteredBills = useMemo(
    () => (topic ? bills.filter((b) => b.topics.includes(topic)) : bills),
    [bills, topic]
  );

  const activity = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const b of filteredBills) {
      if (!b.sponsor?.state) continue;
      const key =
        b.sponsor.chamber === "House"
          ? `${b.sponsor.state}-${b.sponsor.district ?? 0}`
          : `${b.sponsor.state}-SEN`;
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, [filteredBills]);

  const maxActivity = useMemo(
    () => Math.max(1, ...Object.entries(activity).filter(([k]) => !k.endsWith("-SEN")).map(([, v]) => v)),
    [activity]
  );

  const membersBySeat = useMemo(() => {
    const acc: Record<string, Member> = {};
    for (const m of members) if (m.chamber === "House") acc[`${m.state}-${m.district ?? 0}`] = m;
    return acc;
  }, [members]);

  function pinGeoid(geoid: string) {
    const parsed = parseGeoid(geoid);
    if (parsed) setSelection({ ...parsed, geoid, source: "pin" });
  }

  function clearSelection() {
    setSelection(null);
    mapRef.current?.flyNational();
  }

  /** The panel follows the map: derive context from what's under the center after a user move. */
  function handleViewContext({ geoid, zoom }: ViewContext) {
    if (zoom < STATE_ZOOM) {
      setSelection((p) => (p === null ? p : null));
      return;
    }
    if (!geoid) return; // over open water etc. — keep current context
    const parsed = parseGeoid(geoid);
    if (!parsed) return;
    if (zoom >= DISTRICT_ZOOM) {
      setSelection((p) =>
        p && p.state === parsed.state && p.district === parsed.district ? p : { ...parsed, geoid, source: "view" }
      );
    } else {
      setSelection((p) =>
        p && p.state === parsed.state && p.district === null
          ? p
          : { state: parsed.state, district: null, geoid: null, source: "view" }
      );
    }
  }

  // Single sync point: selection drives map highlight + camera
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (!selection) {
      m.selectGeoid(null, { fly: false });
      m.highlightState(null);
      return;
    }
    if (selection.district === null) {
      m.selectGeoid(null, { fly: false });
      m.highlightState(selection.state);
      if (selection.source === "pin") m.flyToState(selection.state);
    } else {
      m.highlightState(null);
      const geoid = selection.geoid ?? m.findSeat(selection.state, selection.district);
      if (geoid) m.selectGeoid(geoid, { fly: selection.source === "pin" });
    }
  }, [selection]);

  async function handleLookup(q: { zip?: string; address?: string }): Promise<string | null> {
    try {
      const params = q.zip ? `zip=${q.zip}` : `address=${encodeURIComponent(q.address!)}`;
      const res = await fetch(`/api/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) return data.error ?? "Lookup failed — try a full street address.";
      pinGeoid(data.geoid);
      return null;
    } catch {
      return "Lookup failed — check your connection and try again.";
    }
  }

  const hoverSeat = hover ? parseGeoid(hover.geoid) : null;
  const hoverMember = hoverSeat ? membersBySeat[`${hoverSeat.state}-${hoverSeat.district}`] : null;
  const hoverCount = hoverSeat ? activity[`${hoverSeat.state}-${hoverSeat.district}`] ?? 0 : 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#060a13]">
      <CivicMap
        ref={mapRef}
        activity={activity}
        maxActivity={maxActivity}
        onSelect={pinGeoid}
        onHover={setHover}
        onViewContext={handleViewContext}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-2 md:p-4">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="glass pointer-events-auto flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#2dd4bf] to-[#818cf8] text-sm font-bold text-[#06251f]">
              ◆
            </div>
            <div className="hidden sm:block">
              <div className="text-[15px] font-semibold leading-none tracking-tight">
                Civic<span className="brand-gradient">Atlas</span>
              </div>
              <div className="mt-1 text-[9px] leading-none text-[#8fa1bb]">
                See what your government is actually doing
              </div>
            </div>
          </div>
          <SearchBox
            members={members}
            bills={bills}
            onPickState={(abbr) => setSelection({ state: abbr, district: null, geoid: null, source: "pin" })}
            onPickMember={(m) => {
              if (m.chamber === "House") {
                setSelection({ state: m.state, district: m.district ?? 0, geoid: null, source: "pin" });
              } else {
                router.push(`/official/${m.id}`);
              }
            }}
            onLookup={handleLookup}
          />
          <div className="glass pointer-events-auto ml-auto hidden items-center gap-2 rounded-2xl px-3 py-3 text-[10px] text-[#8fa1bb] lg:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399] pulse-dot" />
            Nonpartisan · source-linked · live data
          </div>
        </div>

        {/* topic chips */}
        <div className="scroll-slim pointer-events-auto flex gap-1.5 overflow-x-auto pb-1 pr-2 md:pr-[440px]">
          <button className={`chip ${topic === null ? "active" : ""}`} onClick={() => setTopic(null)}>
            All topics
          </button>
          {TOPIC_ORDER.map((t) => (
            <button key={t} className={`chip ${topic === t ? "active" : ""}`} onClick={() => setTopic(topic === t ? null : t)}>
              {TOPIC_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* hover card (pointer devices only — touch goes straight to tap-select) */}
      {hover && hoverSeat && (
        <div
          className="glass pointer-events-none absolute z-20 hidden w-60 rounded-xl p-3 md:block"
          style={{
            left: Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 260),
            top: hover.y + 14,
          }}
        >
          <div className="text-[12px] font-semibold text-[#f1f6fc]">{districtLabel(hoverSeat.state, hoverSeat.district)}</div>
          {hoverMember && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#cbd5e1]">
              <PartyChip party={hoverMember.party} /> Rep. {hoverMember.name}
            </div>
          )}
          <div className="mt-1 text-[10px] text-[#5eead4]">
            {hoverCount} bill{hoverCount === 1 ? "" : "s"} sponsored here recently{topic ? ` · ${TOPIC_LABELS[topic]}` : ""}
          </div>
          <div className="mt-1 text-[9px] text-[#64748b]">Click to explore this district</div>
        </div>
      )}

      {/* legend */}
      <div className="glass pointer-events-auto absolute bottom-4 left-4 z-10 hidden rounded-xl px-3.5 py-2.5 md:block">
        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
          Legislative activity {topic ? `· ${TOPIC_LABELS[topic]}` : ""}
        </div>
        <div className="mt-1.5 h-1.5 w-44 rounded-full" style={{ background: "linear-gradient(90deg, rgba(94,118,160,0.25), rgba(45,160,200,0.55), rgba(94,234,212,0.9))" }} />
        <div className="mt-1 flex justify-between text-[9px] text-[#64748b]">
          <span>fewer bills</span>
          <span>more bills</span>
        </div>
        <div className="mt-1 max-w-44 text-[8px] leading-snug text-[#475569]">
          Bills sponsored by each seat’s member in the recent window · GovTrack/Congress.gov
        </div>
      </div>

      <SidePanel
        selection={selection}
        members={members}
        bills={bills}
        votes={votes}
        topic={topic}
        activity={activity}
        fetchedAt={fetchedAt}
        onClear={clearSelection}
        onPickState={(abbr) => setSelection({ state: abbr, district: null, geoid: null, source: "pin" })}
        onPickSeat={(key) => {
          const state = key.slice(0, 2);
          const district = parseInt(key.slice(3), 10);
          setSelection({ state, district, geoid: null, source: "pin" });
        }}
      />
    </div>
  );
}
