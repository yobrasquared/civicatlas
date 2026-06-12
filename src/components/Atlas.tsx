"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFollows } from "../lib/follows";
import CivicMap, { type HoverInfo, type MapHandle, type ViewContext } from "./CivicMap";
import SidePanel from "./SidePanel";
import SearchBox from "./SearchBox";
import type { Bill, BillsFile, Member, MembersFile, RollCallVote, VotesFile } from "../lib/types";
import { STATE_NAMES, parseGeoid, districtLabel } from "../lib/states";
import { TOPIC_LABELS } from "../lib/status";
import { PartyChip } from "./cards";

export type Selection = {
  state: string;
  district: number | null; // null = statewide view
  geoid: string | null;
  source: "pin" | "view"; // pin = explicit (click/search/zip), view = derived from panning
} | null;

// Zoom thresholds for the panel following the viewport
const STATE_ZOOM = 4.0;
const DISTRICT_ZOOM = 5.5;

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
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapHandle>(null);
  const router = useRouter();
  const follows = useFollows();
  const followCount = follows.bills.length + follows.members.length;

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

  /** Read ?seat=CA-12 / ?state=TX from the URL into a selection. */
  function applyUrlSelection(allowClear: boolean) {
    const sp = new URLSearchParams(window.location.search);
    const seat = sp.get("seat")?.toUpperCase();
    const st = sp.get("state")?.toUpperCase();
    if (seat && /^[A-Z]{2}-\d{1,2}$/.test(seat)) {
      const [s, d] = seat.split("-");
      setSelection({ state: s, district: parseInt(d, 10), geoid: null, source: "pin" });
    } else if (st && /^[A-Z]{2}$/.test(st)) {
      setSelection({ state: st, district: null, geoid: null, source: "pin" });
    } else if (allowClear) {
      setSelection(null);
      mapRef.current?.flyNational();
    }
  }

  // Deep links: apply the URL once the map can fly; back/forward re-applies
  useEffect(() => {
    if (!mapReady) return;
    applyUrlSelection(false);
    const onPop = () => applyUrlSelection(true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // Selection → shareable URL (pins create history entries; panning just updates in place)
  useEffect(() => {
    if (!mapReady) return;
    const target = !selection
      ? "/"
      : selection.district === null
        ? `/?state=${selection.state}`
        : `/?seat=${selection.state}-${selection.district}`;
    if (window.location.pathname + window.location.search === target) return;
    if (selection?.source === "pin") window.history.pushState(null, "", target);
    else window.history.replaceState(null, "", target);
  }, [selection, mapReady]);

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
  }, [selection, mapReady]);

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

  const hoverDetails = useMemo(() => {
    if (!hover) return null;
    const seat = parseGeoid(hover.geoid);
    if (!seat) return null;

    const seatKey = `${seat.state}-${seat.district}`;
    return {
      geoid: hover.geoid,
      x: hover.x,
      y: hover.y,
      seat,
      stateName: STATE_NAMES[seat.state] ?? seat.state,
      districtName: seat.district === 0 ? "At-Large District" : `District ${seat.district}`,
      fullDistrictName: districtLabel(seat.state, seat.district),
      member: membersBySeat[seatKey] ?? null,
      count: activity[seatKey] ?? 0,
    };
  }, [activity, hover, membersBySeat]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#060a13]">
      <CivicMap
        ref={mapRef}
        activity={activity}
        maxActivity={maxActivity}
        onSelect={pinGeoid}
        onHover={setHover}
        onViewContext={handleViewContext}
        onReady={() => setMapReady(true)}
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
          <Link
            href="/digest"
            className="glass pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2.5 text-[12px] font-semibold text-[#5eead4] transition-colors hover:text-[#a7f3d0] md:py-3"
            title="Your civic digest — bills and representatives you follow"
          >
            ★
            <span className="hidden sm:inline">Digest</span>
            {followCount > 0 && (
              <span className="rounded-full bg-[rgba(45,212,191,0.15)] px-1.5 text-[10px] text-[#5eead4]">
                {followCount}
              </span>
            )}
          </Link>
          <div className="glass pointer-events-auto ml-auto hidden items-center gap-2 rounded-2xl px-3 py-3 text-[10px] text-[#8fa1bb] lg:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399] pulse-dot" />
            Nonpartisan · source-linked · live data
          </div>
        </div>

        {/* topic chips */}
        <div className="no-scrollbar pointer-events-auto flex gap-1.5 overflow-x-auto pb-1 pr-2 md:pr-[440px]">
          <button className={`chip ${topic === null ? "active" : ""}`} onClick={() => setTopic(null)}>
            All topics
          </button>
          {TOPIC_ORDER.map((t) => (
            <button key={t} className={`chip ${topic === t ? "active" : ""}`} onClick={() => setTopic(topic === t ? null : t)}>
              {TOPIC_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto hidden w-fit max-w-xl rounded-xl border border-[rgba(94,234,212,0.2)] bg-[rgba(6,10,19,0.72)] px-3 py-2 text-[11px] text-[#8fa1bb] shadow-[0_8px_24px_rgba(2,6,16,0.45)] backdrop-blur md:block">
          {hoverDetails ? (
            <>
              Hovering: <span className="font-semibold text-[#e6edf7]">{hoverDetails.stateName}</span>
              <span className="text-[#475569]"> / </span>
              <span className="font-semibold text-[#5eead4]">{hoverDetails.districtName}</span>
            </>
          ) : (
            <>Move the mouse over any district to identify its state and district.</>
          )}
        </div>
      </div>

      {/* hover card (pointer devices only — touch goes straight to tap-select) */}
      {hoverDetails && (
        <div
          key={hoverDetails.geoid}
          className="glass pointer-events-none absolute z-20 hidden w-72 rounded-xl p-3 md:block"
          style={{
            left: Math.min(hoverDetails.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300),
            top: Math.min(hoverDetails.y + 14, (typeof window !== "undefined" ? window.innerHeight : 800) - 180),
          }}
        >
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Map hover</div>
          <div className="mt-1 text-[13px] font-semibold text-[#f1f6fc]">{hoverDetails.stateName}</div>
          <div className="mt-0.5 text-[12px] text-[#5eead4]">
            {hoverDetails.districtName} <span className="text-[#64748b]">({hoverDetails.fullDistrictName})</span>
          </div>
          {hoverDetails.member && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#cbd5e1]">
              <PartyChip party={hoverDetails.member.party} /> Rep. {hoverDetails.member.name}
            </div>
          )}
          <div className="mt-1 text-[10px] text-[#5eead4]">
            {hoverDetails.count} bill{hoverDetails.count === 1 ? "" : "s"} sponsored here recently{topic ? ` · ${TOPIC_LABELS[topic]}` : ""}
          </div>
          <div className="mt-1 text-[9px] text-[#64748b]">Click to pin this district and open its details</div>
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
