import type { Metadata } from "next";
import Link from "next/link";
import { getBills, getMembers, getSummaries, getVotes } from "../../lib/data";
import { fmtDate } from "../../lib/status";
import { ISSUES_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Methodology & sources",
  description:
    "How CivicAtlas computes everything it shows: data sources, freshness, topic classification, activity metrics, roll-call positions, and the rules its AI summaries must follow.",
};

export default async function MethodologyPage() {
  const [{ bills, fetched_at: billsAt }, { members }, votesFile, { summaries, model }] = await Promise.all([
    getBills(),
    getMembers(),
    getVotes(),
    getSummaries(),
  ]);

  return (
    <main className="min-h-screen bg-[#060a13] px-4 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
          ← Back to the map
        </Link>

        <header className="rise mt-4">
          <h1 className="text-3xl font-semibold tracking-tight text-[#f1f6fc]">
            Methodology & <span className="brand-gradient">sources</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#8fa1bb]">
            Every number on CivicAtlas should be reproducible from public records. This page explains exactly where
            the data comes from and how every metric is computed. If something looks wrong,{" "}
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-[#5eead4] hover:underline">
              report it
            </a>{" "}
            — corrections are public.
          </p>
        </header>

        <Section title="Data sources">
          <table className="w-full text-left text-[12px]">
            <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
              {[
                ["Members of Congress", "unitedstates/congress-legislators — the community-maintained official roster", `${members.length} current members`],
                ["Federal bills & laws", "GovTrack API, which aggregates official Congress.gov data", `${bills.length} recently active bills of the 119th Congress`],
                ["Roll-call votes", "Official House Clerk XML (clerk.house.gov) and Senate LIS XML (senate.gov) — member positions come from the primary record, never a third party", `${votesFile.votes.length} recent roll calls`],
                ["District boundaries", "U.S. Census cartographic boundary files (CD118), simplified for the web", "435+ districts"],
                ["Address / ZIP lookup", "U.S. Census geocoder + ZIP centroids, matched against boundaries on our server. What you type is never stored", "—"],
                ["State legislatures", "Open States API (CA, TX, NY, FL, PA pilot)", "941 state legislators"],
              ].map(([what, source, scope]) => (
                <tr key={what as string}>
                  <td className="py-2 pr-3 font-medium text-[#dbe5f1]">{what}</td>
                  <td className="py-2 pr-3 text-[#8fa1bb]">{source}</td>
                  <td className="py-2 text-[#64748b]">{scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-[#64748b]">
            Federal data last fetched {fmtDate(billsAt.slice(0, 10))}. Every page shows the freshness of the data it
            displays.
          </p>
        </Section>

        <Section title="The data window">
          <P>
            CivicAtlas currently tracks the <strong>~1,000 most recently active bills</strong> of the current
            Congress, not all ~10,000 introduced bills. All counts (bills sponsored, became law, activity colors on
            the map) are computed within this window and labeled as such. They are <em>recent-activity</em> measures,
            not career totals.
          </P>
        </Section>

        <Section title="Map activity colors">
          <P>
            Districts are shaded by the number of bills in the data window whose <strong>primary sponsor</strong>{" "}
            holds that seat. It is a neutral volume measure — sponsoring many bills is not inherently good or bad,
            and the scale never encodes party.
          </P>
        </Section>

        <Section title="Topic classification">
          <P>
            Topics (Housing, Healthcare, …) are assigned by transparent keyword matching against official bill
            titles — the patterns are{" "}
            <a
              href={`${ISSUES_URL.replace("/issues/new", "")}/blob/main/scripts/topics.mjs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7dd3fc] hover:text-[#5eead4]"
            >
              public code
            </a>
            . This is automatic and imperfect by design: it cannot editorialize, but it can miss nuance. A bill can
            carry up to three topics.
          </P>
        </Section>

        <Section title="Vote records & agreement">
          <P>
            Member positions come directly from the official House Clerk and Senate roll-call XML. Votes are labeled{" "}
            <strong>passage</strong> vs <strong>procedural</strong> (cloture, motions) because a procedural vote is
            about how the chamber proceeds — not support for the underlying bill. The compare tool's agreement
            percentage counts only recorded Yea/Nay positions on votes both members took, of any kind, and lists
            every disagreement so you can judge the substance yourself.
          </P>
        </Section>

        <Section title="AI-assisted summaries">
          <P>
            {Object.keys(summaries).length} prominent bills carry a plain-English summary generated by an AI model (
            {model}). Hard rules: the model sees <strong>only</strong> the official-record metadata shown on the
            page (title, status, actions, votes) — it has no web access and does not see full bill text yet; it must
            answer “not specified in the available record” rather than guess; outputs are schema-validated and
            confidence-scored, and vague titles are forced to low confidence. Summaries are always labeled, dated,
            and accompanied by the official sources, which are authoritative. A summary generated before a bill's
            latest action shows a staleness warning.
          </P>
        </Section>

        <Section title="What CivicAtlas deliberately does not do">
          <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-[#b9c7da]">
            <li>No composite “score” or ranking of officials — only individually explainable metrics.</li>
            <li>No red-vs-blue visual framing; party is shown as a small neutral label.</li>
            <li>No inferred motives, no characterization of bills as good or bad.</li>
            <li>No accomplishment claims without a record link.</li>
            <li>No server-side storage of your address, ZIP, or follows.</li>
          </ul>
        </Section>

        <Section title="Corrections">
          <P>
            Found an error — a wrong vote, a misclassified topic, a summary that overreaches?{" "}
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-[#5eead4] hover:underline">
              Open an issue
            </a>
            . Data bugs are treated as the most serious kind.
          </P>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-soft rise mt-4 rounded-2xl p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-[#b9c7da]">{children}</p>;
}
