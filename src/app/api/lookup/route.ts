import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseGeoid } from "../../../lib/states";

/**
 * Privacy-preserving district lookup.
 * ZIP -> Zippopotam centroid -> local point-in-polygon against Census district boundaries.
 * Address -> U.S. Census geocoder (authoritative congressional district).
 * Nothing the user types is stored or logged.
 */

type DistrictFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { GEOID: string }>;
let districtsPromise: Promise<DistrictFeature[]> | null = null;

function loadDistricts(): Promise<DistrictFeature[]> {
  districtsPromise ??= readFile(resolve(process.cwd(), "public/data/districts.geojson"), "utf8").then(
    (raw) => (JSON.parse(raw) as GeoJSON.FeatureCollection).features as DistrictFeature[]
  );
  return districtsPromise;
}

function inRing(pt: [number, number], ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inGeometry(pt: [number, number], geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.some((poly) => inRing(pt, poly[0]) && !poly.slice(1).some((hole) => inRing(pt, hole)));
}

async function pointToGeoid(lng: number, lat: number): Promise<string | null> {
  const districts = await loadDistricts();
  return districts.find((f) => inGeometry([lng, lat], f.geometry))?.properties.GEOID ?? null;
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  const address = req.nextUrl.searchParams.get("address");

  try {
    let geoid: string | null = null;

    if (zip) {
      const res = await fetch(`https://api.zippopotam.us/us/${zip.slice(0, 5)}`);
      if (!res.ok) return NextResponse.json({ error: `ZIP ${zip} not found.` }, { status: 404 });
      const data = await res.json();
      const place = data.places?.[0];
      if (!place) return NextResponse.json({ error: `ZIP ${zip} not found.` }, { status: 404 });
      geoid = await pointToGeoid(parseFloat(place.longitude), parseFloat(place.latitude));
    } else if (address) {
      const url =
        "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?" +
        new URLSearchParams({
          address,
          benchmark: "Public_AR_Current",
          vintage: "Current_Current",
          format: "json",
        });
      const res = await fetch(url);
      const data = await res.json();
      const match = data?.result?.addressMatches?.[0];
      if (!match)
        return NextResponse.json(
          { error: "Address not found — try the format “123 Main St, City, ST”." },
          { status: 404 }
        );
      const geos = match.geographies ?? {};
      const cdKey = Object.keys(geos).find((k) => /congressional district/i.test(k));
      geoid = cdKey ? geos[cdKey]?.[0]?.GEOID ?? null : null;
      // The geocoder returns current-Congress districts; our boundary file is CD118.
      // If they disagree (mid-decade redistricting), fall back to point-in-polygon.
      if (geoid) {
        const districts = await loadDistricts();
        if (!districts.some((f) => f.properties.GEOID === geoid)) geoid = null;
      }
      geoid ??= await pointToGeoid(match.coordinates.x, match.coordinates.y);
    } else {
      return NextResponse.json({ error: "Provide ?zip= or ?address=" }, { status: 400 });
    }

    if (!geoid) return NextResponse.json({ error: "Couldn’t match that location to a district." }, { status: 404 });
    const parsed = parseGeoid(geoid);
    return NextResponse.json({ geoid, ...parsed });
  } catch {
    return NextResponse.json({ error: "Lookup service unavailable — try again shortly." }, { status: 502 });
  }
}
