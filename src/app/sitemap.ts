import type { MetadataRoute } from "next";
import { getBills, getMembers } from "../lib/data";
import { PILOT_STATES } from "../lib/states";

const BASE = "https://civicatlas.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ bills }, { members }] = await Promise.all([getBills(), getMembers()]);

  const statics: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/learn`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/compare`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/methodology`, changeFrequency: "monthly", priority: 0.6 },
    ...PILOT_STATES.map((s) => ({
      url: `${BASE}/state/${s}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  return [
    ...statics,
    ...bills.map((b) => ({
      url: `${BASE}/bill/${b.id}`,
      lastModified: b.status_date ? new Date(b.status_date + "T12:00:00") : undefined,
      changeFrequency: "weekly" as const,
      priority: b.status === "law" ? 0.9 : 0.6,
    })),
    ...members.map((m) => ({
      url: `${BASE}/official/${m.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
