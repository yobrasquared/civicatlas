"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Bill, BillsFile, Member, MembersFile, RollCallVote, VotesFile } from "../../lib/types";
import { useFollows } from "../../lib/follows";
import { STATE_NAMES } from "../../lib/states";
import { fmtDate } from "../../lib/status";
import { Avatar, BillRow, PartyChip, StatusBadge } from "../../components/cards";
import { KindChip, PositionBadge } from "../../components/votes";
import FollowButton from "../../components/FollowButton";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export default function DigestPage() {
  const follows = useFollows();
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [votes, setVotes] = useState<RollCallVote[]>([]);
  const [loaded, setLoaded] = useState(false);

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
      setLoaded(true);
    });
  }, []);

  const followedMembers = useMemo(
    () => members.filter((m) => follows.members.includes(m.id)),
    [members, follows.members]
  );
  const followedBills = useMemo(() => bills.filter((b) => follows.bills.includes(b.id)), [bills, follows.bills]);
  const isFresh = (d: string) => Date.now() - new Date(d + "T12:00:00").getTime() < WEEK_MS;
  const hasFollows = follows.members.length + follows.bills.length > 0;

  return (
    <main className="min-h-screen bg-[#060a13] px-4 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
          ← Back to the map
        </Link>

        <header className="rise mt-4">
          <h1 className="text-3xl font-semibold tracking-tight text-[#f1f6fc]">
            Your civic <span className="brand-gradient">digest</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#8fa1bb]">
            What the bills and representatives you follow have been doing.{" "}
            <span className="text-[#64748b]">
              Follows are saved only on this device — CivicAtlas never stores your civic interests on a server.
            </span>
          </p>
        </header>

        {loaded && !hasFollows && (
          <div className="glass-soft rise mt-8 rounded-2xl p-8 text-center">
            <div className="text-3xl">☆</div>
            <h2 className="mt-2 text-lg font-semibold text-[#f1f6fc]">Nothing followed yet</h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[#8fa1bb]">
              Tap <span className="text-[#5eead4]">☆ Follow</span> on any bill page or official profile and it will
              show up here, with their latest actions and votes.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-gradient-to-r from-[#2dd4bf] to-[#818cf8] px-6 py-3 text-sm font-semibold text-[#06251f] transition-opacity hover:opacity-90"
            >
              Explore the map →
            </Link>
          </div>
        )}

        {followedMembers.length > 0 && (
          <section className="rise mt-8">
            <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Your representatives ({followedMembers.length})
            </h2>
            <div className="mt-2 space-y-3">
              {followedMembers.map((m) => {
                const theirBills = bills
                  .filter((b) => b.sponsor?.id === m.id)
                  .sort((a, b) => b.status_date.localeCompare(a.status_date));
                const theirVotes = votes
                  .filter((v) => v.positions[m.id])
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 3);
                return (
                  <div key={m.id} className="glass-soft rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <Link href={`/official/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar member={m} size={44} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[14px] font-semibold">{m.name}</span>
                            <PartyChip party={m.party} />
                          </div>
                          <div className="truncate text-[11px] text-[#8fa1bb]">
                            {m.title} · {STATE_NAMES[m.state] ?? m.state}
                            {m.chamber === "House" && (m.district ?? 0) > 0 ? ` District ${m.district}` : ""}
                          </div>
                        </div>
                      </Link>
                      <FollowButton kind="members" id={m.id} label={m.name} size="sm" />
                    </div>

                    {theirVotes.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {theirVotes.map((v) => (
                          <div key={v.key} className="flex items-start gap-2 rounded-lg bg-[rgba(148,163,184,0.04)] px-2.5 py-2">
                            <PositionBadge pos={v.positions[m.id]} size="xs" />
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-1 text-[11px] text-[#cbd5e1]">{v.question}</div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#64748b]">
                                <KindChip kind={v.kind} /> {fmtDate(v.date)}
                                {isFresh(v.date) && <FreshDot />}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {theirBills.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {theirBills.slice(0, 3).map((b) => (
                          <BillRow key={b.id} bill={b} compact />
                        ))}
                      </div>
                    )}
                    {theirBills.length === 0 && theirVotes.length === 0 && (
                      <p className="mt-2 px-1 text-[11px] text-[#64748b]">No activity in the current data window.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {followedBills.length > 0 && (
          <section className="rise mt-8">
            <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Bills you follow ({followedBills.length})
            </h2>
            <div className="mt-2 space-y-2">
              {followedBills.map((b) => {
                const billVotes = votes.filter((v) => v.bill_id === b.id);
                return (
                  <div key={b.id} className="glass-soft rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/bill/${b.id}`} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#7dd3fc]">{b.number}</span>
                          <StatusBadge bill={b} />
                          {isFresh(b.status_date) && <FreshDot label="updated this week" />}
                        </div>
                        <div className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[#dbe5f1]">{b.title}</div>
                        <div className="mt-1.5 text-[11px] text-[#8fa1bb]">
                          {b.status_raw} · {fmtDate(b.status_date)}
                          {billVotes.length > 0 ? ` · ${billVotes.length} recorded vote${billVotes.length === 1 ? "" : "s"}` : ""}
                        </div>
                      </Link>
                      <FollowButton kind="bills" id={b.id} label={b.number} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasFollows && (
          <p className="mt-8 text-center text-[10px] text-[#475569]">
            Activity reflects CivicAtlas’s current data window. Run a data refresh to bring in the latest actions.
          </p>
        )}
      </div>
    </main>
  );
}

function FreshDot({ label = "new this week" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(94,234,212,0.1)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#5eead4]">
      <span className="h-1 w-1 rounded-full bg-[#5eead4] pulse-dot" /> {label}
    </span>
  );
}
