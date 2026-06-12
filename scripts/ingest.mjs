#!/usr/bin/env node
/**
 * CivicAtlas ingest pipeline (MVP)
 * Sources (all official/public, keyless):
 *  - unitedstates/congress-legislators  -> current members of Congress
 *  - GovTrack API                       -> recent bills w/ sponsor + status, enacted laws
 *  - Census cartographic boundaries     -> congressional districts (cb_2023_cd118), states
 * Output: public/data/*.json + *.geojson, with fetch timestamps for the freshness UI.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = resolve(ROOT, "public/data");
const TMP = resolve(ROOT, ".ingest-cache");
mkdirSync(DATA, { recursive: true });
mkdirSync(TMP, { recursive: true });

const now = new Date().toISOString();

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "CivicAtlas-MVP (civic transparency demo)" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

/* ---------------- 1. Members ---------------- */
async function ingestMembers() {
  console.log("→ members: unitedstates.github.io/congress-legislators");
  const raw = await getJSON("https://unitedstates.github.io/congress-legislators/legislators-current.json");
  const members = raw.map((p) => {
    const term = p.terms[p.terms.length - 1];
    const first = p.terms[0];
    return {
      id: p.id.bioguide,
      name: `${p.name.first} ${p.name.last}`,
      last: p.name.last,
      party: term.party,
      state: term.state,
      district: term.type === "rep" ? (term.district ?? 0) : null,
      chamber: term.type === "rep" ? "House" : "Senate",
      title: term.type === "rep" ? "Representative" : "Senator",
      termStart: term.start,
      termEnd: term.end,
      serving_since: first.start,
      website: term.url ?? null,
      phone: term.phone ?? null,
      photo: `https://unitedstates.github.io/images/congress/225x275/${p.id.bioguide}.jpg`,
    };
  });
  writeFileSync(resolve(DATA, "members.json"), JSON.stringify({ fetched_at: now, source: "unitedstates/congress-legislators (official roster)", source_url: "https://github.com/unitedstates/congress-legislators", members }));
  console.log(`  ${members.length} current members`);
  return members;
}

/* ---------------- 2. Bills + laws (GovTrack) ---------------- */
const STATUS_MAP = {
  introduced: "introduced",
  referred: "committee",
  reported: "committee",
  pass_over_house: "passed_one",
  pass_over_senate: "passed_one",
  passed_bill: "passed_both",
  pass_back_house: "passed_both",
  pass_back_senate: "passed_both",
  conference_passed_house: "passed_both",
  conference_passed_senate: "passed_both",
  enacted_signed: "law",
  enacted_veto_override: "law",
  enacted_tendayrule: "law",
  prov_kill_suspensionfailed: "stalled",
  prov_kill_cloturefailed: "stalled",
  prov_kill_pingpongfail: "stalled",
  prov_kill_veto: "vetoed",
  vetoed_pocket: "vetoed",
  vetoed_override_fail_originating_house: "vetoed",
  vetoed_override_fail_originating_senate: "vetoed",
  fail_originating_house: "failed",
  fail_originating_senate: "failed",
  fail_second_house: "failed",
  fail_second_senate: "failed",
  passed_simpleres: "agreed",
  passed_concurrentres: "passed_both",
  passed_constamend: "passed_both",
};

const TOPICS = [
  ["housing", /housing|rent|mortgage|homeless|tenant|affordab.* hom/i],
  ["healthcare", /health|medicare|medicaid|drug|prescription|hospital|mental|opioid|cancer|disease|vaccin/i],
  ["education", /education|school|student|teacher|college|universit|literacy|stem\b/i],
  ["taxes", /\btax|irs\b|revenue code|deduction|credit act/i],
  ["environment", /environment|climate|clean (air|water|energy)|wildlife|conservation|pollution|emission|forest|ocean|river|bird|habitat|species|public lands?/i],
  ["immigration", /immigra|border|visa|asylum|citizenship|refugee/i],
  ["economy", /small business|jobs?\b|economic|economy|trade|tariff|manufactur|inflation|wage|labor|workforce|employment/i],
  ["defense", /defense|military|armed forces|veteran|national guard|navy|army|air force|servicemember/i],
  ["justice", /criminal|justice|police|prison|sentencing|firearm|gun|crime|victim|court/i],
  ["technology", /technolog|artificial intelligence|\bai\b|cyber|internet|broadband|data privacy|telecommunications|social media/i],
  ["transportation", /transport|highway|transit|rail|aviation|airport|infrastructure|bridge|vehicle/i],
  ["energy", /energy|nuclear|grid|petroleum|oil|gas pipeline|solar|wind power|electric/i],
  ["agriculture", /agricultur|farm|crop|livestock|rural|food (safety|security)|nutrition|snap\b/i],
  ["elections", /election|voting|voter|ballot|campaign finance|redistrict/i],
  ["civil-rights", /civil rights|discriminat|equality|disability|religious freedom|free speech|tribal|native american/i],
  ["budget", /appropriation|budget|debt limit|continuing resolution|fiscal/i],
];
const classify = (title) => {
  const hits = TOPICS.filter(([, re]) => re.test(title)).map(([t]) => t);
  return hits.length ? hits.slice(0, 3) : ["other"];
};

