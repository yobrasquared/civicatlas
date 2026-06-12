import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cache } from "react";
import type { BillsFile, MembersFile, SummariesFile, VotesFile } from "./types";

export const getBills = cache(async (): Promise<BillsFile> => {
  const raw = await readFile(resolve(process.cwd(), "public/data/bills.json"), "utf8");
  return JSON.parse(raw);
});

export const getMembers = cache(async (): Promise<MembersFile> => {
  const raw = await readFile(resolve(process.cwd(), "public/data/members.json"), "utf8");
  return JSON.parse(raw);
});

export const getSummaries = cache(async (): Promise<SummariesFile> => {
  try {
    const raw = await readFile(resolve(process.cwd(), "public/data/summaries.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    // summaries are additive — pages work without the AI pipeline having run
    return { generated_at: "", model: "", summaries: {} };
  }
});

export const getVotes = cache(async (): Promise<VotesFile> => {
  try {
    const raw = await readFile(resolve(process.cwd(), "public/data/votes.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    // votes are additive — pages still work if the vote ingest hasn't run
    return { fetched_at: "", source: "", votes: [] };
  }
});
