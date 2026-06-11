import Link from "next/link";
import { notFound } from "next/navigation";
import { getBills, getMembers, getVotes } from "../../../lib/data";
import { TOPIC_LABELS, fmtDate } from "../../../lib/status";
import { STATE_NAMES } from "../../../lib/states";
import { Avatar, BillRow, SourceChip } from "../../../components/cards";
import { KindChip, PositionBadge } from "../../../components/votes";

export default async function OfficialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ bills, fetched_at }, { members }, { votes }] = await Promise.all([getBills(), getMembers(), getVotes()]);
  const member = members.find((m) => m.id === id);
  if (!member) notFound();

  const memberVotes = votes
    .filter((v) => v.positions[id])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  const billTitleById = new Map(bills.map((b) => [b.id, { number: b.number, title: b.title }]));

  const sponsored = bills
    .filter((b) => b.sponsor?.id === id)
    .sort((a, b) => b.status_date.localeCompare(a.status_date));
  const enacted = sponsored.filter((b) => b.status === "law");
  const passedChamber = sponsored.filter((b) => ["passed_one", "passed_both", "law"].includes(b.status));

  const topicCounts: Record<string, number> = {};
  for (const b of sponsored) for (const t of b.topics) if (t !== "other") topicCounts[t] = (topicCounts[t] ?? 0) + 1;
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTopic = topTopics[0]?.[1] ?? 1;

  const seat =
    member.chamber === "House"
      ? `${STATE_NAMES[member.state] ?? member.state}${(member.district ?? 0) > 0 ? ` — District ${member.district}` : " — At-Large"}`
      : STATE_NAMES[member.state] ?? member.state;

  return (
    <main className="min-h-screen bg-[#060a13] px-4 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
          ← Back to the map
        </Link>

        <header className="glass-soft rise mt-4 flex flex-wrap items-center gap-5 rounded-2xl p-5">
          <Avatar member={member} size={84} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[#f1f6fc]">{member.name}</h1>
            <div className="mt-1 text-[13px] text-[#8fa1bb]">
              {member.title} · {seat} · {member.party}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">
              Serving since {fmtDate(member.serving_since)} · current term ends {fmtDate(member.termEnd)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {member.website && (
                <a
                  href={member.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[rgba(45,212,191,0.12)] px-3 py-1.5 text-[11px] font-medium text-[#5eead4] ring-1 ring-[rgba(45,212,191,0.3)] transition-opacity hover:opacity-80"
                >
                  Official website ↗
                </a>
              )}
              {member.phone && (
                <span className="rounded-lg bg-[rgba(148,163,184,0.08)] px-3 py-1.5 text-[11px] text-[#cbd5e1] ring-1 ring-[rgba(148,163,184,0.2)]">
                  ☎ {member.phone}
                </span>
              )}
            </div>
          </div>
        </header>

        <section className="rise mt-4 grid grid-cols-3 gap-2">
          <Stat n={sponsored.length} label="bills sponsored" sub="recent window" />
          <Stat n={passedChamber.length} label="passed a chamber" sub="of those bills" />
          <Stat n={enacted.length} label="became law" sub="signed & enacted" />
        </section>

        <p className="mt-2 px-1 text-[10px] leading-relaxed text-[#475569]">
          Counts reflect CivicAtlas’s current data window ({bills.length.toLocaleString()} recently active bills of
          the 119th Congress), not career totals. Every count is verifiable through the source links below.
        </p>

        {topTopics.length > 0 && (
          <section className="glass-soft rise mt-4 rounded-2xl p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Top policy areas — from sponsored bills
            </h2>
            <div className="mt-3 space-y-2">
              {topTopics.map(([t, n]) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-[11px] text-[#cbd5e1]">{TOPIC_LABELS[t] ?? t}</span>
                  <div className="h-2 flex-1 rounded-full bg-[rgba(148,163,184,0.1)]">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(n / maxTopic) * 100}%`,
                        background: "linear-gradient(90deg,#2dd4bf,#818cf8)",
                      }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[11px] text-[#8fa1bb]">{n}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[9px] text-[#475569]">
              Methodology: keyword classification of official bill titles. Transparent, automatic, and nonpartisan —
              not an assessment of effectiveness.
            </p>
          </section>
        )}

        {enacted.length > 0 && (
          <section className="rise mt-5">
            <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#34d399]">
              Sponsored bills that became law
            </h2>
            <div className="mt-1 space-y-0.5">
              {enacted.map((b) => (
                <BillRow key={b.id} bill={b} />
              ))}
            </div>
          </section>
        )}

        <section className="rise mt-5">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Recently active sponsored bills
          </h2>
          <div className="mt-1 space-y-0.5">
            {sponsored.slice(0, 20).map((b) => (
              <BillRow key={b.id} bill={b} />
            ))}
            {sponsored.length === 0 && (
              <p className="px-1 py-3 text-xs text-[#64748b]">
                No bills from this member appear in the current data window. That window covers only recently active
                legislation — it is not a statement about this member’s overall record.
              </p>
            )}
          </div>
        </section>

        {memberVotes.length > 0 && (
          <section className="rise mt-5">
            <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Recent recorded votes
            </h2>
            <p className="mt-1 px-1 text-[10px] text-[#475569]">
              From official House Clerk / Senate roll-call records. Procedural votes concern how the chamber
              proceeds, not support for a bill itself.
            </p>
            <div className="mt-2 space-y-1">
              {memberVotes.map((v) => {
                const bill = v.bill_id ? billTitleById.get(v.bill_id) : null;
                const inner = (
                  <div className="flex items-start gap-3 rounded-xl border border-[rgba(148,163,184,0.1)] bg-[rgba(148,163,184,0.03)] px-3 py-2.5 transition-colors hover:bg-[rgba(148,163,184,0.06)]">
                    <div className="w-16 shrink-0 pt-0.5">
                      <PositionBadge pos={v.positions[id]} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[12px] leading-snug text-[#dbe5f1]">
                        {bill ? `${bill.number}: ${bill.title}` : v.question}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#64748b]">
                        <KindChip kind={v.kind} />
                        <span>{fmtDate(v.date)}</span>
                        <span>· {v.result}</span>
                      </div>
                    </div>
                  </div>
                );
                return v.bill_id ? (
                  <Link key={v.key} href={`/bill/${v.bill_id}`} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={v.key}>{inner}</div>
                );
              })}
            </div>
          </section>
        )}

        <section className="glass-soft rise mt-5 rounded-2xl p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Sources & verification
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <SourceChip
              kind="official"
              label="Congressional Bioguide (official)"
              href={`https://bioguide.congress.gov/search/bio/${member.id}`}
            />
            <SourceChip
              kind="official"
              label="Official roster (unitedstates project)"
              href="https://github.com/unitedstates/congress-legislators"
            />
            <SourceChip kind="aggregator" label="GovTrack profile" href={`https://www.govtrack.us/congress/members/${member.id}`} />
          </div>
          <div className="mt-3 text-[10px] text-[#475569]">Data fetched {fmtDate(fetched_at.slice(0, 10))}</div>
        </section>
      </div>
    </main>
  );
}

function Stat({ n, label, sub }: { n: number; label: string; sub: string }) {
  return (
    <div className="glass-soft rounded-2xl px-4 py-3 text-center">
      <div className="text-2xl font-semibold text-[#f1f6fc]">{n}</div>
      <div className="text-[11px] text-[#cbd5e1]">{label}</div>
      <div className="text-[9px] text-[#64748b]">{sub}</div>
    </div>
  );
}
