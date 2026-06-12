import Link from "next/link";
import { notFound } from "next/navigation";
import { getBills, getMembers, getVotes } from "../../../lib/data";
import { fmtDate } from "../../../lib/status";
import { STATE_NAMES, ordinal } from "../../../lib/states";
import { Avatar, SourceChip, StatusBadge, Stepper, TopicTags } from "../../../components/cards";
import { VoteCard } from "../../../components/votes";
import FollowButton from "../../../components/FollowButton";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ bills, fetched_at }, { members }, { votes }] = await Promise.all([getBills(), getMembers(), getVotes()]);
  const bill = bills.find((b) => b.id === id);
  if (!bill) notFound();

  const billVotes = votes.filter((v) => v.bill_id === id);
  const roster = members.map((m) => ({ id: m.id, name: m.name, party: m.party, state: m.state }));

  const sponsorMember = bill.sponsor ? members.find((m) => m.id === bill.sponsor!.id) : null;
  const related = bills
    .filter((b) => b.id !== bill.id && b.topics.some((t) => t !== "other" && bill.topics.includes(t)))
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-[#060a13] px-4 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
          ← Back to the map
        </Link>

        <header className="rise mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold tracking-wide text-[#7dd3fc]">{bill.number}</span>
            <StatusBadge bill={bill} size="md" />
            <span className="text-[11px] text-[#64748b]">{ordinal(bill.congress)} Congress</span>
            <span className="ml-auto">
              <FollowButton kind="bills" id={bill.id} label={bill.number} />
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-[#f1f6fc]">{bill.title}</h1>
          <div className="mt-3">
            <TopicTags topics={bill.topics} />
          </div>
        </header>

        {bill.law_num && (
          <div className="rise mt-5 rounded-2xl border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.08)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#34d399]">Enacted into law</div>
            <div className="mt-1 text-sm text-[#d1fae5]">
              This bill became{" "}
              <strong>
                Public Law{" "}
                {String(bill.law_num).includes("-") ? bill.law_num : `${bill.congress}-${bill.law_num}`}
              </strong>{" "}
              on {fmtDate(bill.status_date)}.
            </div>
          </div>
        )}

        <section className="glass-soft rise mt-5 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Where it stands</h2>
            <Link href="/learn" className="text-[10px] text-[#a5b4fc] transition-colors hover:text-[#5eead4]">
              How does this process work? →
            </Link>
          </div>
          <div className="mt-4">
            <Stepper bill={bill} />
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-[#b9c7da]">
            <strong className="text-[#e6edf7]">{bill.status_raw}</strong> as of {fmtDate(bill.status_date)}.{" "}
            {bill.status_desc}
          </p>
          {!bill.is_alive && bill.status !== "law" && bill.status !== "agreed" && (
            <p className="mt-2 text-[11px] text-[#94a3b8]">
              This bill is no longer moving. Most bills never receive a vote — that’s normal in the legislative
              process, not necessarily a scandal.
            </p>
          )}
        </section>

        {bill.sponsor && (
          <section className="glass-soft rise mt-4 rounded-2xl p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Sponsor</h2>
            <Link
              href={`/official/${bill.sponsor.id}`}
              className="mt-3 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[rgba(148,163,184,0.06)]"
            >
              {sponsorMember && <Avatar member={sponsorMember} size={52} />}
              <div>
                <div className="text-sm font-semibold">{bill.sponsor.name}</div>
                <div className="text-[11px] text-[#8fa1bb]">
                  {bill.sponsor.chamber === "Senate" ? "Senator" : "Representative"} ·{" "}
                  {STATE_NAMES[bill.sponsor.state ?? ""] ?? bill.sponsor.state}
                  {bill.sponsor.district ? ` District ${bill.sponsor.district}` : ""}
                  {bill.sponsor.party ? ` · ${bill.sponsor.party}` : ""}
                </div>
                <div className="text-[11px] text-[#5eead4]">View full record →</div>
              </div>
            </Link>
          </section>
        )}

        {billVotes.length > 0 && (
          <section className="glass-soft rise mt-4 rounded-2xl p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Recorded votes on this bill
            </h2>
            <p className="mt-2 text-[11px] leading-relaxed text-[#8fa1bb]">
              Member positions come directly from the official House Clerk and Senate roll-call records. Procedural
              votes (like cloture) are about <em>how</em> the chamber proceeds — they are not the same as voting for
              or against the bill itself.
            </p>
            <div className="mt-3 space-y-3">
              {billVotes.map((v) => (
                <VoteCard key={v.key} vote={v} roster={roster} />
              ))}
            </div>
          </section>
        )}

        {bill.actions.length > 0 && (
          <section className="glass-soft rise mt-4 rounded-2xl p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Timeline of major actions
            </h2>
            <ol className="mt-4 space-y-0">
              {bill.actions.map((a, i) => (
                <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < bill.actions.length - 1 && (
                    <span className="absolute left-[5px] top-4 h-full w-px bg-[rgba(148,163,184,0.2)]" />
                  )}
                  <span
                    className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full"
                    style={{
                      background: i === bill.actions.length - 1 ? "linear-gradient(135deg,#2dd4bf,#818cf8)" : "rgba(148,163,184,0.35)",
                    }}
                  />
                  <div>
                    <div className="font-mono text-[10px] text-[#64748b]">{fmtDate(a.date)}</div>
                    <div className="mt-0.5 text-[13px] leading-relaxed text-[#cbd5e1]">{a.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="glass-soft rise mt-4 rounded-2xl p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Sources & verification
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed text-[#8fa1bb]">
            Everything on this page comes from the official legislative record. Read it yourself:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SourceChip kind="official" label="Full text & record — Congress.gov" href={bill.congress_link} />
            <SourceChip kind="aggregator" label="GovTrack tracking page" href={bill.link} />
          </div>
          <div className="mt-3 text-[10px] text-[#475569]">
            Data fetched {fmtDate(fetched_at.slice(0, 10))} · status: {bill.status_raw} · introduced{" "}
            {fmtDate(bill.introduced)}
          </div>
        </section>

        {related.length > 0 && (
          <section className="rise mt-6">
            <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Related legislation
            </h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {related.map((b) => (
                <Link
                  key={b.id}
                  href={`/bill/${b.id}`}
                  className="glass-soft block rounded-xl p-3 transition-colors hover:border-[rgba(94,234,212,0.3)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold text-[#7dd3fc]">{b.number}</span>
                    <StatusBadge bill={b} />
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-xs leading-snug text-[#cbd5e1]">{b.title}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
