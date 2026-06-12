"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Bill, BillsFile, Member, MembersFile, RollCallVote, VotesFile } from "../../lib/types";
import { STATE_NAMES } from "../../lib/states";
import { TOPIC_LABELS, fmtDate } from "../../lib/status";
import { Avatar, BillRow, PartyChip } from "../../components/cards";
import { KindChip, PositionBadge } from "../../components/votes";

export default function ComparePage() {
  return (
    <Suspense>
      <Compare />
    </Suspense>
  );
}

function Compare() {
  const router = useRouter();
  const params = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [votes, setVotes] = useState<RollCallVote[]>([]);

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
    });
  }, []);

  const a = members.find((m) => m.id === params.get("a")) ?? null;
  const b = members.find((m) => m.id === params.get("b")) ?? null;

  const setSide = (side: "a" | "b", id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set(side, id);
    else next.delete(side);
    router.replace(`/compare?${next.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#060a13] px-4 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-xs text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
          ← Back to the map
        </Link>
        <header className="rise mt-4">
          <h1 className="text-3xl font-semibold tracking-tight text-[#f1f6fc]">
            Compare two <span className="brand-gradient">officials</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#8fa1bb]">
            Side-by-side legislative records and how often they vote together — computed from the official record,
            with no editorial judgment.
          </p>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MemberPicker label="First official" members={members} selected={a} onPick={(id) => setSide("a", id)} />
          <MemberPicker label="Second official" members={members} selected={b} onPick={(id) => setSide("b", id)} />
        </div>

        {a && b && a.id !== b.id && <Comparison a={a} b={b} bills={bills} votes={votes} />}
        {(!a || !b) && members.length > 0 && (
          <p className="mt-10 text-center text-sm text-[#64748b]">
            Pick two members of Congress above to compare their records.
          </p>
        )}
      </div>
    </main>
  );
}

function MemberPicker({
  label,
  members,
  selected,
  onPick,
}: {
  label: string;
  members: Member[];
  selected: Member | null;
  onPick: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(n) ||
          m.state.toLowerCase() === n ||
          (STATE_NAMES[m.state] ?? "").toLowerCase().includes(n)
      )
      .slice(0, 6);
  }, [q, members]);

  if (selected) {
    return (
      <div className="glass-soft flex items-center gap-3 rounded-2xl p-3">
        <Avatar member={selected} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold">{selected.name}</span>
            <PartyChip party={selected.party} />
          </div>
          <div className="truncate text-[11px] text-[#8fa1bb]">
            {selected.title} · {STATE_NAMES[selected.state] ?? selected.state}
            {selected.chamber === "House" && (selected.district ?? 0) > 0 ? ` District ${selected.district}` : ""}
          </div>
        </div>
        <button
          onClick={() => onPick(null)}
          className="rounded-lg px-2 py-1 text-[11px] text-[#8fa1bb] transition-colors hover:text-[#fb7185]"
        >
          ✕ change
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="glass-soft flex items-center gap-2 rounded-2xl px-3 py-3">
        <span className="text-sm">👤</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={`${label} — search by name or state`}
          className="w-full bg-transparent text-[13px] text-[#e6edf7] placeholder-[#64748b] outline-none"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="glass scroll-slim absolute top-full z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl p-2">
          {hits.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onPick(m.id);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[rgba(148,163,184,0.07)]"
            >
              <Avatar member={m} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-[13px]">{m.name}</span>
                <span className="block truncate text-[10px] text-[#8fa1bb]">
                  {m.title} · {STATE_NAMES[m.state] ?? m.state}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Comparison({ a, b, bills, votes }: { a: Member; b: Member; bills: Bill[]; votes: RollCallVote[] }) {
  const stats = (m: Member) => {
    const sponsored = bills.filter((x) => x.sponsor?.id === m.id);
    return {
      sponsored,
      passed: sponsored.filter((x) => ["passed_one", "passed_both", "law"].includes(x.status)),
      laws: sponsored.filter((x) => x.status === "law"),
      topics: sponsored
        .flatMap((x) => x.topics)
        .filter((t) => t !== "other")
        .reduce<Record<string, number>>((acc, t) => ((acc[t] = (acc[t] ?? 0) + 1), acc), {}),
    };
  };
  const sa = stats(a);
  const sb = stats(b);

  const shared = votes
    .filter((v) => v.positions[a.id] && v.positions[b.id])
    .filter((v) => "YN".includes(v.positions[a.id]) && "YN".includes(v.positions[b.id]))
    .sort((x, y) => y.date.localeCompare(x.date));
  const agreed = shared.filter((v) => v.positions[a.id] === v.positions[b.id]);
  const disagreed = shared.filter((v) => v.positions[a.id] !== v.positions[b.id]);
  const pct = shared.length > 0 ? Math.round((agreed.length / shared.length) * 100) : null;

  const allTopics = [...new Set([...Object.keys(sa.topics), ...Object.keys(sb.topics)])]
    .sort((x, y) => (sb.topics[y] ?? 0) + (sa.topics[y] ?? 0) - ((sb.topics[x] ?? 0) + (sa.topics[x] ?? 0)))
    .slice(0, 6);
  const maxTopic = Math.max(1, ...allTopics.flatMap((t) => [sa.topics[t] ?? 0, sb.topics[t] ?? 0]));

  return (
    <div className="rise mt-6 space-y-4">
      {/* stats */}
      <section className="glass-soft rounded-2xl p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
          Recent legislative activity
        </h2>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2 text-center">
          <HeaderCell m={a} />
          <span />
          <HeaderCell m={b} />
          {(
            [
              ["bills sponsored", sa.sponsored.length, sb.sponsored.length],
              ["passed a chamber", sa.passed.length, sb.passed.length],
              ["became law", sa.laws.length, sb.laws.length],
            ] as const
          ).map(([label, va, vb]) => (
            <CompareRow key={label} label={label} a={va} b={vb} />
          ))}
        </div>
        <p className="mt-3 text-[9px] text-[#475569]">
          Counts reflect CivicAtlas’s current data window ({bills.length.toLocaleString()} recently active bills),
          not career totals.
        </p>
      </section>

      {/* vote agreement */}
      <section className="glass-soft rounded-2xl p-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Vote agreement</h2>
        {pct === null ? (
          <p className="mt-3 text-[13px] text-[#8fa1bb]">
            {a.chamber !== b.chamber
              ? `${a.last} and ${b.last} serve in different chambers, so they don’t share roll-call votes.`
              : "No shared recorded votes in the current data window."}
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-4">
              <div className="text-4xl font-semibold text-[#f1f6fc]">{pct}%</div>
              <div className="text-[12px] leading-snug text-[#8fa1bb]">
                voted the same way on <strong className="text-[#e6edf7]">{shared.length}</strong> shared recorded
                votes
                <br />
                <span className="text-[10px] text-[#64748b]">
                  counting only Yea/Nay positions · House Clerk & Senate official records
                </span>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(148,163,184,0.1)]">
              <div className="h-2 rounded-full bg-gradient-to-r from-[#2dd4bf] to-[#818cf8]" style={{ width: `${pct}%` }} />
            </div>

            {disagreed.length > 0 && (
              <div className="mt-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#fb923c]">
                  Where they split ({disagreed.length})
                </h3>
                <div className="mt-2 space-y-1.5">
                  {disagreed.slice(0, 6).map((v) => (
                    <VoteDiffRow key={v.key} v={v} a={a} b={b} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* topics */}
      {allTopics.length > 0 && (
        <section className="glass-soft rounded-2xl p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Policy focus — from sponsored bills
          </h2>
          <div className="mt-3 space-y-2.5">
            {allTopics.map((t) => (
              <div key={t} className="grid grid-cols-[1fr_7rem_1fr] items-center gap-2">
                <div className="flex justify-end">
                  <div
                    className="h-2 rounded-full bg-[#2dd4bf]"
                    style={{ width: `${((sa.topics[t] ?? 0) / maxTopic) * 100}%`, minWidth: sa.topics[t] ? 6 : 0 }}
                  />
                </div>
                <div className="text-center text-[10px] text-[#8fa1bb]">{TOPIC_LABELS[t] ?? t}</div>
                <div className="flex">
                  <div
                    className="h-2 rounded-full bg-[#818cf8]"
                    style={{ width: `${((sb.topics[t] ?? 0) / maxTopic) * 100}%`, minWidth: sb.topics[t] ? 6 : 0 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-[#64748b]">
            <span style={{ color: "#2dd4bf" }}>{a.last}</span>
            <span style={{ color: "#818cf8" }}>{b.last}</span>
          </div>
        </section>
      )}

      {/* recent bills */}
      <section className="grid gap-3 sm:grid-cols-2">
        {[
          { m: a, s: sa },
          { m: b, s: sb },
        ].map(({ m, s }) => (
          <div key={m.id} className="glass-soft rounded-2xl p-4">
            <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
              {m.last}’s recent bills
            </h3>
            <div className="mt-1 space-y-0.5">
              {s.sponsored.slice(0, 5).map((x) => (
                <BillRow key={x.id} bill={x} compact />
              ))}
              {s.sponsored.length === 0 && (
                <p className="px-1 py-2 text-[11px] text-[#64748b]">No bills in the current window.</p>
              )}
            </div>
            <Link href={`/official/${m.id}`} className="mt-2 block px-1 text-[11px] text-[#7dd3fc] hover:text-[#5eead4]">
              Full record →
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}

function HeaderCell({ m }: { m: Member }) {
  return (
    <Link href={`/official/${m.id}`} className="flex items-center justify-center gap-2">
      <Avatar member={m} size={32} />
      <span className="truncate text-[13px] font-semibold">{m.last}</span>
      <PartyChip party={m.party} />
    </Link>
  );
}

function CompareRow({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <>
      <div className="text-xl font-semibold text-[#f1f6fc]">{a}</div>
      <div className="text-[10px] text-[#64748b]">{label}</div>
      <div className="text-xl font-semibold text-[#f1f6fc]">{b}</div>
    </>
  );
}

function VoteDiffRow({ v, a, b }: { v: RollCallVote; a: Member; b: Member }) {
  return (
    <div className="rounded-xl bg-[rgba(148,163,184,0.04)] px-3 py-2">
      <div className="line-clamp-1 text-[12px] text-[#dbe5f1]">{v.question}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#64748b]">
        <KindChip kind={v.kind} />
        <span>{fmtDate(v.date)}</span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          {a.last} <PositionBadge pos={v.positions[a.id]} size="xs" /> · {b.last}{" "}
          <PositionBadge pos={v.positions[b.id]} size="xs" />
        </span>
      </div>
    </div>
  );
}
