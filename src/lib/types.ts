export type Member = {
  id: string;
  name: string;
  last: string;
  party: string;
  state: string;
  district: number | null;
  chamber: "House" | "Senate";
  title: string;
  termStart: string;
  termEnd: string;
  serving_since: string;
  website: string | null;
  phone: string | null;
  photo: string;
};

export type BillStatus =
  | "introduced"
  | "committee"
  | "passed_one"
  | "passed_both"
  | "law"
  | "agreed"
  | "vetoed"
  | "stalled"
  | "failed";

export type Bill = {
  id: string;
  number: string;
  type: string;
  title: string;
  congress: number;
  introduced: string;
  status: BillStatus;
  status_raw: string;
  status_desc: string;
  status_date: string;
  chamber: string | null;
  is_alive: boolean;
  law_num: string | null;
  link: string;
  congress_link: string;
  topics: string[];
  sponsor: {
    id: string;
    name: string;
    party: string | null;
    state: string | null;
    district: number | null;
    chamber: "House" | "Senate";
  } | null;
  actions: { date: string; text: string }[];
};

export type RollCallVote = {
  key: string;
  chamber: "House" | "Senate";
  number: number;
  date: string;
  question: string;
  result: string;
  passed: boolean;
  category: string;
  kind: "passage" | "amendment" | "nomination" | "procedural" | "other";
  required: string;
  bill_id: string | null;
  totals: { y: number; n: number; o: number };
  link: string;
  official_url: string | null;
  /** bioguideId -> Y | N | P | X */
  positions: Record<string, string>;
};

export type VotesFile = { fetched_at: string; source: string; votes: RollCallVote[] };

export type AISummary = {
  one_liner: string;
  detailed: string;
  who_affected: string;
  next_step: string;
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  model: string;
  generated_at: string;
  for_status: string;
  for_status_date: string;
  basis: string;
  source_data_fetched_at: string;
};

export type SummariesFile = { generated_at: string; model: string; summaries: Record<string, AISummary> };

export type MembersFile = { fetched_at: string; source: string; source_url: string; members: Member[] };
export type BillsFile = { fetched_at: string; source: string; source_url: string; congress: number; bills: Bill[] };
