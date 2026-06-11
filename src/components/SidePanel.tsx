"use client";

import { useState } from "react";
import type { Bill, Member } from "../lib/types";
import { districtLabel } from "../lib/states";
import { fmtDate } from "../lib/status";
import { BillRow, RepCard } from "./cards";

type Selection = { state: string; district: number; geoid: string } | null;

type Props = {
  selection: Selection;
  members: Member[];
  bills: Bill[];
  topic: string | null;
  activity: Record<string, number>;
  fetchedAt: string | null;
  onClear: () => void;
  onPickSeat: (seatKey: string) => void;
};

const TABS = ["Moving now", "New laws", "Most active"] as const;

export default function SidePanel({ selection, members, bills, topic, activity, fetchedAt, onClear, onPickSeat }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Moving now");

  const topicBills = topic ? bills.filter((b) => b.topics.includes(topic)) : bills;

  if (selection) {
    const delegation = members.filter(
      (m) =>
        m.state === selection.state &&
        (m.chamber === "Senate" || (m.district ?? 0) === selection.district)
    );
    const ids = new Set(delegation.map((m) => m.id));
    const delegationBills = topicBills
      .filter((b) => b.sponsor && ids.has(b.sponsor.id))
      .sort((a, b) => b.status_date.localeCompare(a.status_date));
    const countFor = (m: Member) => topicBills.filter((b) => b.sponsor?.id === m.id).length;
    const rep = delegation.filter((m) => m.chamber === "House");
    const senators = delegation.filter((m) => m.chamber === "Senate");

    return (
      <Panel>
        <div className="rise">
          <button onClick={onClear} className="mb-3 text-[11px] text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
            ← Back to national view
          </button>
          <h2 className="text-[17px] font-semibold leading-tight text-[#f1f6fc]">
            {districtLabel(selection.state, selection.district)}
          </h2>
          <p className="mt-1 text-[11px] text-[#8fa1bb]">
            {delegationBills.length} bill{delegationBills.length === 1 ? "" : "s"} from this delegation in the
            recent window{topic ? ` · filtered by topic` : ""}
          </p>

          <div className="mt-4 space-y-2">
            <SectionLabel>Your representative</SectionLabel>
            {rep.length > 0 ? (
              rep.map((m) => <RepCard key={m.id} member={m} billCount={countFor(m)} />)
            ) : (
              <p className="px-1 text-xs text-[#64748b]">No House member found for this seat in the current roster.</p>
            )}
            <SectionLabel>Senators</SectionLabel>
            {senators.map((m) => (
              <RepCard key={m.id} member={m} billCount={countFor(m)} />
            ))}
          </div>

          <div className="mt-5">
            <SectionLabel>Recent bills from this delegation</SectionLabel>
            <div className="mt-1 space-y-0.5">
              {delegationBills.slice(0, 15).map((b) => (
                <BillRow key={b.id} bill={b} />
              ))}
              {delegationBills.length === 0 && (
                <p className="px-1 py-3 text-xs text-[#64748b]">
                  No bills from this delegation in the current data window{topic ? " for this topic — try clearing the filter" : ""}.
                </p>
              )}
            </div>
          </div>
          <Freshness fetchedAt={fetchedAt} />
        </div>
      </Panel>
    );
  }

  const moving = topicBills
    .filter((b) => b.status !== "law")
    .sort((a, b) => b.status_date.localeCompare(a.status_date));
  const laws = topicBills
    .filter((b) => b.status === "law")
    .sort((a, b) => b.status_date.localeCompare(a.status_date));
  const seats = Object.entries(activity)
    .filter(([k]) => !k.endsWith("-SEN"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <Panel>
      <div className="rise">
        <h2 className="text-[17px] font-semibold leading-tight text-[#f1f6fc]">Live from the 119th Congress</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8fa1bb]">
          Real legislation, real votes, real laws — every item links to the official record. Click any district, or
          search your ZIP code to find your representatives.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat n={String(members.length)} label="members" />
          <Stat n={String(topicBills.length)} label="bills tracked" />
          <Stat n={String(laws.length)} label="became law" />
        </div>

        <div className="mt-4 flex gap-1 rounded-xl bg-[rgba(148,163,184,0.07)] p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                tab === t ? "bg-[rgba(45,212,191,0.15)] text-[#5eead4]" : "text-[#8fa1bb] hover:text-[#cbd5e1]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-0.5">
          {tab === "Moving now" && moving.slice(0, 20).map((b) => <BillRow key={b.id} bill={b} />)}
          {tab === "New laws" && laws.slice(0, 20).map((b) => <BillRow key={b.id} bill={b} />)}
          {tab === "Most active" && (
            <div className="space-y-1 pt-1">
              {seats.map(([key, count], i) => {
                const [st, dist] = [key.slice(0, 2), parseInt(key.slice(3), 10)];
                return (
                  <button
                    key={key}
                    onClick={() => onPickSeat(key)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[rgba(148,163,184,0.07)]"
                  >
                    <span className="w-5 text-right font-mono text-[11px] text-[#475569]">{i + 1}</span>
                    <span className="flex-1 text-[13px] text-[#dbe5f1]">{districtLabel(st, dist)}</span>
                    <span className="rounded-full bg-[rgba(45,212,191,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[#5eead4]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {tab !== "Most active" && (tab === "Moving now" ? moving : laws).length === 0 && (
            <p className="px-1 py-3 text-xs text-[#64748b]">Nothing in this view for the selected topic.</p>
          )}
        </div>
        <Freshness fetchedAt={fetchedAt} />
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass scroll-slim pointer-events-auto absolute top-[118px] bottom-4 right-4 w-[420px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl p-4">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">{children}</div>;
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-xl border border-[rgba(148,163,184,0.12)] bg-[rgba(148,163,184,0.04)] px-3 py-2.5 text-center">
      <div className="text-lg font-semibold text-[#f1f6fc]">{n}</div>
      <div className="text-[10px] text-[#8fa1bb]">{label}</div>
    </div>
  );
}

function Freshness({ fetchedAt }: { fetchedAt: string | null }) {
  if (!fetchedAt) return null;
  return (
    <div className="mt-5 flex items-center gap-2 rounded-xl border border-[rgba(148,163,184,0.1)] px-3 py-2 text-[10px] text-[#64748b]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399]" />
      Data fetched {fmtDate(fetchedAt.slice(0, 10))} from official sources via Congress.gov roster & GovTrack ·
      boundaries: U.S. Census
    </div>
  );
}