// GovTrack serializes action timestamps as Python reprs: "datetime.datetime(2026, 5, 20, 0, 0)"
function parseGtDate(ts) {
  const s = String(ts);
  const m = s.match(/datetime\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s.slice(0, 10);
}

function trimBill(b) {
  return {
    id: `${b.congress}-${b.bill_type}-${b.number}`,
    number: b.display_number,
    type: b.bill_type_label,
    title: b.title_without_number,
    congress: b.congress,
    introduced: b.introduced_date,
    status: STATUS_MAP[b.current_status] ?? "introduced",
    status_raw: b.current_status_label,
    status_desc: b.current_status_description,
    status_date: b.current_status_date,
    chamber: b.current_chamber,
    is_alive: b.is_alive,
    law_num: b.sliplawnum || null,
    link: `https://www.govtrack.us${b.link.replace(/^https?:\/\/www\.govtrack\.us/, "")}`,
    congress_link: `https://www.congress.gov/bill/${b.congress}th-congress/${b.bill_type.replace(/_/g, "-")}/${b.number}`,
    topics: classify(b.title_without_number || ""),
    sponsor: b.sponsor
      ? {
          id: b.sponsor.bioguideid,
          name: `${b.sponsor.firstname} ${b.sponsor.lastname}`,
          party: b.sponsor_role?.party ?? null,
          state: b.sponsor_role?.state ?? null,
          district: b.sponsor_role?.district ?? null,
          chamber: b.sponsor_role?.role_type === "senator" ? "Senate" : "House",
        }
      : null,
    actions: (b.major_actions ?? []).map(([ts, , text]) => ({ date: parseGtDate(ts), text })),
  };
}

async function ingestBills() {
  console.log("→ bills: GovTrack API (congress 119)");
  const pages = [];
  for (const offset of [0, 300, 600]) {
    const d = await getJSON(`https://www.govtrack.us/api/v2/bill?congress=119&sort=-current_status_date&limit=300&offset=${offset}`);
    pages.push(...d.objects);
    console.log(`  +${d.objects.length} (total ${pages.length})`);
  }
  const laws = await getJSON("https://www.govtrack.us/api/v2/bill?congress=119&current_status=enacted_signed&sort=-current_status_date&limit=100");
  console.log(`  +${laws.objects.length} enacted laws`);
  const seen = new Set();
  const all = [...laws.objects, ...pages].filter((b) => {
    const k = `${b.bill_type}-${b.number}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const bills = all.map(trimBill);
  writeFileSync(resolve(DATA, "bills.json"), JSON.stringify({ fetched_at: now, source: "GovTrack.us API (aggregating official Congress.gov data)", source_url: "https://www.govtrack.us/developers/api", congress: 119, bills }));
  console.log(`  ${bills.length} bills total`);
  return bills;
}

/* ---------------- 3. Boundaries ---------------- */
function shp(url, zip, out, fields, pct) {
  if (!existsSync(resolve(TMP, zip))) {
    console.log(`  downloading ${zip}`);
    execSync(`curl -s -o ${resolve(TMP, zip)} ${url}`, { stdio: "inherit" });
  }
  console.log(`  mapshaper → ${out}`);
  execSync(
    `npx --yes mapshaper ${resolve(TMP, zip)} -simplify ${pct} keep-shapes -filter-fields ${fields} -clean -o precision=0.0001 format=geojson ${resolve(DATA, out)}`,
    { stdio: "inherit", cwd: ROOT }
  );
}

function ingestBoundaries() {
  console.log("→ boundaries: Census cartographic files (2023, CD118)");
  shp(
    "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_cd118_500k.zip",
    "cd118.zip",
    "districts.geojson",
    "GEOID,STATEFP,CD118FP",
    "12%"
  );
  shp(
    "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_5m.zip",
    "states.zip",
    "states.geojson",
    "GEOID,STUSPS,NAME",
    "40%"
  );
}

/* ---------------- run ---------------- */
const members = await ingestMembers();
const bills = await ingestBills();
if (process.env.SKIP_BOUNDARIES) {
  console.log("→ boundaries: skipped (SKIP_BOUNDARIES set — using files already in repo)");
} else {
  ingestBoundaries();
}

// Per-district + per-state activity (count of recent bills by sponsor's seat)
const activity = {};
for (const b of bills) {
  if (!b.sponsor?.state) continue;
  const key = b.sponsor.chamber === "House" ? `${b.sponsor.state}-${b.sponsor.district ?? 0}` : `${b.sponsor.state}-SEN`;
  activity[key] = (activity[key] ?? 0) + 1;
}
writeFileSync(resolve(DATA, "meta.json"), JSON.stringify({ fetched_at: now, members: members.length, bills: bills.length, activity }));
console.log(`✓ ingest complete — ${members.length} members, ${bills.length} bills, ${Object.keys(activity).length} active seats`);
