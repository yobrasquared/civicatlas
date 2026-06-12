#!/usr/bin/env node
/**
 * CivicAtlas AI summary pipeline (closed-corpus).
 *
 * Generates plain-English summaries for the most prominent bills using ONLY the
 * official-record data already in public/data/bills.json (title, status, actions,
 * sponsor, votes). The model is instructed to refuse speculation; outputs are
 * JSON-validated and stored versioned in public/data/summaries.json, and the UI
 * labels them as AI-assisted with source links beside them.
 *
 * Usage: node scripts/summarize.mjs [maxBills]   (default 60)
 * Requires NVIDIA_API_KEY in env or .env.local
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = resolve(ROOT, "public/data");
const OUT = resolve(DATA, "summaries.json");
const MODEL = "meta/llama-3.3-70b-instruct";
const MAX = parseInt(process.argv[2] ?? "60", 10);
const CONCURRENCY = 4;

// load .env.local if key not in env
if (!process.env.NVIDIA_API_KEY) {
  const envPath = resolve(ROOT, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) process.env[m[1]] ??= m[2];
    }
  }
}
const KEY = process.env.NVIDIA_API_KEY;
if (!KEY) {
  console.error("NVIDIA_API_KEY missing (env or .env.local)");
  process.exit(1);
}

const { bills, fetched_at } = JSON.parse(readFileSync(resolve(DATA, "bills.json"), "utf8"));
const votesFile = existsSync(resolve(DATA, "votes.json"))
  ? JSON.parse(readFileSync(resolve(DATA, "votes.json"), "utf8"))
  : { votes: [] };
const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).summaries ?? {} : {};

/* ---- pick the most prominent bills: laws first, then moving, then recent ---- */
const rank = { law: 0, passed_both: 1, vetoed: 2, passed_one: 3, agreed: 5, committee: 4, introduced: 6, stalled: 7, failed: 8 };
const picked = [...bills]
  .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || b.status_date.localeCompare(a.status_date))
  .slice(0, MAX)
  // skip bills whose summary is current (same status + status_date as when generated)
  .filter((b) => {
    const p = prior[b.id];
    return !(p && p.for_status === b.status_raw && p.for_status_date === b.status_date);
  });

console.log(`→ ${picked.length} bills to summarize (model: ${MODEL})`);

const SYSTEM = `You write plain-English explanations of U.S. congressional bills for a nonpartisan civic website read by ordinary voters.

HARD RULES:
- Use ONLY the facts in the provided record. If the record doesn't say something, write "not specified in the available record" — never guess.
- The record contains only the bill's metadata (title, status, actions, sponsor, votes) — NOT its full text. Derive what the bill does from its official title and actions only, and say so when the title alone is the basis.
- 10th-grade reading level. Neutral tone. No opinion, no motive, no predictions, no partisan language. Never characterize a bill as good or bad.
- Output ONLY a JSON object, no markdown fences, with EXACTLY these keys:
  {"one_liner": "<=28 words, what the bill does/did",
   "detailed": "60-110 words: what it does, where it stands in the process, and what happened most recently",
   "who_affected": "<=25 words or 'not specified in the available record'",
   "next_step": "<=20 words: the next procedural step, or 'none - process complete' or 'unlikely to advance'",
   "confidence": "high" | "medium" | "low",
   "confidence_reason": "<=15 words"}
- confidence is "low" when the title is vague or the record is thin; "high" only when title + actions make the picture clear.`;

function recordFor(bill) {
  const billVotes = votesFile.votes
    .filter((v) => v.bill_id === bill.id)
    .map((v) => `${v.chamber} roll call ${v.number} (${v.date}): "${v.question.slice(0, 120)}" — ${v.result} (${v.totals.y}-${v.totals.n})`);
  return JSON.stringify(
    {
      number: bill.number,
      type: bill.type,
      official_title: bill.title,
      congress: bill.congress,
      introduced: bill.introduced,
      sponsor: bill.sponsor ? `${bill.sponsor.name} (${bill.sponsor.party ?? "?"}-${bill.sponsor.state})` : null,
      current_status: bill.status_raw,
      status_explanation: bill.status_desc,
      status_date: bill.status_date,
      became_law: bill.law_num ? `Public Law ${bill.congress}-${bill.law_num}` : null,
      still_moving: bill.is_alive,
      major_actions: bill.actions.map((a) => `${a.date}: ${a.text}`),
      recorded_votes: billVotes,
    },
    null,
    1
  );
}

async function summarize(bill, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Official record:\n${recordFor(bill)}\n\nJSON:` },
          ],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let text = data.choices[0].message.content.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("no JSON in output");
      const s = JSON.parse(jsonMatch[0]);
      // validate shape + rules
      for (const k of ["one_liner", "detailed", "who_affected", "next_step", "confidence", "confidence_reason"]) {
        if (typeof s[k] !== "string" || !s[k]) throw new Error(`missing field ${k}`);
      }
      if (!["high", "medium", "low"].includes(s.confidence)) throw new Error("bad confidence");
      if (s.one_liner.split(/\s+/).length > 40 || s.detailed.split(/\s+/).length > 160) throw new Error("too long");
      return {
        ...s,
        model: MODEL,
        generated_at: new Date().toISOString(),
        for_status: bill.status_raw,
        for_status_date: bill.status_date,
        basis: "official record metadata (title, status, actions, votes) — not full bill text",
        source_data_fetched_at: fetched_at,
      };
    } catch (e) {
      if (i === tries - 1) {
        console.log(`  ✗ ${bill.number}: ${e.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

const summaries = { ...prior };
let done = 0;
const queue = [...picked];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const bill = queue.shift();
      const s = await summarize(bill);
      if (s) summaries[bill.id] = s;
      done++;
      if (done % 10 === 0 || queue.length === 0) console.log(`  ${done}/${picked.length}`);
    }
  })
);

writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), model: MODEL, summaries }));
console.log(`✓ ${Object.keys(summaries).length} summaries written to public/data/summaries.json`);
