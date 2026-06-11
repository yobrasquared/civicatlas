import Link from "next/link";

export const metadata = {
  title: "How Congress works — CivicAtlas",
  description: "Plain-English explainers: how a bill becomes law, what committees do, why most bills die, and how to read the legislative record yourself.",
};

const JOURNEY = [
  {
    step: "1 · Idea",
    title: "Someone has an idea",
    body: "Ideas for laws come from members of Congress, the President, advocacy groups, businesses, or ordinary constituents. Only a member of the House or Senate can formally introduce a bill.",
  },
  {
    step: "2 · Introduced",
    title: "The bill is introduced",
    body: "The member who introduces it is the sponsor. Other members can sign on as cosponsors to show support. The bill gets a number — H.R. for House bills, S. for Senate bills.",
  },
  {
    step: "3 · Committee",
    title: "Committee review",
    body: "The bill is referred to one or more committees that specialize in its subject. Committees hold hearings, propose changes (amendments), and vote on whether to send it forward. This is where most bills stop — committees only advance a small fraction.",
  },
  {
    step: "4 · Floor vote",
    title: "The full chamber votes",
    body: "If a committee reports the bill out, the chamber may debate and vote on it. Before the final vote there are often procedural votes — votes about how to proceed (like “cloture” to end debate in the Senate). A procedural vote is not the same as supporting or opposing the bill itself.",
  },
  {
    step: "5 · Other chamber",
    title: "The other chamber repeats the process",
    body: "A bill must pass the House and the Senate in identical form. If the chambers pass different versions, they negotiate the differences before a final vote.",
  },
  {
    step: "6 · President",
    title: "The President signs or vetoes",
    body: "If signed (or left unsigned for 10 days while Congress is in session), the bill becomes a public law and gets a number like “Public Law 119-98.” A veto can be overridden by a two-thirds vote in both chambers.",
  },
];

const GLOSSARY: [string, string][] = [
  ["Bill", "A proposal to create, change, or repeal a law. H.R. = introduced in the House; S. = introduced in the Senate."],
  ["Resolution", "A measure used for the chamber's own rules, opinions, or housekeeping. Most resolutions do not become law."],
  ["Amendment", "A proposed change to a bill's text, voted on separately during the process."],
  ["Public law", "A bill that has completed the whole journey and been enacted. It is numbered by Congress and order of signing."],
  ["Sponsor", "The member who introduces a bill and is its lead advocate."],
  ["Cosponsor", "A member who formally signs on to support a bill. Bipartisan cosponsorship often signals broader viability."],
  ["Committee", "A specialized group of members that reviews bills in a subject area before the full chamber considers them."],
  ["Procedural vote", "A vote about how the chamber proceeds (scheduling, ending debate, tabling). It is not a direct vote on the bill's merits — be careful reading these as support or opposition."],
  ["Roll-call vote", "A vote where each member's position is recorded by name. Voice votes, by contrast, record no individual positions."],
  ["Cloture", "A Senate vote to end debate and move to a final vote. It currently requires 60 votes for most legislation."],
  ["Stalled / died in committee", "Most bills — historically around 90% — never receive a floor vote. That's a feature of the system's filtering, not necessarily a scandal."],
];

export default function LearnPage() {
  return (
    <main className="min-h-screen bg-[#060a13] px-4 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs text-[#8fa1bb] transition-colors hover:text-[#5eead4]">
          ← Back to the map
        </Link>

        <header className="rise mt-4">
          <h1 className="text-3xl font-semibold tracking-tight text-[#f1f6fc]">
            How an idea becomes a <span className="brand-gradient">law</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#8fa1bb]">
            No legal training required. This is the journey every bill on CivicAtlas is on — and why most of them
            never finish it.
          </p>
        </header>

        <section className="mt-8 space-y-3">
          {JOURNEY.map((j, i) => (
            <div key={j.step} className="glass-soft rise flex gap-4 rounded-2xl p-5" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2dd4bf] to-[#818cf8] text-sm font-bold text-[#06251f]">
                {i + 1}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5eead4]">{j.step}</div>
                <h2 className="mt-0.5 text-[15px] font-semibold text-[#f1f6fc]">{j.title}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[#b9c7da]">{j.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="glass-soft rise mt-8 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-[#f1f6fc]">Key terms, in plain English</h2>
          <dl className="mt-4 space-y-3">
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className="flex flex-col gap-0.5 border-b border-[rgba(148,163,184,0.08)] pb-3 last:border-0 sm:flex-row sm:gap-4">
                <dt className="w-40 shrink-0 text-[13px] font-semibold text-[#5eead4]">{term}</dt>
                <dd className="text-[13px] leading-relaxed text-[#b9c7da]">{def}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="glass-soft rise mt-4 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-[#f1f6fc]">Want to act on what you find?</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#b9c7da]">
            <li>
              <strong className="text-[#e6edf7]">Contact your representatives.</strong> Every official profile on
              CivicAtlas links to their official website and phone number. Find yours by entering your ZIP on the map.
            </li>
            <li>
              <strong className="text-[#e6edf7]">Read the record yourself.</strong> Every bill page links to the full
              text on Congress.gov and to official roll-call records — you never have to take our word for it.
            </li>
            <li>
              <strong className="text-[#e6edf7]">Comment on regulations.</strong> Once a law passes, agencies write
              the rules that implement it — and the public can comment at{" "}
              <a href="https://www.regulations.gov" target="_blank" rel="noopener noreferrer" className="text-[#7dd3fc] hover:text-[#5eead4]">
                regulations.gov ↗
              </a>.
            </li>
          </ul>
        </section>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-block rounded-xl bg-gradient-to-r from-[#2dd4bf] to-[#818cf8] px-6 py-3 text-sm font-semibold text-[#06251f] transition-opacity hover:opacity-90"
          >
            Explore the map →
          </Link>
        </div>
      </div>
    </main>
  );
}
