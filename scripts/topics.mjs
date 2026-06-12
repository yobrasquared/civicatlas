/** Shared keyword topic classifier — transparent methodology, applied to official bill titles. */
export const TOPICS = [
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

export const classify = (title) => {
  const hits = TOPICS.filter(([, re]) => re.test(title)).map(([t]) => t);
  return hits.length ? hits.slice(0, 3) : ["other"];
};
