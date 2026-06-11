"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Bill, Member, RollCallVote } from "../lib/types";
import type { Selection } from "./Atlas";
import { STATE_NAMES, districtLabel } from "../lib/states";
import { fmtDate } from "../lib/status";
import { BillRow, RepCard } from "./cards";
import { PositionBadge } from "./votes";

type Props = {
  selection: Selection;
  members: Member[];
  bills: Bill[];
  votes: RollCallVote[];
  topic: string | null;
  activity: Record<string, number>;
  fetchedAt: string | null;
  onClear: () => void;
  onPickState: (abbr: string) => void;
  onPickSeat: (seatKey: string) => void;
};

const TABS = ["Moving now", "New laws", "Most active"] as const;

export default function SidePanel({ selection, members, bills, votes, topic, activity, fetchedAt, onClear, onPickState, onPickSeat }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Moving now");
  // Mobile bottom-sheet state; ignored on md+ where the panel is a fixed side dock.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    // only explicit selections (click/search/ZIP) pop the sheet open — panning shouldn't
    if (selection && selection.source === "pin") setExpanded(true);
  }, [selection]);
  const sheet = { expanded, onToggle: () => setExpanded((e) => !e) };

  const topicBills = topic ? bills.filter((b) => b.topics.includes(topic)) : bills;

  if (selection && selection.district === null) {
    return (
      <Panel {...sheet}>
        <StateView
          key={selection.state}
          state={selection.state}
          members={members}
          bills={topicBills}
          topic={topic}
          fetchedAt={fetchedAt}
          onClear={onClear}
        />
      </Panel>
    );
  }

  if (selection && selection.district !== null) {
    const district = selection.district;
    const delegation = members.filter(
      (m) => m.state === selection.state && (m.chamber === "Senate" || (m.district ?? 0) === district)
    );
    const ids = new Set(delegation.map((m) => m.id));
    const delegationBills = topicBills
      .filter((b) => b.sponsor && ids.has(b.sponsor.id))
      .sort((a, b) => b.status_date.localeCompare(a.status_date));
    const countFor = (m: Member) => topicBills.filter((b) => b.sponsor?.id === m.id).length;
    const rep = delegation.filter((m) => m.chamber === "House");
    const senators = delegation.filter((m) => m.chamber === "Senate");

    return (
      <Panel {...sheet}>
        <div className="rise">
          <button onClick={onClear} className="mb-3 text-[11px] text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
            ← Back to national view
          </button>
          <h2 className="text-[17px] font-semibold leading-tight text-[#f1f6fc]">
            {districtLabel(selection.state, district)}
          </h2>
          <p className="mt-1 text-[11px] text-[#8fa1bb]">
            {delegationBills.length} bill{delegationBills.length === 1 ? "" : "s"} from this delegation in the
            recent window{topic ? ` · filtered by topic` : ""}
          </p>
          <button
            onClick={() => onPickState(selection.state)}
            className="mt-1.5 text-[11px] text-[#7dd3fc] transition-colors hover:text-[#5eead4]"
          >
            View all of {STATE_NAMES[selection.state] ?? selection.state} →
          </button>

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

          <DelegationVotes delegation={delegation} votes={votes} bills={bills} />

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
    <Panel {...sheet}>
      <div className="rise">
        <h2 className="text-[17px] font-semibold leading-tight text-[#f1f6fc]">Live from the 119th Congress</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8fa1bb]">
          Real legislation, real votes, real laws — every item links to the official record. Move the map and this
          panel follows: zoom into a state or district, click one, or search your ZIP code.
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

function StateView({
  state,
  members,
  bills,
  topic,
  fetchedAt,
  onClear,
}: {
  state: string;
  members: Member[];
  bills: Bill[];
  topic: string | null;
  fetchedAt: string | null;
  onClear: () => void;
}) {
  const delegation = members.filter((m) => m.state === state);
  const counts = new Map<string, number>();
  for (const b of bills) if (b.sponsor && b.sponsor.state === state) counts.set(b.sponsor.id, (counts.get(b.sponsor.id) ?? 0) + 1);
  const countFor = (m: Member) => counts.get(m.id) ?? 0;
  const senators = delegation.filter((m) => m.chamber === "Senate");
  const house = delegation
    .filter((m) => m.chamber === "House")
    .sort((a, b) => countFor(b) - countFor(a) || (a.district ?? 0) - (b.district ?? 0));
  const stateBills = bills
    .filter((b) => b.sponsor?.state === state)
    .sort((a, b) => b.status_date.localeCompare(a.status_date));

  return (
    <div className="rise">
      <button onClick={onClear} className="mb-3 text-[11px] text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
        ← Back to national view
      </button>
      <h2 className="text-[17px] font-semibold leading-tight text-[#f1f6fc]">{STATE_NAMES[state] ?? state}</h2>
      <p className="mt-1 text-[11px] text-[#8fa1bb]">
        {stateBills.length} bill{stateBills.length === 1 ? "" : "s"} from this state’s delegation in the recent
        window{topic ? " · filtered by topic" : ""} · zoom in on the map for district detail
      </p>

      <div className="mt-4 space-y-2">
        <SectionLabel>Senators</SectionLabel>
        {senators.map((m) => (
          <RepCard key={m.id} member={m} billCount={countFor(m)} />
        ))}
        {house.length > 0 && (
          <>
            <SectionLabel>
              House delegation ({house.length}) — by recent activity
            </SectionLabel>
            <div className="scroll-slim max-h-72 space-y-2 overflow-y-auto pr-1">
              {house.map((m) => (
                <RepCard key={m.id} member={m} billCount={countFor(m)} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-5">
        <SectionLabel>Recent bills from {STATE_NAMES[state] ?? state}</SectionLabel>
        <div className="mt-1 space-y-0.5">
          {stateBills.slice(0, 12).map((b) => (
            <BillRow key={b.id} bill={b} />
          ))}
          {stateBills.length === 0 && (
            <p className="px-1 py-3 text-xs text-[#64748b]">
              No bills from this delegation in the current data window{topic ? " for this topic — try clearing the filter" : ""}.
            </p>
          )}
        </div>
      </div>
      <Freshness fetchedAt={fetchedAt} />
    </div>
  );
}

function DelegationVotes({ delegation, votes, bills }: { delegation: Member[]; votes: RollCallVote[]; bills: Bill[] }) {
  const billById = new Map(bills.map((b) => [b.id, b]));
  const relevant = votes
    .filter((v) => delegation.some((m) => v.positions[m.id]))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  if (relevant.length === 0) return null;
  return (
    <div className="mt-5">
      <SectionLabel>How your delegation voted recently</SectionLabel>
      <div className="mt-1 space-y-1.5">
        {relevant.map((v) => {
          const bill = v.bill_id ? billById.get(v.bill_id) : null;
          const body = (
            <>
              <div className="line-clamp-2 text-[12px] leading-snug text-[#dbe5f1]">
                {bill ? `${bill.number}: ${bill.title}` : v.question}
              </div>
              <div className="mt-1 text-[9px] text-[#64748b]">
                {v.chamber} · {fmtDate(v.date)} · {v.result}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {delegation
                  .filter((m) => v.positions[m.id])
                  .map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-1 text-[10px] text-[#8fa1bb]">
                      {m.last} <PositionBadge pos={v.positions[m.id]} size="xs" />
                    </span>
                  ))}
              </div>
            </>
          );
          return bill ? (
            <Link
              key={v.key}
              href={`/bill/${v.bill_id}`}
              className="block rounded-xl border border-[rgba(148,163,184,0.1)] bg-[rgba(148,163,184,0.03)] px-3 py-2.5 transition-colors hover:bg-[rgba(148,163,184,0.07)]"
            >
              {body}
            </Link>
          ) : (
            <div key={v.key} className="rounded-xl border border-[rgba(148,163,184,0.1)] bg-[rgba(148,163,184,0.03)] px-3 py-2.5">
              {body}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 px-1 text-[9px] text-[#475569]">
        Positions from official House Clerk / Senate roll-call records.
      </div>
    </div>
  );
}

function Panel({
  children,
  expanded,
  onToggle,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`glass pointer-events-auto absolute inset-x-2 bottom-2 z-10 flex flex-col overflow-hidden rounded-2xl transition-[max-height] duration-300 ${
        expanded ? "max-h-[62vh]" : "max-h-[150px]"
      } md:inset-x-auto md:top-[118px] md:right-4 md:bottom-4 md:w-[420px] md:max-h-none`}
    >
      <button
        onClick={onToggle}
        className="flex w-full shrink-0 flex-col items-center gap-1 border-b border-[rgba(148,163,184,0.1)] py-1.5 text-[9px] text-[#8fa1bb] md:hidden"
        aria-label={expanded ? "Collapse panel" : "Expand panel"}
      >
        <span className="h-1 w-9 rounded-full bg-[rgba(148,163,184,0.4)]" />
        {expanded ? "tap to collapse ▾" : "tap to expand ▴"}
      </button>
      <div className="scroll-slim flex-1 overflow-y-auto p-4">{children}</div>
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
    <div className="mt-5 space-y-2">
      <Link
        href="/learn"
        className="block rounded-xl border border-[rgba(129,140,248,0.25)] bg-[rgba(129,140,248,0.07)] px-3 py-2.5 text-[11px] text-[#a5b4fc] transition-colors hover:bg-[rgba(129,140,248,0.12)]"
      >
        🎓 New to this? <span className="font-semibold">How a bill becomes law</span> — a 2-minute plain-English
        guide →
      </Link>
      <div className="flex items-center gap-2 rounded-xl border border-[rgba(148,163,184,0.1)] px-3 py-2 text-[10px] text-[#64748b]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399]" />
        Data fetched {fmtDate(fetchedAt.slice(0, 10))} from official sources via Congress.gov roster & GovTrack ·
        boundaries: U.S. Census
      </div>
    </div>
  );
}
