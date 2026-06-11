#!/usr/bin/env node
/**
 * CivicAtlas roll-call vote ingest.
 *  - Vote index/metadata: GovTrack API (congress 119)
 *  - Member positions: OFFICIAL sources — House Clerk XML (clerk.house.gov) and
 *    Senate LIS XML (senate.gov). Senate uses LIS ids, mapped to bioguide via
 *    the congress-legislators roster.
 * Output: public/data/votes.json
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = resolve(ROOT, "public/data");
const now = new Date().toISOString();
const VOTE_COUNT = 70; // most recent votes to ingest positions for

async function get(url, type = "json", tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "CivicAtlas-MVP (civic transparency demo)" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return type === "json" ? await res.json() : await res.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

console.log("→ roster: lis→bioguide map");
const roster = await get("https://unitedstates.github.io/congress-legislators/legislators-current.json");
const lisToBioguide = {};
for (const p of roster) if (p.id.lis) lisToBioguide[p.id.lis] = p.id.bioguide;

console.log("→ vote index: GovTrack (congress 119)");
const index = await get(`https://www.govtrack.us/api/v2/vote?congress=119&sort=-created&limit=${VOTE_COUNT}`);

const POS = { yea: "Y", aye: "Y", yes: "Y", nay: "N", no: "N", present: "P", "not voting": "X", "present, giving live pair": "P" };
const norm = (s) => POS[String(s).trim().toLowerCase()] ?? "X";

function parseHouse(xml) {
  const positions = {};
  const re = /<legislator name-id="([A-Z]\d+)"[^>]*>[^<]*<\/legislator>\s*<vote>([^<]*)<\/vote>/g;
  for (const m of xml.matchAll(re)) positions[m[1]] = norm(m[2]);
  return positions;
}

function parseSenate(xml) {
  const positions = {};
  const re = /<lis_member_id>([^<]+)<\/lis_member_id>[\s\S]*?<vote_cast>([^<]*)<\/vote_cast>/g;
  for (const m of xml.matchAll(re)) {
    const bio = lisToBioguide[m[1].trim()];
    if (bio) positions[bio] = norm(m[2]);
  }
  return positions;
}

const CATEGORY_KIND = {
  passage: "passage", passage_suspension: "passage", veto_override: "passage",
  amendment: "amendment", nomination: "nomination",
  cloture: "procedural", procedural: "procedural", quorum: "procedural",
  impeachment: "other", treaty: "other", conviction: "other", unknown: "other",
};

const votes = [];
for (const v of index.objects) {
  const year = parseInt(v.session, 10);
  const chamber = v.chamber_label; // "House" | "Senate"
  let positions = {};
  let officialUrl = null;
  try {
    if (chamber === "House") {
      officialUrl = `https://clerk.house.gov/evs/${year}/roll${String(v.number).padStart(3, "0")}.xml`;
      positions = parseHouse(await get(officialUrl, "text"));
    } else {
      const sess = year === 2025 ? 1 : 2; // 119th Congress: session 1 = 2025, session 2 = 2026
      officialUrl = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote119${sess}/vote_119_${sess}_${String(v.number).padStart(5, "0")}.xml`;
      positions = parseSenate(await get(officialUrl, "text"));
    }
  } catch (e) {
    console.log(`  ! positions unavailable for ${chamber} #${v.number} (${e.message.slice(0, 60)})`);
  }
  const rb = v.related_bill;
  votes.push({
    key: `${chamber === "House" ? "h" : "s"}-${v.session}-${v.number}`,
    chamber,
    number: v.number,
    date: String(v.created).slice(0, 10),
    question: v.question,
    result: v.result,
    passed: v.passed,
    category: v.category_label,
    kind: CATEGORY_KIND[v.category] ?? "other",
    required: v.required,
    bill_id: rb ? `${rb.congress}-${rb.bill_type}-${rb.number}` : null,
    totals: { y: v.total_plus, n: v.total_minus, o: v.total_other },
    link: v.link,
    official_url: officialUrl,
    positions,
  });
  process.stdout.write(`  ${votes.length}/${index.objects.length} ${chamber} #${v.number} (${Object.keys(positions).length} positions)\n`);
}

writeFileSync(
  resolve(DATA, "votes.json"),
  JSON.stringify({
    fetched_at: now,
    source: "Positions: House Clerk & Senate LIS official XML · index: GovTrack",
    votes,
  })
);
console.log(`✓ ${votes.length} roll-call votes written`);
