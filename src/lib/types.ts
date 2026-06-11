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

export type MembersFile = { fetched_at: string; source: string; source_url: string; members: Member[] };
export type BillsFile = { fetched_at: string; source: string; source_url: string; congress: number; bills: Bill[] };
