"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CivicMap, { type HoverInfo, type MapHandle } from "./CivicMap";
import SidePanel from "./SidePanel";
import SearchBox from "./SearchBox";
import type { Bill, BillsFile, Member, MembersFile } from "../lib/types";
import { parseGeoid, districtLabel } from "../lib/states";
import { TOPIC_LABELS } from "../lib/status";
import { PartyChip } from "./cards";

type Selection = { state: string; district: number; geoid: string } | null;

const TOPIC_ORDER = [
  "healthcare", "economy", "housing", "education", "environment", "taxes", "immigration",
  "defense", "justice", "technology", "energy", "transportation", "agriculture",
  "elections", "civil-rights", "budget",
];

export default function Atlas() {
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
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
    ]).then(([m, b]) => {
      setMembers(m.members);
      setBills(b.bills);
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

  function selectGeoid(geoid: string | null) {
    if (!geoid) {
      setSelection(null);
      mapRef.current?.selectGeoid(null);
      return;
    }
    const parsed = parseGeoid(geoid);
    if (!parsed) return;
    setSelection({ ...parsed, geoid });
    mapRef.current?.selectGeoid(geoid);
  }

  async function handleLookup(q: { zip?: string; address?: string }): Promise<string | null> {
    try {
      const params = q.zip ? `zip=${q.zip}` : `address=${encodeURIComponent(q.address!)}`;
      const res = await fetch(`/api/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) return data.error ?? "Lookup failed — try a full street address.";
      selectGeoid(data.geoid);
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
        onSelect={selectGeoid}
        onHover={setHover}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
        <div className="flex items-center gap-4">
          <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#2dd4bf] to-[#818cf8] text-sm font-bold text-[#06251f]">
              ◆
            </div>
            <div>
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
            onPickState={(abbr) => mapRef.current?.flyToState(abbr)}
            onPickMember={(m) => {
              if (m.chamber === "House") {
                const geoid = mapRef.current?.selectSeat(m.state, m.district ?? 0);
                if (geoid) setSelection({ state: m.state, district: m.district ?? 0, geoid });
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
        <div className="scroll-slim pointer-events-auto flex gap-1.5 overflow-x-auto pb-1 pr-[440px]">
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

      {/* hover card */}
      {hover && hoverSeat && (
        <div
          className="glass pointer-events-none absolute z-20 w-60 rounded-xl p-3"
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
        topic={topic}
        activity={activity}
        fetchedAt={fetchedAt}
        onClear={() => selectGeoid(null)}
        onPickSeat={(key) => {
          const state = key.slice(0, 2);
          const district = parseInt(key.slice(3), 10);
          const geoid = mapRef.current?.selectSeat(state, district);
          if (geoid) setSelection({ state, district, geoid });
        }}
      />
    </div>
  );
}
