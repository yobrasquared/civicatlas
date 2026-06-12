import Link from "next/link";
import { notFound } from "next/navigation";
import { getStateData } from "../../../lib/data";
import { TOPIC_LABELS, fmtDate } from "../../../lib/status";
import { SourceChip } from "../../../components/cards";
import LegislatorGrid from "../../../components/LegislatorGrid";

export async function generateMetadata({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;
  const data = await getStateData(abbr.toUpperCase());
  if (!data) return { title: "State not found" };
  const description = `${data.legislators.length} current ${data.name} state legislators and the ${data.bills.length} most recently active state bills, from official legislative records.`;
  return {
    title: `${data.name} State Legislature — bills & legislators`,
    description,
    openGraph: { title: `${data.name} State Legislature`, description },
  };
}

export default async function StatePage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;
  const data = await getStateData(abbr.toUpperCase());
  if (!data) notFound();

  const upper = data.legislators.filter((l) => l.chamber === "upper");
  const lower = data.legislators.filter((l) => l.chamber === "lower");
  const passed = data.bills.filter((b) => b.passed_date);

  return (
    <main className="min-h-screen bg-[#060a13] px-4 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
          ← Back to the map
        </Link>

        <header className="rise mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5eead4]">
            State legislature · Phase 2 pilot
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#f1f6fc]">
            {data.name} <span className="brand-gradient">Legislature</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#8fa1bb]">
            The most recently active state legislation and every current state legislator, from official legislative
            records aggregated by Open States.
          </p>
        </header>

        <section className="rise mt-5 grid grid-cols-3 gap-2">
          <Stat n={upper.length} label="state senators" sub="upper chamber" />
          <Stat n={lower.length} label="representatives" sub="lower chamber" />
          <Stat n={data.bills.length} label="bills tracked" sub={`${passed.length} passed a vote`} />
        </section>

        <section className="rise mt-6">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Recently active legislation
          </h2>
          <div className="mt-2 space-y-2">
            {data.bills.map((b) => (
              <a
                key={b.id}
                href={b.openstates_url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-soft block rounded-2xl p-4 transition-colors hover:border-[rgba(94,234,212,0.3)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-[#7dd3fc]">{b.identifier}</span>
                  <span className="text-[10px] text-[#64748b]">session {b.session}</span>
                  {b.passed_date && (
                    <span className="rounded-full bg-[rgba(52,211,153,0.1)] px-2 py-0.5 text-[9px] font-semibold uppercase text-[#34d399]">
                      passed a chamber {fmtDate(b.passed_date)}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-[#64748b]">↗ full record</span>
                </div>
                <div className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[#dbe5f1]">{b.title}</div>
                <div className="mt-2 text-[11px] leading-relaxed text-[#8fa1bb]">
                  <span className="text-[#64748b]">{fmtDate(b.latest_action_date)}:</span> {b.latest_action}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {b.topics
                    .filter((t) => t !== "other")
                    .map((t) => (
                      <span key={t} className="rounded-full bg-[rgba(129,140,248,0.12)] px-2 py-0.5 text-[9px] text-[#a5b4fc]">
                        {TOPIC_LABELS[t] ?? t}
                      </span>
                    ))}
                  {b.sponsors.length > 0 && (
                    <span className="text-[10px] text-[#64748b]">Sponsor: {b.sponsors.join(", ")}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="rise mt-8">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Current legislators
          </h2>
          <LegislatorGrid upper={upper} lower={lower} />
        </section>

        <section className="glass-soft rise mt-6 rounded-2xl p-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            Sources & verification
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <SourceChip kind="aggregator" label="Open States — state legislative data" href={data.source_url} />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-[#475569]">
            Data fetched {fmtDate(data.fetched_at.slice(0, 10))}. Every bill links to its full official record.
            State coverage is a Phase 2 pilot — vote-level detail and bill timelines come next.
          </p>
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
