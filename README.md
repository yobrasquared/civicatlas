# CivicAtlas

**See what your government is actually doing.**

A nonpartisan, source-linked, map-first view of U.S. government activity. Zoom into any congressional district to see who represents it, what they've sponsored, what's moving through Congress right now, and what just became law — every claim one click from the official record.

## What works today (Phase 1 MVP)

- **Interactive district map** — all 435+ congressional districts (MapLibre GL + Census boundaries), colored by real legislative activity, with hover cards and click-to-explore.
- **Live data** — 537 current members and ~1,000 recently active bills of the 119th Congress, including the 100 most recent enacted laws. No API keys required.
- **ZIP / address lookup** — find your district via the U.S. Census geocoder. Privacy-first: your address is never stored.
- **Topic filters** — 16 neutral policy areas recolor the map and feeds in real time.
- **Bill pages** — status stepper (Introduced → Law), plain-English status, major-action timeline, sponsor, related bills, and official source links.
- **Official profiles** — photo, term info, sponsored bills, enacted laws, transparent activity stats, top policy areas, contact links.
- **Roll-call votes from the official record** — member positions parsed directly from House Clerk and Senate LIS XML. Vote breakdowns on bill pages (with a filterable full-chamber roster), voting records on profiles, and "how your delegation voted" in the district panel. Procedural votes are labeled as such.
- **Civic education** — `/learn`: a plain-English "how a bill becomes law" journey and glossary.
- **Search** — omnibox for bills, members, states, ZIPs, and addresses.
- **Source-first trust system** — every page carries source chips (Official / Aggregator), data-freshness stamps, and methodology notes.

## Run it

```bash
npm install
npm run ingest        # members, bills, boundaries — keyless
npm run ingest:votes  # roll-call votes from official House/Senate XML
npm run dev           # http://localhost:3000
```

## Data sources

| Data | Source | Notes |
|---|---|---|
| Members | [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) | community-maintained official roster |
| Bills, status, laws | [GovTrack API](https://www.govtrack.us/developers/api) | aggregates official Congress.gov data |
| Boundaries | [U.S. Census cartographic files](https://www.census.gov/geographies/mapping-files.html) (CD118) | simplified with mapshaper |
| Geocoding | U.S. Census Geocoder + Zippopotam | server-side, nothing stored |
| Member photos | unitedstates/images | falls back to initials |
| Basemap | CARTO dark-matter (MapLibre GL) | |

## Principles

1. **Source or silence** — if we can't link it to the record, we don't say it.
2. **Nonpartisan by design** — neutral status colors, no red-vs-blue framing, identical metrics for every official, no composite "scores."
3. **Honest about coverage** — every count is labeled with its data window; freshness is always visible.
4. **Privacy** — address lookup never persists what you type.

## Roadmap

- **Phase 2** — state legislatures (Open States / LegiScan), roll-call vote detail, AI plain-English bill summaries (RAG over official text, citation-or-reject), alerts & weekly digest, semantic search.
- **Phase 3** — local government pilots, Federal Register rulemaking, campaign-finance context (clearly separated), promise tracker, comparisons.

Built as the Phase 1 MVP of the CivicAtlas product plan.
