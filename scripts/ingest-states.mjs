#!/usr/bin/env node
/**
 * CivicAtlas Phase 2 pilot: state legislatures via the Open States API.
 * Pilot states: CA, TX, NY, FL, PA. Fetches current legislators and the most
 * recently active bills per state. Respects the free-tier rate limit by
 * pacing requests.
 *
 * Output: public/data/states/{abbr}.json + public/data/states/index.json
 * Requires OPENSTATES_API_KEY in env or .env.local
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { classify } from "./topics.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const OUTDIR = resolve(ROOT, "public/data/states");
mkdirSync(OUTDIR, { recursive: true });

if (!process.env.OPENSTATES_API_KEY) {
  const envPath = resolve(ROOT, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) process.env[m[1]] ??= m[2];
    }
  }
}
const KEY = process.env.OPENSTATES_API_KEY;
if (!KEY) {
  console.error("OPENSTATES_API_KEY missing (env or .env.local)");
  process.exit(1);
}

const PILOTS = [
  ["CA", "California"],
  ["TX", "Texas"],
  ["NY", "New York"],
  ["FL", "Florida"],
  ["PA", "Pennsylvania"],
];
const BILL_PAGES = 2; // 2 x 20 = 40 most recently active bills per state
const now = new Date().toISOString();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, tries = 4) {
  for (let i = 0; i < tries; i++) {
    await sleep(700); // pace for the free tier
    const res = await fetch(`https://v3.openstates.org${path}`, { headers: { "X-API-KEY": KEY } });
    if (res.status === 429) {
      console.log("  rate-limited, backing off 20s…");
      await sleep(20000);
      continue;
    }
    if (!res.ok) {
      if (i === tries - 1) throw new Error(`${res.status} ${path}`);
      await sleep(2500 * (i + 1));
      continue;
    }
    return res.json();
  }
  throw new Error(`gave up on ${path}`);
}

const index = [];
for (const [abbr, name] of PILOTS) {
  const j = abbr.toLowerCase();
  console.log(`→ ${name}`);

  // legislators (paginated, 50/page)
  const legislators = [];
  let page = 1;
  let maxPage = 1;
  do {
    const d = await get(`/people?jurisdiction=${j}&per_page=50&page=${page}`);
    maxPage = d.pagination.max_page;
    for (const p of d.results) {
      if (!p.current_role) continue;
      legislators.push({
        id: p.id,
        name: p.name,
        party: p.party,
        chamber: p.current_role.org_classification, // upper | lower
        title: p.current_role.title,
        district: String(p.current_role.district ?? ""),
        image: p.image || null,
        email: p.email || null,
        openstates_url: p.openstates_url,
      });
    }
    page++;
  } while (page <= maxPage);
  console.log(`  ${legislators.length} legislators`);

  // recently active bills
  const bills = [];
  for (let bp = 1; bp <= BILL_PAGES; bp++) {
    const d = await get(`/bills?jurisdiction=${j}&sort=updated_desc&per_page=20&page=${bp}&include=sponsorships`);
    for (const b of d.results) {
      bills.push({
        id: b.id,
        identifier: b.identifier,
        title: b.title,
        session: b.session,
        classification: b.classification ?? [],
        topics: classify(b.title || ""),
        first_action: b.first_action_date,
        latest_action: b.latest_action_description,
        latest_action_date: b.latest_action_date,
        passed_date: b.latest_passage_date ?? null,
        openstates_url: b.openstates_url,
        sponsors: (b.sponsorships ?? [])
          .filter((s) => s.primary || (b.sponsorships ?? []).every((x) => !x.primary))
          .slice(0, 3)
          .map((s) => s.name),
      });
    }
  }
  console.log(`  ${bills.length} recent bills`);

  writeFileSync(
    resolve(OUTDIR, `${abbr}.json`),
    JSON.stringify({
      fetched_at: now,
      source: "Open States API (aggregating official state legislature data)",
      source_url: "https://openstates.org",
      state: abbr,
      name,
      legislators,
      bills,
    })
  );
  index.push({ abbr, name, legislators: legislators.length, bills: bills.length });
}

writeFileSync(resolve(OUTDIR, "index.json"), JSON.stringify({ fetched_at: now, states: index }));
console.log(`✓ ${index.length} states written:`, index.map((s) => `${s.abbr}(${s.legislators}/${s.bills})`).join(" "));
